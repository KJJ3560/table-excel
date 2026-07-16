"""MCP(Model Context Protocol) 도구를 사용하는 LangChain 에이전트 예제.

로컬 MCP 서버(mcp_server.py)를 서브프로세스로 띄워 도구 목록을 가져오고,
Claude 기반 에이전트가 그 도구를 호출해 질문에 답합니다.

참고: https://docs.langchain.com/oss/python/langchain/mcp

실행 전 준비:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY="your-key"

실행:
    python main.py               # 기본 질문 실행
    python main.py "질문 내용"    # 원하는 질문 실행
"""

import asyncio
import sys
from pathlib import Path

from langchain.agents import create_agent
from langchain_anthropic import ChatAnthropic
from langchain_mcp_adapters.client import MultiServerMCPClient

MCP_SERVER_PATH = str(Path(__file__).parent / "mcp_server.py")


async def build_agent():
    """로컬 math MCP 서버에 연결해 도구를 불러오고 에이전트를 구성한다."""
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
    model = ChatAnthropic(model="claude-sonnet-5", temperature=0)
    return create_agent(
        model,
        tools,
        system_prompt="당신은 친절한 한국어 도우미입니다. 필요하면 도구를 사용하고, 간결하게 답하세요.",
    )


async def run(question: str) -> str:
    agent = await build_agent()
    response = await agent.ainvoke({"messages": [{"role": "user", "content": question}]})
    return response["messages"][-1].content


def main():
    question = " ".join(sys.argv[1:]) or "3 더하기 5를 하고, 그 결과에 12를 곱하면 얼마야?"
    answer = asyncio.run(run(question))
    print(answer)


if __name__ == "__main__":
    main()
