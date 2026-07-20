"""가장 간단한 LangChain 예제.

프롬프트 -> LLM -> 문자열 출력으로 이어지는 최소 LCEL 체인을 만들고 실행합니다.

실행 전 준비:
    pip install -r requirements.txt
    export ANTHROPIC_API_KEY="your-key"

실행:
    python main.py               # 기본 질문 실행
    python main.py "질문 내용"    # 원하는 질문 실행
"""

import sys

from langchain_anthropic import ChatAnthropic
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate


def build_chain():
    """프롬프트 -> 모델 -> 출력 파서로 구성된 가장 단순한 체인을 반환한다."""
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "당신은 친절한 한국어 도우미입니다. 간결하게 답하세요."),
            ("human", "{question}"),
        ]
    )
    model = ChatAnthropic(model="claude-sonnet-5", temperature=0)
    return prompt | model | StrOutputParser()


def main():
    question = " ".join(sys.argv[1:]) or "LangChain이 뭔지 한 문장으로 설명해줘."
    chain = build_chain()
    answer = chain.invoke({"question": question})
    print(answer)


if __name__ == "__main__":
    main()
