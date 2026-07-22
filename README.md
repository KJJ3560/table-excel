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

## DART 대량보유 상황보고(5% 룰) 조회

지분공시 종합정보 중 "대량보유 상황보고"(5% 이상 지분 변동) 공시를 조회해 엑셀로 저장합니다.
5% 이상 지분 종목은 변동이 생길 때마다 며칠 내로 새 공시가 올라오므로, 아래 명령을
주기적으로 실행하면 그 변동을 자동으로 추적할 수 있습니다.

```bash
export DART_API_KEY="your-key"   # https://opendart.fss.or.kr 에서 발급

python dart_report.py                                 # 최근 3일간 시장 전체 신규 공시
python dart_report.py --days 7                         # 최근 7일간 시장 전체
python dart_report.py --company 삼성전자                # 최근 3일간 해당 회사만
python dart_report.py --company 삼성전자 --full-history # 해당 회사 전체 이력(현재 5% 이상 보유자 파악용)
```

## 구성

- `main.py` — `ChatPromptTemplate | ChatAnthropic | StrOutputParser` 체인
- `dart_client.py` — DART Open API 래퍼 (고유번호 조회/캐시, 대량보유 상황보고, 공시검색)
- `dart_report.py` — 조회 결과를 xlsx로 저장하는 CLI
- `requirements.txt` — 필요한 패키지
