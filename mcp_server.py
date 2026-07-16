"""로컬 MCP 서버 예제.

FastMCP로 만든 최소 stdio MCP 서버로, 덧셈/곱셈 도구를 제공합니다.
main.py가 이 서버를 서브프로세스로 실행해 도구를 가져다 씁니다.
"""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Math")


@mcp.tool()
def add(a: int, b: int) -> int:
    """두 수를 더합니다."""
    return a + b


@mcp.tool()
def multiply(a: int, b: int) -> int:
    """두 수를 곱합니다."""
    return a * b


if __name__ == "__main__":
    mcp.run(transport="stdio")
