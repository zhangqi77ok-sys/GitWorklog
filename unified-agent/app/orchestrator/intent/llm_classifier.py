"""O-3 意图 L3 LLM 兜底：规则与向量都不命中时，让模型做结构化分类。

只在长尾上兜底，所以用 FAST 模型（意图判断不值得上强模型）。

置信度由模型自报并夹到 [0,1]：这样 O-7 的直跳判定对三层来源是同一套标准——
模型有把握就直投领域 Agent，含糊就走澄清，不需要为 LLM 来源单开一条规则。

解析刻意宽松：模型很可能回 "travel_booking (0.8)" 或带上解释文字，
从文本里捞已知类别 token + 首个浮点数即可，实在解析不出就退回 GENERAL_CHAT。
分类失败绝不外抛——L3 是兜底层，它挂了应当静默退化而不是让整条链路 500。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.core.logging import get_logger
from app.orchestrator.intent.models import IntentCategory, IntentResult, IntentSource

logger = get_logger(__name__)

_CATEGORIES = [c.value for c in IntentCategory]

_PROMPT = """你是意图分类器。把用户输入归到下列类别之一：
{categories}

规则：
- data_analysis：查数、统计、报表、趋势等对业务数据的分析请求
- travel_manage：差旅单的申请/查询/取消
- travel_plan：行程与路线的安排规划
- travel_booking：机票/酒店/火车的预订、改签、退票
- travel_reimburse：差旅报销、发票
- travel_info：差旅政策、标准、签证等信息查询
- general_chat：以上都不是

只输出一行：类别名|置信度(0到1的小数)
例如：travel_booking|0.85

用户输入：{query}"""


def _parse(text: str) -> tuple[IntentCategory, float]:
    """从模型输出里捞类别与置信度。解析不出按 GENERAL_CHAT/0 处理。"""
    lowered = text.lower()
    # 取最先出现的已知类别；general_chat 是兜底，优先匹配具体类别
    found: tuple[int, str] | None = None
    for cat in _CATEGORIES:
        idx = lowered.find(cat)
        if idx >= 0 and (found is None or idx < found[0]):
            found = (idx, cat)
    if found is None:
        return IntentCategory.GENERAL_CHAT, 0.0

    conf = 0.0
    m = re.search(r"(\d*\.\d+|[01])(?!\d)", lowered[found[0] + len(found[1]) :])
    if m:
        try:
            conf = max(0.0, min(1.0, float(m.group(1))))
        except ValueError:
            conf = 0.0
    return IntentCategory(found[1]), conf


@dataclass
class LLMIntentClassifierImpl:
    """满足 pipeline.LLMIntentClassifier 协议。model 可注入便于测试。"""

    model: Any = None
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
                logger.info("intent_l3_model_not_configured")
                self.model = None
        return self.model

    def classify(self, query: str) -> IntentResult:
        model = self._get_model()
        if model is None:
            return IntentResult.none()

        prompt = _PROMPT.format(categories="、".join(_CATEGORIES), query=query)
        try:
            resp = model.invoke(prompt)
        except Exception as exc:  # 宽捕获是刻意的：兜底层挂了应静默退化
            logger.warning("intent_l3_failed", error=str(exc))
            return IntentResult.none()

        content = getattr(resp, "content", resp)
        category, confidence = _parse(str(content))
        if category == IntentCategory.GENERAL_CHAT and confidence == 0.0:
            return IntentResult.none()

        logger.info("intent_l3_classified", category=category.value, confidence=confidence)
        return IntentResult(
            category=category,
            source=IntentSource.LLM,
            confidence=confidence,
        )
