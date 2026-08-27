"""通用工具装配（两域共享，去重）：把普通函数转成 LangChain 工具。

data / travel 域的工具都是「返回 str 的普通方法」，此处统一用
StructuredTool.from_function 包装成 LangChain BaseTool，供 create_react_agent 使用。
LangChain 从函数签名 + docstring 自动推断参数 schema。

这里也是接 H2 工具熔断的位置：两域所有工具都从这一个入口装配，
包一层即可获得按工具维度的熔断，无需侵入 LangGraph 内部。
"""

from __future__ import annotations

import functools
from collections.abc import Callable
from typing import Any

from app.core.logging import get_logger
from app.platform.hooks.circuit_breaker import CircuitBreaker

logger = get_logger(__name__)


def _default_clock() -> float:
    import time

    return time.monotonic()


def _guard(
    name: str,
    fn: Callable[..., str],
    breaker: CircuitBreaker,
    clock: Callable[[], float],
) -> Callable[..., str]:
    """给单个工具函数套上熔断。

    熔断开启或调用失败都**返回提示文本而非抛异常**——遵循本仓库
    「错误变成工具输出，让 LLM 看到并自行调整」的约定（见 data/tools/text2sql.py）。
    functools.wraps 保住 __doc__ 与 __wrapped__，StructuredTool 靠签名推 schema，不能破坏。
    """

    @functools.wraps(fn)
    def _wrapped(*args: Any, **kwargs: Any) -> str:
        now = clock()
        if not breaker.allow(name, now):
            logger.warning("tool_circuit_open", tool=name)
            return f"工具 {name} 当前不可用（连续失败已熔断），请稍后重试或改用其他方式。"
        try:
            result = fn(*args, **kwargs)
        except Exception as exc:  # 宽捕获是刻意的：转成工具输出交还给 LLM
            breaker.on_failure(name, clock())
            logger.warning("tool_call_failed", tool=name, error=str(exc))
            return f"工具 {name} 执行失败：{exc}"
        breaker.on_success(name)
        return result

    return _wrapped


def build_tools(
    callables: dict[str, Callable[..., str]],
    breaker: CircuitBreaker | None = None,
    clock: Callable[[], float] | None = None,
) -> list[Any]:
    """把 {name: fn} 转成 LangChain 工具列表。

    fn 需有类型注解与 docstring（LangChain 据此生成工具 schema，LLM 会读）。
    传入 breaker 则每个工具获得独立熔断计数；不传则行为与包装前完全一致。
    """
    from langchain_core.tools import StructuredTool

    tick = clock or _default_clock
    tools: list[Any] = []
    for name, fn in callables.items():
        target = fn if breaker is None else _guard(name, fn, breaker, tick)
        tools.append(
            StructuredTool.from_function(
                func=target,
                name=name,
                description=(fn.__doc__ or "").strip(),
            )
        )
    return tools
