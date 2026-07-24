# 나만의 시작 페이지

오늘의 날씨와 주요 뉴스를 한눈에 보여주는 개인 시작 페이지입니다. 브라우저의
새 탭/홈 화면 대신 열어두고 쓸 수 있습니다.

## 기능

- 실시간 시계·날짜, 시간대별 인사말
- 오늘의 날씨: 브라우저 위치 권한을 허용하면 현재 위치 기준, 거부/실패 시 서울
  기준으로 표시 ([Open-Meteo](https://open-meteo.com) API 사용, API 키 불필요)
- 주요 뉴스: Google 뉴스·연합뉴스 RSS를 모아 최신순으로 표시 (10분 캐시)
- 라이트/다크 모드 자동 대응, 모바일에서도 보기 좋은 반응형 레이아웃

## 설치 및 실행

```bash
cd homepage
pip install -r requirements.txt
python server.py
```

브라우저에서 http://localhost:8000 접속.

## 브라우저 시작 페이지로 쓰기

`python server.py`가 실행 중인 동안에는 브라우저 설정에서
`http://localhost:8000`을 시작 페이지/새 탭 페이지로 지정해 사용할 수 있습니다.
컴퓨터를 켤 때마다 자동으로 서버가 뜨게 하려면 OS의 로그인 시 실행 프로그램
목록에 위 실행 명령을 등록하세요.

## 구성

- `server.py` — FastAPI 앱. 정적 프론트엔드를 서빙하고, RSS를 모아 JSON으로
  내려주는 `/api/news`를 제공합니다. 날씨는 프론트엔드가 Open-Meteo를 직접
  호출하므로 별도 프록시가 없습니다.
- `static/index.html`, `static/styles.css`, `static/app.js` — 프론트엔드
- `requirements.txt` — `fastapi`, `uvicorn`, `httpx`, `feedparser`

## 뉴스 소스 바꾸기

`server.py`의 `NEWS_SOURCES` 목록에 `(표시 이름, RSS URL)` 튜플을 추가하거나
교체하면 됩니다. 하나의 피드가 실패해도 나머지 피드로 계속 동작합니다.

## 참고

- 날씨: Open-Meteo — 비상업적 용도로 하루 10,000회까지 무료, 인증 불필요
- 위치 이름 표시는 BigDataCloud의 클라이언트용 역지오코딩을 사용하며, 실패해도
  좌표 기반 날씨 조회 자체는 정상 동작합니다.
