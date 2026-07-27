"""과거 스냅샷을 저장/조회하고 전일 대비 변동률을 계산한다."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

SNAPSHOT_COLUMNS = [
    "rank",
    "ticker",
    "name",
    "foreign_ratio",
    "foreign_shares",
    "shares_outstanding",
]


def history_path(data_dir: Path, market: str) -> Path:
    return data_dir / f"history_{market}.csv"


def load_last_snapshot(data_dir: Path, market: str, before_date: str) -> pd.DataFrame | None:
    """`before_date` 이전 가장 최근 스냅샷을 반환한다. 없으면 None."""
    path = history_path(data_dir, market)
    if not path.exists():
        return None
    history = pd.read_csv(path, dtype={"date": str, "ticker": str})
    history = history[history["date"] < before_date]
    if history.empty:
        return None
    last_date = history["date"].max()
    return history[history["date"] == last_date].reset_index(drop=True)


def append_snapshot(data_dir: Path, market: str, base_date: str, ranked: pd.DataFrame) -> None:
    """오늘 계산한 상위 종목 스냅샷을 히스토리 파일에 추가한다."""
    path = history_path(data_dir, market)
    snapshot = ranked[SNAPSHOT_COLUMNS].copy()
    snapshot.insert(0, "date", base_date)

    path.parent.mkdir(parents=True, exist_ok=True)
    write_header = not path.exists()
    snapshot.to_csv(path, mode="a", header=write_header, index=False)


def compute_changes(current: pd.DataFrame, previous: pd.DataFrame | None) -> pd.DataFrame:
    """전일 스냅샷 대비 지분율/순위 변동을 계산해 컬럼을 덧붙인다.

    previous가 없으면 (첫 실행 등) 변동 컬럼은 NA로 채운다.
    """
    result = current.copy()
    if previous is None or previous.empty:
        result["prev_rank"] = pd.NA
        result["prev_foreign_ratio"] = pd.NA
        result["ratio_change"] = pd.NA
        result["rank_change"] = pd.NA
        return result

    prev_indexed = previous.set_index("ticker")
    result["prev_rank"] = result["ticker"].map(prev_indexed["rank"])
    result["prev_foreign_ratio"] = result["ticker"].map(prev_indexed["foreign_ratio"])
    result["ratio_change"] = (result["foreign_ratio"] - result["prev_foreign_ratio"]).round(4)
    # 양수면 순위 상승(숫자가 작아짐), 음수면 순위 하락. 신규 진입은 NA.
    result["rank_change"] = result["prev_rank"] - result["rank"]
    return result
