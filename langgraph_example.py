"""StateGraph를 직접 다루는 최소 LangGraph 예제.

main.py의 create_agent()가 내부적으로 감싸고 있는 그래프 구조(모델 노드와
도구 노드를 오가는 조건부 라우팅)를 StateGraph로 직접 조립합니다.
도구는 main.py와 동일하게 mcp_server.py가 제공하는 로컬 MCP 서버에서 가져옵니다.

참고: https://docs.langchain.com/oss/python/langchain/mcp

실행 전 준비:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY="your-key"

실행:
    python langgraph_example.py               # 기본 질문 실행
    python langgraph_example.py "질문 내용"    # 원하는 질문 실행
"""

import asyncio
import sys
from pathlib import Path

from langchain_anthropic import ChatAnthropic
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

MCP_SERVER_PATH = str(Path(__file__).parent / "mcp_server.py")
SYSTEM_PROMPT = "당신은 친절한 한국어 도우미입니다. 필요하면 도구를 사용하고, 간결하게 답하세요."


async def build_graph():
    """로컬 math MCP 서버에서 도구를 불러와 모델<->도구 노드로 구성된 그래프를 만든다."""
    client = MultiServerMCPClient(
        {
            "math": {
                "transport": "stdio",
                "command": sys.executable,
                "args": [MCP_SERVER_PATH],
            }
        }
    )
    tools = await client.get_tools()
    model = ChatAnthropic(model="claude-sonnet-5", temperature=0).bind_tools(tools)

    def call_model(state: MessagesState):
        response = model.invoke([("system", SYSTEM_PROMPT), *state["messages"]])
        return {"messages": [response]}

    builder = StateGraph(MessagesState)
    builder.add_node("call_model", call_model)
    builder.add_node("tools", ToolNode(tools))
    builder.add_edge(START, "call_model")
    builder.add_conditional_edges("call_model", tools_condition)
    builder.add_edge("tools", "call_model")
    return builder.compile()


async def run(question: str) -> str:
    graph = await build_graph()
    result = await graph.ainvoke({"messages": [{"role": "user", "content": question}]})
    return result["messages"][-1].content


def main():
    question = " ".join(sys.argv[1:]) or "3 더하기 5를 하고, 그 결과에 12를 곱하면 얼마야?"
    answer = asyncio.run(run(question))
    print(answer)


if __name__ == "__main__":
    main()
