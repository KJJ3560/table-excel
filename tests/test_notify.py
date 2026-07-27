import pandas as pd

from foreign_ownership.notify import build_summary_text

FRAME_WITH_CHANGES = pd.DataFrame(
    {
        "rank": [1, 2],
        "ticker": ["000660", "005930"],
        "name": ["SK하이닉스", "삼성전자"],
        "foreign_ratio": [55.0, 51.5],
        "ratio_change": [2.0, -0.5],
        "recent_disclosures": ["", "임원ㆍ주요주주특정증권등소유상황보고서"],
    }
)

FRAME_WITHOUT_PREVIOUS = pd.DataFrame(
    {
        "rank": [1],
        "ticker": ["000660"],
        "name": ["SK하이닉스"],
        "foreign_ratio": [55.0],
        "ratio_change": [pd.NA],
    }
)


def test_build_summary_text_includes_movers_and_disclosures():
    text = build_summary_text({"KOSPI": FRAME_WITH_CHANGES})
    assert "SK하이닉스" in text
    assert "삼성전자" in text
    assert "임원ㆍ주요주주특정증권등소유상황보고서" in text


def test_build_summary_text_handles_missing_previous_data():
    text = build_summary_text({"KOSPI": FRAME_WITHOUT_PREVIOUS})
    assert "비교할 전일 데이터가 없어" in text
