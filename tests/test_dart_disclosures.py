import json
from pathlib import Path
from unittest.mock import patch

from foreign_ownership import dart_disclosures

SAMPLE_CORP_CODE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<result>
    <list>
        <corp_code>00126380</corp_code>
        <corp_name>삼성전자</corp_name>
        <stock_code>005930</stock_code>
        <modify_date>20260101</modify_date>
    </list>
    <list>
        <corp_code>00164779</corp_code>
        <corp_name>비상장회사</corp_name>
        <stock_code></stock_code>
        <modify_date>20260101</modify_date>
    </list>
</result>
""".encode("utf-8")

SAMPLE_LIST_PAYLOAD = {
    "status": "000",
    "message": "정상",
    "list": [
        {
            "corp_code": "00126380",
            "report_nm": "임원ㆍ주요주주특정증권등소유상황보고서",
            "rcept_dt": "20260726",
            "rcept_no": "20260726000123",
        }
    ],
}

SAMPLE_EMPTY_PAYLOAD = {"status": "013", "message": "조회된 데이터가 없습니다."}


def test_parse_corp_code_xml_skips_entries_without_stock_code():
    mapping = dart_disclosures.parse_corp_code_xml(SAMPLE_CORP_CODE_XML)
    assert mapping == {"005930": "00126380"}


def test_parse_disclosure_list_returns_items_on_success():
    items = dart_disclosures.parse_disclosure_list(SAMPLE_LIST_PAYLOAD)
    assert len(items) == 1
    assert items[0]["report_name"] == "임원ㆍ주요주주특정증권등소유상황보고서"
    assert items[0]["url"] == "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260726000123"


def test_parse_disclosure_list_returns_empty_when_no_data():
    assert dart_disclosures.parse_disclosure_list(SAMPLE_EMPTY_PAYLOAD) == []


def test_load_corp_code_map_uses_cache_when_present(tmp_path: Path):
    cache_path = tmp_path / "corp_code.json"
    cache_path.write_text(json.dumps({"005930": "00126380"}), encoding="utf-8")

    with patch.object(dart_disclosures, "_download_corp_code_map") as mocked_download:
        mapping = dart_disclosures.load_corp_code_map("dummy-key", cache_path)

    mocked_download.assert_not_called()
    assert mapping == {"005930": "00126380"}


def test_fetch_disclosures_for_tickers_skips_unknown_tickers(tmp_path: Path):
    cache_path = tmp_path / "corp_code.json"

    with patch.object(dart_disclosures, "load_corp_code_map", return_value={"005930": "00126380"}), patch.object(
        dart_disclosures, "fetch_equity_disclosures", return_value=[{"report_name": "test"}]
    ) as mocked_fetch:
        result = dart_disclosures.fetch_disclosures_for_tickers(
            "dummy-key", ["005930", "999999"], "20260701", "20260727", cache_path
        )

    mocked_fetch.assert_called_once_with("dummy-key", "00126380", "20260701", "20260727")
    assert result == {"005930": [{"report_name": "test"}]}
