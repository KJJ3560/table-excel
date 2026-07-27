"""DART(전자공시시스템) Open API에서 지분공시(대량보유상황보고서 등)를 조회한다.

`DART_API_KEY`가 설정된 경우에만 사용되는 선택 기능이다. 외국인 지분율 상위
종목 각각에 대해 최근 지분공시(공시유형 D)가 있는지 확인해 리포트/이메일에
근거 정보로 덧붙인다.
"""

from __future__ import annotations

import io
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import requests

CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
DISCLOSURE_LIST_URL = "https://opendart.fss.or.kr/api/list.json"
EQUITY_DISCLOSURE_TYPE = "D"  # 지분공시(대량보유상황보고서, 임원ㆍ주요주주 소유보고 등)
_TIMEOUT_SECONDS = 30


def _download_corp_code_map(api_key: str) -> dict[str, str]:
    """DART의 전체 corp_code.xml(zip)을 내려받아 {종목코드: corp_code} 매핑을 만든다."""
    response = requests.get(CORP_CODE_URL, params={"crtfc_key": api_key}, timeout=_TIMEOUT_SECONDS)
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        xml_bytes = archive.read(archive.namelist()[0])
    return parse_corp_code_xml(xml_bytes)


def parse_corp_code_xml(xml_bytes: bytes) -> dict[str, str]:
    root = ET.fromstring(xml_bytes)
    mapping: dict[str, str] = {}
    for item in root.findall("list"):
        stock_code = (item.findtext("stock_code") or "").strip()
        corp_code = (item.findtext("corp_code") or "").strip()
        if stock_code:
            mapping[stock_code] = corp_code
    return mapping


def load_corp_code_map(api_key: str, cache_path: Path, force_refresh: bool = False) -> dict[str, str]:
    """corp_code 매핑을 로컬에 캐시해 두고 재사용한다(전 종목 약 3,000건, 자주 바뀌지 않음)."""
    if cache_path.exists() and not force_refresh:
        return json.loads(cache_path.read_text(encoding="utf-8"))

    mapping = _download_corp_code_map(api_key)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(mapping, ensure_ascii=False), encoding="utf-8")
    return mapping


def parse_disclosure_list(payload: dict) -> list[dict]:
    if payload.get("status") != "000":
        return []
    return [
        {
            "report_name": item["report_nm"],
            "receipt_date": item["rcept_dt"],
            "url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={item['rcept_no']}",
        }
        for item in payload.get("list", [])
    ]


def fetch_equity_disclosures(api_key: str, corp_code: str, begin_date: str, end_date: str) -> list[dict]:
    """특정 corp_code의 지분공시 목록을 조회한다."""
    response = requests.get(
        DISCLOSURE_LIST_URL,
        params={
            "crtfc_key": api_key,
            "corp_code": corp_code,
            "bgn_de": begin_date,
            "end_de": end_date,
            "pblntf_ty": EQUITY_DISCLOSURE_TYPE,
            "page_count": 100,
        },
        timeout=_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return parse_disclosure_list(response.json())


def fetch_disclosures_for_tickers(
    api_key: str,
    tickers: list[str],
    begin_date: str,
    end_date: str,
    cache_path: Path,
) -> dict[str, list[dict]]:
    """여러 종목코드에 대해 최근 지분공시를 조회한다. 공시가 없는 종목은 결과에서 제외한다."""
    corp_map = load_corp_code_map(api_key, cache_path)
    results: dict[str, list[dict]] = {}
    for ticker in tickers:
        corp_code = corp_map.get(ticker)
        if not corp_code:
            continue
        disclosures = fetch_equity_disclosures(api_key, corp_code, begin_date, end_date)
        if disclosures:
            results[ticker] = disclosures
    return results
