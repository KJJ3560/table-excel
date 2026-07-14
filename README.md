# LangChain 최소 예제

LangChain으로 만든 가장 간단한 예제입니다. `프롬프트 → LLM → 출력 파서`로
이어지는 최소 LCEL 체인 하나를 만들어 실행합니다.

## 설치

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY="your-key"
```

## 실행

```bash
python main.py                # 기본 질문 실행
python main.py "질문 내용"     # 원하는 질문 실행
```

## 구성

- `main.py` — `ChatPromptTemplate | ChatAnthropic | StrOutputParser` 체인
- `requirements.txt` — 필요한 패키지
