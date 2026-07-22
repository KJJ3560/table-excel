"""DART(전자공시시스템) Open API 클라이언트.

지분공시 종합정보 중 "대량보유 상황보고"(5% 이상 지분 변동, 이른바 '5%룰') 공시를
조회하기 위한 최소 래퍼입니다.

공식 가이드: https://opendart.fss.or.kr/guide/main.do
- 공시정보 > 공시검색 (list.json, pblntf_detail_ty=D001)
- 공시정보 > 고유번호 (corpCode.xml)
- 지분공시 종합정보 > 대량보유 상황보고 (majorstock.json)
"""

from __future__ import annotations

import io
import os
import time
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import requests

BASE_URL = "https://opendart.fss.or.kr/api"
CACHE_DIR = Path(__file__).resolve().parent / ".dart_cache"
CORP_CODE_CACHE = CACHE_DIR / "CORPCODE.xml"
CORP_CODE_MAX_AGE_SECONDS = 7 * 24 * 3600


class DartApiError(RuntimeError):
    """DART API가 오류 status를 반환할 때 (데이터 없음 '013'은 예외로 취급하지 않음)."""


def _api_key(api_key: str | None) -> str:
    key = api_key or os.environ.get("DART_API_KEY")
    if not key:
        raise DartApiError(
            "DART_API_KEY가 설정되어 있지 않습니다. "
            "환경변수로 지정하거나 api_key 인자로 전달하세요."
        )
    return key


def _get(path: str, api_key: str | None = None, **params: Any) -> dict:
    query = {
        "crtfc_key": _api_key(api_key),
        **{k: v for k, v in params.items() if v is not None},
    }
    resp = requests.get(f"{BASE_URL}/{path}", params=query, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    status = data.get("status")
    if status == "013":  # 조회된 데이터가 없습니다
        return {**data, "list": []}
    if status != "000":
        raise DartApiError(f"DART API 오류 [{status}]: {data.get('message')}")
    return data


def get_corp_codes(api_key: str | None = None, force_refresh: bool = False) -> list[dict]:
    """DART에 등록된 전체 회사의 고유번호/회사명/종목코드 목록을 반환한다 (로컬 캐시 사용)."""
    is_fresh = (
        CORP_CODE_CACHE.exists()
        and time.time() - CORP_CODE_CACHE.stat().st_mtime < CORP_CODE_MAX_AGE_SECONDS
    )
    if not force_refresh and is_fresh:
        xml_bytes = CORP_CODE_CACHE.read_bytes()
    else:
        resp = requests.get(
            f"{BASE_URL}/corpCode.xml",
            params={"crtfc_key": _api_key(api_key)},
            timeout=60,
        )
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            xml_bytes = zf.read("CORPCODE.xml")
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        CORP_CODE_CACHE.write_bytes(xml_bytes)

    root = ET.fromstring(xml_bytes)
    return [
        {child.tag: (child.text or "").strip() for child in item}
        for item in root.findall(".//list")
    ]


def find_corp_codes(name: str, api_key: str | None = None) -> list[dict]:
    """회사명(부분일치) 또는 종목코드(완전일치)로 corp_code 후보를 찾는다."""
    name = name.strip()
    corps = get_corp_codes(api_key=api_key)
    if name.isdigit():
        return [c for c in corps if c.get("stock_code") == name]
    return [c for c in corps if name in (c.get("corp_name") or "")]


def get_major_holding_reports(corp_code: str, api_key: str | None = None) -> list[dict]:
    """특정 회사의 대량보유 상황보고(5%룰) 전체 이력을 반환한다.

    반환되는 각 건에는 보고자(repror), 보유주식수(stkqy), 보유비율(stkrt) 등
    DART가 제공하는 필드가 그대로 담겨 있어, 한 회사에 현재 누가 5% 이상
    보유 중인지 추적할 수 있다.
    """
    data = _get("majorstock.json", api_key=api_key, corp_code=corp_code)
    return data.get("list", [])


def search_major_holding_filings(
    bgn_de: str,
    end_de: str,
    corp_code: str | None = None,
    api_key: str | None = None,
) -> list[dict]:
    """기간 내 새로 접수된 '주식등의대량보유상황보고서'를 검색한다.

    corp_code를 생략하면 시장 전체를 대상으로 검색하므로, 특정 종목을 미리
    알 필요 없이 "최근 며칠간 어떤 5% 변동 공시가 새로 올라왔는지"를 그대로
    자동화할 수 있다 (공시정보 > 공시검색, pblntf_detail_ty=D001).
    """
    results: list[dict] = []
    page_no = 1
    while True:
        data = _get(
            "list.json",
            api_key=api_key,
            corp_code=corp_code,
            bgn_de=bgn_de,
            end_de=end_de,
            pblntf_detail_ty="D001",
            sort="date",
            sort_mth="desc",
            page_no=page_no,
            page_count=100,
        )
        page = data.get("list", [])
        results.extend(page)
        total_page = int(data.get("total_page", 0) or 0)
        if page_no >= total_page:
            break
        page_no += 1
    return results


def filing_view_url(rcept_no: str) -> str:
    """접수번호로 DART 공시 원문 뷰어 URL을 만든다."""
    return f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"
