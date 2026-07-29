# Todo 리스트 앱

브라우저 localStorage에 데이터를 저장하는 개인용 Todo 리스트 앱입니다.
순수 HTML/CSS/JavaScript로 만들어 빌드 과정 없이 바로 실행됩니다.
요구사항은 `PRD.md`를 참고하세요.

## 구조

```
index.html   화면 마크업
style.css    스타일
script.js    할 일 CRUD, 카테고리, 진행률, localStorage 연동 로직
```

## 실행

`index.html`을 브라우저로 열면 바로 사용할 수 있습니다. 또는 간단한
정적 서버로 실행해도 됩니다:

```bash
npx serve .
# 또는
python3 -m http.server
```

## 기타

- `main.py`, `requirements.txt` — 이 저장소에 남아있는 별도의 LangChain 최소
  예제 스크립트입니다 (`python main.py`로 실행, Todo 앱과는 무관).
