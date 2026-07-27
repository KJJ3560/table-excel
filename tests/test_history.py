from pathlib import Path

import pandas as pd

from foreign_ownership.history import append_snapshot, compute_changes, load_last_snapshot

CURRENT = pd.DataFrame(
    {
        "rank": [1, 2, 3],
        "ticker": ["000660", "005930", "035420"],
        "name": ["SK하이닉스", "삼성전자", "NAVER"],
        "foreign_ratio": [55.0, 51.5, 49.0],
        "foreign_shares": [1000, 2000, 300],
        "shares_outstanding": [10000, 20000, 3000],
    }
)


def test_compute_changes_without_previous_returns_na():
    result = compute_changes(CURRENT, None)
    assert result["ratio_change"].isna().all()
    assert result["rank_change"].isna().all()


def test_compute_changes_with_previous_computes_deltas():
    previous = pd.DataFrame(
        {
            "rank": [2, 1, 5],
            "ticker": ["000660", "005930", "035420"],
            "name": ["SK하이닉스", "삼성전자", "NAVER"],
            "foreign_ratio": [53.0, 52.0, 49.5],
            "foreign_shares": [980, 2010, 305],
            "shares_outstanding": [10000, 20000, 3000],
        }
    )
    result = compute_changes(CURRENT, previous).set_index("ticker")

    assert result.loc["000660", "ratio_change"] == 2.0
    assert result.loc["000660", "rank_change"] == 1  # 2위 -> 1위, +1
    assert result.loc["005930", "ratio_change"] == -0.5
    assert result.loc["005930", "rank_change"] == -1  # 1위 -> 2위, -1
    assert result.loc["035420", "rank_change"] == 2  # 5위 -> 3위


def test_compute_changes_new_entry_has_na_deltas():
    previous = pd.DataFrame(
        {
            "rank": [1, 2],
            "ticker": ["005930", "035420"],
            "name": ["삼성전자", "NAVER"],
            "foreign_ratio": [52.0, 49.5],
            "foreign_shares": [2010, 305],
            "shares_outstanding": [20000, 3000],
        }
    )
    result = compute_changes(CURRENT, previous).set_index("ticker")
    assert pd.isna(result.loc["000660", "ratio_change"])
    assert pd.isna(result.loc["000660", "rank_change"])


def test_append_and_load_snapshot_round_trip(tmp_path: Path):
    append_snapshot(tmp_path, "KOSPI", "20260724", CURRENT)
    append_snapshot(tmp_path, "KOSPI", "20260727", CURRENT)

    loaded = load_last_snapshot(tmp_path, "KOSPI", before_date="20260727")
    assert loaded is not None
    assert (loaded["date"] == "20260724").all()
    assert set(loaded["ticker"]) == {"000660", "005930", "035420"}


def test_load_last_snapshot_returns_none_when_missing(tmp_path: Path):
    assert load_last_snapshot(tmp_path, "KOSDAQ", before_date="20260727") is None
