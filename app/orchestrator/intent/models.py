"""意图识别数据模型（对应 gogo 的 IntentRecognitionResult / IntentCategory）。

三层识别（规则/向量/LLM）统一产出 IntentResult，携带来源与置信度，
供路由决策使用。类别在此集中定义，新增业务域时扩展。
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel


class IntentSource(StrEnum):
    RULE = "rule"  # L1 规则
    VECTOR = "vector"  # L2 向量
    LLM = "llm"  # L3 兜底
    NONE = "none"  # 未命中


class IntentCategory(StrEnum):
    """意图类别 = 路由目标。融合后两域的顶层意图。"""

    # data 域
    DATA_ANALYSIS = "data_analysis"  # 自然语言查数据
    # travel 域
    TRAVEL_MANAGE = "travel_manage"  # 差旅单管理
    TRAVEL_PLAN = "travel_plan"  # 行程规划
    TRAVEL_BOOKING = "travel_booking"  # 预订
    TRAVEL_REIMBURSE = "travel_reimburse"  # 报销
    TRAVEL_INFO = "travel_info"  # 政策/景点/签证信息
    # 通用
    GENERAL_CHAT = "general_chat"  # 通用对话（无明确业务意图）


class IntentResult(BaseModel):
    category: IntentCategory
    source: IntentSource
    confidence: float = 0.0  # 0~1

    @classmethod
    def none(cls) -> IntentResult:
        return cls(
            category=IntentCategory.GENERAL_CHAT,
            source=IntentSource.NONE,
            confidence=0.0,
        )
