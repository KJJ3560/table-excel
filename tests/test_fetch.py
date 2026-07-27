from unittest.mock import patch

import pandas as pd

from foreign_ownership.fetch import fetch_foreign_ownership, top_n_by_ratio

# pykrx.stock.get_exhaustion_rates_of_foreign_investment()가 실제로 반환하는 형태
# (티커를 인덱스로, 상장주식수/보유수량/지분율/한도수량/한도소진률 컬럼)
RAW_KRX_RESPONSE = pd.DataFrame(
    {
        "상장주식수": [10_000, 20_000, 3_000],
        "보유수량": [5_500, 5_000, 2_940],
        "지분율": [55.0, 25.0, 98.0],
        "한도수량": [10_000, 20_000, 3_000],
        "한도소진률": [55.0, 25.0, 98.0],
    },
    index=pd.Index(["000660", "005930", "035420"], name="티커"),
)

TICKER_NAMES = {"000660": "SK하이닉스", "005930": "삼성전자", "035420": "NAVER"}


def test_fetch_foreign_ownership_renames_columns_and_adds_name():
    with patch("foreign_ownership.fetch.stock.get_exhaustion_rates_of_foreign_investment", return_value=RAW_KRX_RESPONSE), patch(
        "foreign_ownership.fetch.stock.get_market_ticker_name", side_effect=lambda t: TICKER_NAMES[t]
    ):
        df = fetch_foreign_ownership("20260727", "KOSPI")

    assert list(df.columns) == [
        "ticker",
        "name",
        "shares_outstanding",
        "foreign_shares",
        "foreign_ratio",
        "limit_shares",
        "limit_exhaustion_ratio",
    ]
    row = df.set_index("ticker").loc["035420"]
    assert row["name"] == "NAVER"
    assert row["foreign_ratio"] == 98.0


def test_top_n_by_ratio_ranks_descending():
    with patch("foreign_ownership.fetch.stock.get_exhaustion_rates_of_foreign_investment", return_value=RAW_KRX_RESPONSE), patch(
        "foreign_ownership.fetch.stock.get_market_ticker_name", side_effect=lambda t: TICKER_NAMES[t]
    ):
        df = fetch_foreign_ownership("20260727", "KOSPI")

    ranked = top_n_by_ratio(df, n=2)
    assert list(ranked["ticker"]) == ["035420", "000660"]
    assert list(ranked["rank"]) == [1, 2]
