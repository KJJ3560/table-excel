"""DART 대량보유 상황보고(5% 이상 지분 변동) 공시를 조회해 엑셀로 저장하는 CLI.

5% 이상 지분을 보유한 종목은 변동이 생길 때마다 며칠 내로 새 공시가 올라옵니다.
이 스크립트는 그 변동을 시장 전체 또는 특정 회사 기준으로 조회해 xlsx로 저장합니다.

실행 전 준비:
    pip install -r requirements.txt
    export DART_API_KEY="your-key"

실행:
    python dart_report.py                                     # 최근 3일간 시장 전체 신규 공시
    python dart_report.py --days 7                             # 최근 7일간 시장 전체
    python dart_report.py --company 삼성전자                    # 최근 3일간 해당 회사만
    python dart_report.py --company 삼성전자 --full-history     # 해당 회사 전체 이력 (현재 5% 이상 보유자 파악용)
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys

import pandas as pd

import dart_client as dart


def _resolve_single_corp_code(name: str) -> dict:
    matches = dart.find_corp_codes(name)
    if not matches:
        sys.exit(f"'{name}'과 일치하는 회사를 찾지 못했습니다.")

    if len(matches) > 1:
        listed = [m for m in matches if m.get("stock_code")]
        if len(listed) == 1:
            return listed[0]
        options = "\n".join(
            f"  - {m.get('corp_name')} (corp_code={m.get('corp_code')}, "
            f"stock_code={m.get('stock_code') or '-'})"
            for m in matches[:20]
        )
        sys.exit(f"'{name}'과 일치하는 회사가 여러 곳입니다. 더 구체적으로 입력하세요:\n{options}")

    return matches[0]


def _with_view_url(rows: list[dict]) -> list[dict]:
    for row in rows:
        rcept_no = row.get("rcept_no")
        if rcept_no:
            row["view_url"] = dart.filing_view_url(rcept_no)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--company", help="회사명 또는 종목코드 (생략 시 시장 전체)")
    parser.add_argument("--days", type=int, default=3, help="최근 N일 이내 신규 공시 조회 (기본값 3)")
    parser.add_argument(
        "--full-history",
        action="store_true",
        help="--company의 대량보유 상황보고 전체 이력을 조회한다 (--days 무시)",
    )
    parser.add_argument("--output", help="저장할 xlsx 경로 (기본값 자동 생성)")
    args = parser.parse_args()

    if args.full_history and not args.company:
        parser.error("--full-history는 --company와 함께 사용해야 합니다.")

    corp = _resolve_single_corp_code(args.company) if args.company else None

    if args.full_history:
        rows = dart.get_major_holding_reports(corp["corp_code"])
        label = f"{corp['corp_name']}_전체이력"
    else:
        end_de = dt.date.today()
        bgn_de = end_de - dt.timedelta(days=args.days)
        rows = dart.search_major_holding_filings(
            bgn_de=bgn_de.strftime("%Y%m%d"),
            end_de=end_de.strftime("%Y%m%d"),
            corp_code=corp["corp_code"] if corp else None,
        )
        label = f"{corp['corp_name']}_최근{args.days}일" if corp else f"시장전체_최근{args.days}일"

    rows = _with_view_url(rows)

    if not rows:
        print(f"조회된 공시가 없습니다 ({label}).")
        return

    output = args.output or f"dart_대량보유상황보고_{label}_{dt.date.today():%Y%m%d}.xlsx"
    pd.DataFrame(rows).to_excel(output, index=False)
    print(f"{len(rows)}건 저장 완료 -> {output}")


if __name__ == "__main__":
    try:
        main()
    except dart.DartApiError as exc:
        sys.exit(f"오류: {exc}")
