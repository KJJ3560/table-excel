"""오늘의 날씨와 주요 뉴스를 보여주는 개인 시작 페이지 백엔드.

정적 프론트엔드(static/)를 서빙하고, 뉴스 RSS를 모아 JSON으로 제공하는
/api/news 엔드포인트를 노출한다. 날씨는 프론트엔드가 Open-Meteo API를
직접 호출하므로(CORS 지원, API 키 불필요) 별도 프록시가 필요 없다.

실행:
    pip install -r requirements.txt
    python server.py
    # http://localhost:8000 접속
"""

import asyncio
import time
from pathlib import Path

import feedparser
import httpx
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# (표시용 이름, RSS 피드 URL). 필요하면 원하는 언론사 RSS로 자유롭게 교체/추가할 수 있다.
NEWS_SOURCES = [
    ("Google 뉴스", "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko"),
    ("연합뉴스", "https://www.yna.co.kr/rss/news.xml"),
]
NEWS_CACHE_TTL_SECONDS = 600
MAX_NEWS_ITEMS = 15
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

app = FastAPI(title="Start Homepage")

_news_cache: dict = {"items": [], "errors": [], "fetched_at": 0.0}
_news_cache_lock = asyncio.Lock()


def _entry_to_item(entry, source_label: str) -> dict | None:
    title = entry.get("title")
    link = entry.get("link")
    if not title or not link:
        return None

    published_struct = entry.get("published_parsed") or entry.get("updated_parsed")
    published_ts = time.mktime(published_struct) if published_struct else None

    source = entry.get("source")
    source_title = (source.get("title") if isinstance(source, dict) else None) or source_label

    return {
        "title": title,
        "link": link,
        "source": source_title,
        "published_ts": published_ts,
    }


async def _fetch_feed(client: httpx.AsyncClient, label: str, url: str) -> tuple[list[dict], str | None]:
    try:
        response = await client.get(url, headers=REQUEST_HEADERS, timeout=8.0, follow_redirects=True)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        return [], f"{label}: {exc}"

    parsed = feedparser.parse(response.content)
    items = [item for entry in parsed.entries if (item := _entry_to_item(entry, label))]
    if not items:
        return [], f"{label}: 기사를 찾을 수 없습니다"
    return items, None


async def _refresh_news() -> dict:
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *(_fetch_feed(client, label, url) for label, url in NEWS_SOURCES)
        )

    all_items: list[dict] = []
    errors: list[str] = []
    seen_links: set[str] = set()
    for items, error in results:
        if error:
            errors.append(error)
        for item in items:
            if item["link"] in seen_links:
                continue
            seen_links.add(item["link"])
            all_items.append(item)

    all_items.sort(key=lambda item: item["published_ts"] or 0, reverse=True)
    return {"items": all_items[:MAX_NEWS_ITEMS], "errors": errors, "fetched_at": time.time()}


@app.get("/api/news")
async def get_news():
    """캐시된(또는 새로 가져온) 주요 뉴스 목록을 반환한다."""
    async with _news_cache_lock:
        if time.time() - _news_cache["fetched_at"] < NEWS_CACHE_TTL_SECONDS:
            return _news_cache
        _news_cache.update(await _refresh_news())
        return _news_cache


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
