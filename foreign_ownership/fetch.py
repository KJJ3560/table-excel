"""KRX(pykrx)에서 시장별 외국인 지분율 데이터를 가져온다."""

from __future__ import annotations

import pandas as pd
from pykrx import stock

MARKETS = ("KOSPI", "KOSDAQ")

_COLUMN_MAP = {
    "상장주식수": "shares_outstanding",
    "보유수량": "foreign_shares",
    "지분율": "foreign_ratio",
    "한도수량": "limit_shares",
    "한도소진률": "limit_exhaustion_ratio",
}


def fetch_foreign_ownership(base_date: str, market: str) -> pd.DataFrame:
    """주어진 날짜/시장의 전 종목 외국인 지분율 데이터를 반환한다.

    반환 컬럼: ticker, name, shares_outstanding, foreign_shares, foreign_ratio,
    limit_shares, limit_exhaustion_ratio
    """
    df = stock.get_exhaustion_rates_of_foreign_investment(base_date, market)
    df = df.rename(columns=_COLUMN_MAP)
    df.index.name = "ticker"
    df = df.reset_index()
    df["name"] = [stock.get_market_ticker_name(ticker) for ticker in df["ticker"]]
    return df[["ticker", "name", *_COLUMN_MAP.values()]]


def top_n_by_ratio(df: pd.DataFrame, n: int = 50) -> pd.DataFrame:
    """외국인 지분율 기준 상위 n개 종목에 순위를 매겨 반환한다."""
    ranked = df.sort_values("foreign_ratio", ascending=False).head(n).reset_index(drop=True)
    ranked.insert(0, "rank", ranked.index + 1)
    return ranked
