"""通用工具装配（两域共享，去重）：把普通函数转成 LangChain 工具。

data / travel 域的工具都是「返回 str 的普通方法」，此处统一用
StructuredTool.from_function 包装成 LangChain BaseTool，供 create_react_agent 使用。
LangChain 从函数签名 + docstring 自动推断参数 schema。
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any


def build_tools(callables: dict[str, Callable[..., str]]) -> list[Any]:
    """把 {name: fn} 转成 LangChain 工具列表。

    fn 需有类型注解与 docstring（LangChain 据此生成工具 schema，LLM 会读）。
    """
    from langchain_core.tools import StructuredTool

    tools: list[Any] = []
    for name, fn in callables.items():
        tools.append(
            StructuredTool.from_function(
                func=fn,
                name=name,
                description=(fn.__doc__ or "").strip(),
            )
        )
    return tools
