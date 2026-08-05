# 상식 퀴즈 게임

4지선다 객관식 상식 퀴즈 게임입니다. 한국사/과학/지리/예술과 문화 4개
카테고리, 카테고리당 10문제씩 총 40문제로 구성됩니다. 순수 HTML/CSS/
JavaScript로 만들어 빌드 과정 없이 바로 실행됩니다. 요구사항은
`PRD.md`를 참고하세요.

## 구조 (구현 예정)

```
index.html     화면 마크업
style.css      스타일
script.js      퀴즈 진행, 채점, 순위 기록(localStorage) 로직
questions.js   문제 데이터(카테고리당 10문제, 총 40문제)
```

## 실행 (구현 후)

`index.html`을 브라우저로 열면 바로 사용할 수 있습니다. 또는 간단한
정적 서버로 실행해도 됩니다:

```bash
npx serve .
# 또는
python3 -m http.server
```
