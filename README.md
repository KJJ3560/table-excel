# LangChain MCP 최소 예제

LangChain에서 MCP(Model Context Protocol) 도구를 사용하는 최소 예제입니다.
로컬 MCP 서버가 제공하는 도구를 에이전트가 불러와 질문에 답하는 데 사용합니다.

참고: https://docs.langchain.com/oss/python/langchain/mcp

## 설치

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY="your-key"
```

## 실행

```bash
python main.py                                  # 기본 질문 실행
python main.py "7 더하기 3은 뭐고, 그 값에 4를 곱하면?"   # 원하는 질문 실행

python langgraph_example.py                      # StateGraph 버전 실행
```

## 구성

- `main.py` — `MultiServerMCPClient`로 로컬 MCP 서버에 연결해 도구를 가져오고,
  `create_agent`로 만든 Claude 기반 에이전트가 그 도구를 사용하도록 하는 스크립트
- `langgraph_example.py` — 같은 문제를 `langgraph.graph.StateGraph`로 직접 조립한 버전.
  `create_agent`가 내부적으로 구성하는 모델 노드 ↔ 도구 노드 조건부 라우팅을
  명시적으로 보여준다.
- `mcp_server.py` — `add`, `multiply` 도구를 제공하는 로컬 stdio MCP 서버
  (`mcp.server.fastmcp.FastMCP` 기반)
- `requirements.txt` — 필요한 패키지
