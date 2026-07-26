"""统一 SSE 事件协议。

两域共享的事件定义 —— travel 域的富事件(travel_data/plan_update)与 data 域的
分析事件(chart/table)都归纳到同一套类型，前端只需实现一次消费逻辑。

对应原 gogo 的 11 种 SSE 事件 + dodo 的 AgentStreamEvent。
"""

from __future__ import annotations

import json
from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class SSEEventType(StrEnum):
    # 通用（两域）
    MESSAGE = "message"  # 流式文本增量
    THINKING = "thinking"  # 推理过程
    PROGRESS = "progress"  # 进度提示
    AGENT_SWITCH = "agent_switch"  # 编排层切换子 Agent
    USER_INTERACTION = "user_interaction"  # HITL：需用户输入
    SUGGESTIONS = "suggestions"  # 推荐后续问题
    INTERRUPTED = "interrupted"  # 被中断
    DONE = "done"  # 结束
    ERROR = "error"  # 错误
    # travel 域专属
    TRAVEL_DATA = "travel_data"  # 机票/酒店/火车结构化结果
    PLAN_UPDATE = "plan_update"  # 行程规划变更
    # data 域专属
    CHART = "chart"  # 图表 URL
    TABLE = "table"  # 查询结果表


class SSEEvent(BaseModel):
    event: SSEEventType
    data: dict[str, Any]

    def to_sse(self) -> dict[str, str]:
        """转成 sse-starlette 的 EventSourceResponse 所需 dict。"""
        return {
            "event": self.event.value,
            "data": json.dumps(self.data, ensure_ascii=False),
        }


def message(text: str) -> SSEEvent:
    return SSEEvent(event=SSEEventType.MESSAGE, data={"text": text})


def done(**extra: Any) -> SSEEvent:
    return SSEEvent(event=SSEEventType.DONE, data=extra)


def error(msg: str, code: int = 50000) -> SSEEvent:
    return SSEEvent(event=SSEEventType.ERROR, data={"code": code, "message": msg})
