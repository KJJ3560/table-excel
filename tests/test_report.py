from pathlib import Path

import pandas as pd
from openpyxl import load_workbook

from foreign_ownership.report import build_excel_report

FRAME = pd.DataFrame(
    {
        "rank": [1, 2],
        "ticker": ["000660", "005930"],
        "name": ["SK하이닉스", "삼성전자"],
        "foreign_ratio": [55.0, 51.5],
        "ratio_change": [2.0, -0.5],
        "rank_change": [1, -1],
        "shares_outstanding": [10000, 20000],
        "foreign_shares": [1000, 2000],
        "recent_disclosures": ["", "임원ㆍ주요주주특정증권등소유상황보고서"],
    }
)


def test_build_excel_report_creates_sheet_per_market(tmp_path: Path):
    output_path = tmp_path / "report.xlsx"
    build_excel_report({"KOSPI": FRAME}, output_path)

    assert output_path.exists()
    workbook = load_workbook(output_path)
    assert workbook.sheetnames == ["KOSPI"]

    sheet = workbook["KOSPI"]
    header = [cell.value for cell in sheet[1]]
    assert header == [
        "순위",
        "종목코드",
        "종목명",
        "지분율(%)",
        "전일대비(%p)",
        "순위변동",
        "상장주식수",
        "외국인보유수량",
        "최근 지분공시(DART)",
    ]
    assert sheet.cell(row=2, column=2).value == "000660"


def test_build_excel_report_colors_rise_and_fall(tmp_path: Path):
    output_path = tmp_path / "report.xlsx"
    build_excel_report({"KOSPI": FRAME}, output_path)

    sheet = load_workbook(output_path)["KOSPI"]
    change_col = 5  # 전일대비(%p)
    rise_cell = sheet.cell(row=2, column=change_col)
    fall_cell = sheet.cell(row=3, column=change_col)
    assert rise_cell.font.color.rgb.endswith("C00000")
    assert fall_cell.font.color.rgb.endswith("0000C0")
