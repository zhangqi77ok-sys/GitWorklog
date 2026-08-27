"""O-5 查询改写：多轮对话里的指代消解与上下文补全。

「帮我订去上海的机票」→「它多少钱」，第二句单独看毫无意图信号，
规则和向量都判不出来，必须先借上一轮补全成「去上海的机票多少钱」。

省钱省延迟的关键在 needs_rewrite()：绝大多数输入是自足的，
只有**同时**满足「有历史」「短」「含指代词或省略特征」才值得调模型。
无历史、无模型、模型出错一律原样返回——改写是增强，不是必经之路。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.logging import get_logger

logger = get_logger(__name__)

# 指代词与省略信号。命中说明这句话可能依赖上文。
_REFERENCE_MARKERS = (
    "它",
    "他",
    "她",
    "这个",
    "那个",
    "这些",
    "那些",
    "此",
    "该",
    "上面",
    "刚才",
    "刚刚",
    "前面",
    "同样",
    "一样",
    "再来",
    "还有呢",
)

# 纯追问式短句（无主语的疑问），如「多少钱」「什么时候」
_ELLIPSIS_PATTERN = re.compile(
    r"^(多少钱|多少|几点|什么时候|怎么样|为什么|哪个|哪些|可以吗|行吗|呢)[?？。！!]*$"
)

# 超过这个长度基本是自足表达，不必改写
MAX_REWRITE_CHARS = 20


class QueryRewriter(Protocol):
    def rewrite(self, query: str, history: list[dict[str, str]]) -> str: ...


def needs_rewrite(query: str, history: list[dict[str, str]]) -> bool:
    """判断这句是否依赖上文。无历史一律 False——没有上文可参照。"""
    if not history:
        return False
    q = query.strip()
    if not q or len(q) > MAX_REWRITE_CHARS:
        return False
    if _ELLIPSIS_PATTERN.match(q):
        return True
    return any(mark in q for mark in _REFERENCE_MARKERS)


_PROMPT = """把用户最后一句话改写成不依赖上文、可独立理解的完整问题。

要求：
- 只补全指代和省略，不要新增用户没表达的信息
- 不要回答问题，只输出改写后的那一句
- 如果本来就完整，原样输出

对话历史：
{history}

最后一句：{query}

改写结果："""


@dataclass
class LLMQueryRewriter:
    """满足 QueryRewriter 协议。用 FAST 模型；任何异常都退回原句。"""

    model: Any = None
    max_history: int = 4  # 只带最近几轮，避免 prompt 膨胀
    _resolved: bool = field(default=False, init=False)

    def _get_model(self) -> Any | None:
        if self._resolved:
            return self.model
        self._resolved = True
        if self.model is None:
            from app.platform.llm.models import ModelNotConfiguredError, build_chat_model
            from app.platform.llm.provider import ModelRole

            try:
                self.model = build_chat_model(ModelRole.FAST)
            except ModelNotConfiguredError:
                logger.info("query_rewrite_model_not_configured")
                self.model = None
        return self.model

    def rewrite(self, query: str, history: list[dict[str, str]]) -> str:
        if not needs_rewrite(query, history):
            return query
        model = self._get_model()
        if model is None:
            return query

        recent = history[-self.max_history :]
        rendered = "\n".join(f"{m.get('role', '?')}: {m.get('content', '')}" for m in recent)
        try:
            resp = model.invoke(_PROMPT.format(history=rendered, query=query))
        except Exception as exc:  # 宽捕获是刻意的：改写失败不该阻断提问
            logger.warning("query_rewrite_failed", error=str(exc))
            return query

        text = str(getattr(resp, "content", resp)).strip()
        if not text:
            return query
        # 模型偶尔会回多行解释，取第一行非空
        first = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
        if not first:
            return query
        logger.info("query_rewritten", original=query, rewritten=first)
        return first
