"""전체 파이프라인: 조회 -> 순위/변동률 계산 -> 엑셀 리포트 -> (선택) 이메일 발송."""

from __future__ import annotations

import argparse
import os
from datetime import date, datetime, timedelta
from pathlib import Path

from . import dart_disclosures, notify
from .fetch import MARKETS, fetch_foreign_ownership, top_n_by_ratio
from .history import append_snapshot, compute_changes, load_last_snapshot
from .report import build_excel_report

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
DART_CORP_CODE_CACHE = DATA_DIR / "dart_corp_code.json"
DART_LOOKBACK_DAYS = 3

ENV_DART_API_KEY = "DART_API_KEY"


def latest_business_date() -> str:
    """오늘이 주말이면 직전 금요일을, 아니면 오늘 날짜를 YYYYMMDD로 반환한다."""
    today = date.today()
    while today.weekday() >= 5:  # 5=토요일, 6=일요일
        today -= timedelta(days=1)
    return today.strftime("%Y%m%d")


def _attach_dart_disclosures(market_frames: dict, base_date: str) -> None:
    api_key = os.environ.get(ENV_DART_API_KEY)
    if not api_key:
        return

    begin_date = (datetime.strptime(base_date, "%Y%m%d").date() - timedelta(days=DART_LOOKBACK_DAYS)).strftime("%Y%m%d")
    all_tickers = sorted({ticker for df in market_frames.values() for ticker in df["ticker"]})
    disclosures = dart_disclosures.fetch_disclosures_for_tickers(
        api_key, all_tickers, begin_date, base_date, DART_CORP_CODE_CACHE
    )

    for df in market_frames.values():
        df["recent_disclosures"] = df["ticker"].map(
            lambda t: "; ".join(d["report_name"] for d in disclosures.get(t, []))
        )


def run(base_date: str | None, top_n: int, send_email: bool) -> Path:
    base_date = base_date or latest_business_date()

    market_frames = {}
    for market in MARKETS:
        raw = fetch_foreign_ownership(base_date, market)
        ranked = top_n_by_ratio(raw, top_n)
        previous = load_last_snapshot(DATA_DIR, market, before_date=base_date)
        market_frames[market] = compute_changes(ranked, previous)
        append_snapshot(DATA_DIR, market, base_date, ranked)

    _attach_dart_disclosures(market_frames, base_date)

    output_path = OUTPUT_DIR / f"foreign_ownership_top{top_n}_{base_date}.xlsx"
    build_excel_report(market_frames, output_path)

    if send_email:
        subject = f"[외국인 지분율 상위{top_n}] {base_date} 리포트"
        body = notify.build_summary_text(market_frames)
        notify.send_email_report(subject, body, output_path)

    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="코스피/코스닥 외국인 지분율 상위 종목 리포트를 생성하고 변동률을 이메일로 알려준다."
    )
    parser.add_argument("--date", dest="base_date", help="기준일자 YYYYMMDD (기본값: 오늘, 주말이면 직전 영업일)")
    parser.add_argument("--top-n", type=int, default=50, help="상위 몇 종목을 뽑을지 (기본값: 50)")
    parser.add_argument("--no-email", action="store_true", help="이메일 발송을 건너뛰고 엑셀 리포트만 생성한다")
    args = parser.parse_args()

    output_path = run(args.base_date, args.top_n, send_email=not args.no_email)
    print(f"리포트 생성 완료: {output_path}")


if __name__ == "__main__":
    main()
