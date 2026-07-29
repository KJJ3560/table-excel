# Todo 리스트 앱

브라우저 localStorage에 데이터를 저장하는 개인용 Todo 리스트 웹앱입니다.
요구사항은 `PRD.md`, 구현 순서는 `PROMPT_PLAN.md`를 참고하세요.

## 구조

```
frontend/   React + Vite + TypeScript 프론트엔드 (실제 UI, localStorage 연동)
backend/    Express 서버 (frontend 빌드 결과물을 정적으로 서빙)
```

## 개발 실행

```bash
npm run install:all   # frontend, backend 의존성 설치
npm run dev            # frontend 개발 서버 실행 (http://localhost:5173)
```

## 프로덕션 빌드 실행

```bash
npm run build   # frontend를 frontend/dist로 빌드
npm start        # frontend 빌드 후 backend가 정적으로 서빙 (http://localhost:3000)
```

## 기타

- `main.py`, `requirements.txt` — 이 저장소에 남아있는 별도의 LangChain 최소
  예제 스크립트입니다 (`python main.py`로 실행, Todo 앱과는 무관).
