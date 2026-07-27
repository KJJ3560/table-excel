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

---

# 외국인 지분율 상위 50 추적 & 변동률 알림

코스피/코스닥 종목의 외국인 지분율 상위 50개를 조사하고, 전일 대비 변동률을
계산해 엑셀 리포트로 저장한 뒤 이메일로 알려주는 스크립트입니다.

## 동작 방식

1. [pykrx](https://github.com/sharebook-kr/pykrx)로 KRX의 외국인보유량 데이터를
   코스피/코스닥 시장별로 조회합니다 (로그인 없이도 동작하며, 별도 API 키가
   필요 없습니다).
2. 시장별로 외국인 지분율 상위 N개(기본 50개)를 뽑습니다.
3. `data/history_KOSPI.csv`, `data/history_KOSDAQ.csv`에 실행할 때마다 스냅샷을
   누적 저장하고, 가장 최근 스냅샷과 비교해 지분율 변동폭(%p)과 순위 변동을
   계산합니다. (처음 실행하거나 신규 진입 종목은 비교 대상이 없어 변동값이
   비어 있습니다.)
4. `DART_API_KEY` 환경변수가 설정되어 있으면, [DART Open API](https://opendart.fss.or.kr/)에서
   최근 며칠 간의 지분공시(대량보유상황보고서, 임원ㆍ주요주주 소유보고 등)를
   조회해 상위 50 종목에 매칭되는 공시가 있으면 리포트/이메일에 함께 표시합니다.
   (선택 기능이며, 키가 없으면 건너뜁니다.)
5. `output/foreign_ownership_top50_YYYYMMDD.xlsx`로 시장별 시트를 가진 엑셀
   리포트를 생성합니다. 지분율 상승은 빨간색, 하락은 파란색으로 표시됩니다.
6. 이메일 발송을 켜두면(기본값) 상승/하락 상위 종목 요약과 리포트 파일을
   첨부해 이메일로 발송합니다.

## 설치

```bash
pip install -r requirements.txt
```

## 환경변수

| 변수 | 필수 여부 | 설명 |
| --- | --- | --- |
| `REPORT_GMAIL_ADDRESS` | 이메일 발송 시 필수 | 발신용 Gmail 주소 |
| `REPORT_GMAIL_APP_PASSWORD` | 이메일 발송 시 필수 | Gmail [앱 비밀번호](https://myaccount.google.com/apppasswords) (일반 로그인 비밀번호 아님) |
| `REPORT_RECIPIENT_EMAIL` | 이메일 발송 시 필수 | 리포트를 받을 이메일 주소 |
| `DART_API_KEY` | 선택 | [DART Open API](https://opendart.fss.or.kr/) 인증키. 설정하면 상위 50 종목의 최근 지분공시를 함께 알려줍니다 |
| `KRX_ID`, `KRX_PW` | 선택 | data.krx.co.kr 회원 계정. 로그인 없이도 동작하지만, 설정하면 pykrx가 인증 세션으로 더 안정적으로 조회합니다 |

## 실행

```bash
# 오늘(주말이면 직전 영업일) 기준 상위 50 리포트를 생성하고 이메일 발송
python -m foreign_ownership

# 특정 날짜 기준 조회
python -m foreign_ownership --date 20260724

# 상위 개수 조정
python -m foreign_ownership --top-n 30

# 이메일 없이 엑셀 리포트만 생성
python -m foreign_ownership --no-email
```

## 매일 자동 실행하기 (cron 예시)

GitHub Actions 없이 사용자 환경(본인 서버/PC)에서 매일 평일 오후 4시(장 마감 후)에
자동 실행하려면 crontab에 다음과 같이 등록합니다.

```cron
0 16 * * 1-5 cd /path/to/table-excel && \
  REPORT_GMAIL_ADDRESS=... REPORT_GMAIL_APP_PASSWORD=... REPORT_RECIPIENT_EMAIL=... \
  DART_API_KEY=... /path/to/venv/bin/python -m foreign_ownership >> logs/foreign_ownership.log 2>&1
```

민감한 값은 crontab에 직접 쓰지 말고 `.env` 파일이나 시스템 환경변수로 관리하는
것을 권장합니다.

## 테스트

네트워크 호출(KRX, DART)이 필요 없는 순수 로직(변동률 계산, 엑셀 리포트 생성,
DART 응답 파싱)은 유닛 테스트로 검증되어 있습니다.

```bash
pytest tests/
```

## 참고 사항

- 이 저장소를 개발한 샌드박스 환경은 보안 정책상 `data.krx.co.kr`, `opendart.fss.or.kr`
  등 외부 사이트로 직접 접속할 수 없어, 실제 KRX/DART 데이터를 이용한 종단 간(end-to-end)
  테스트는 이 환경에서 수행하지 못했습니다. 순수 로직은 유닛 테스트로 검증했으며,
  실제 데이터 조회는 인터넷 접속이 가능한 환경(본인 PC/서버)에서 한 번 실행해
  확인해 보시길 권장합니다.
- `pykrx`가 반환하는 컬럼명(예: `보유수량`, `한도소진률`)은 라이브러리 버전에 따라
  달라질 수 있습니다. 실행 중 오류가 발생하면 `foreign_ownership/fetch.py`의
  컬럼 매핑을 설치된 pykrx 버전에 맞게 확인해 주세요.
