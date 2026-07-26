"""LLM 模型工厂（LangChain ChatOpenAI，接 DashScope / DeepSeek 兼容端点）。

对应 gogo 的 Qwen 多 Bean + dodo 的 DeepSeek 主模型。DashScope 与 DeepSeek
均提供 OpenAI 兼容 API，统一用 langchain_openai.ChatOpenAI 按角色构建。
真实调用需 API Key；惰性构建，未配置时抛清晰错误。

需 live 验证：真实模型调用、流式。
"""

from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.platform.llm.provider import ModelRole

# OpenAI 兼容端点
_DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
_DEEPSEEK_BASE = "https://api.deepseek.com"


class ModelNotConfiguredError(RuntimeError):
    pass


def build_chat_model(role: ModelRole = ModelRole.STRONG) -> Any:
    """构建 LangChain ChatOpenAI。

    strong → DeepSeek（data 域复杂推理），无则回退 DashScope 强模型
    fast   → DashScope Qwen flash（意图/标题等轻量场景）
    延迟 import langchain_openai，避免无依赖环境导入即报错。
    """
    from langchain_openai import ChatOpenAI

    if role == ModelRole.FAST:
        if not settings.llm.dashscope_api_key:
            raise ModelNotConfiguredError("DASHSCOPE_API_KEY 未配置")
        return ChatOpenAI(
            model=settings.llm.fast_model,
            api_key=settings.llm.dashscope_api_key,
            base_url=_DASHSCOPE_BASE,
            streaming=True,
        )

    # STRONG（默认）
    if settings.llm.deepseek_api_key:
        return ChatOpenAI(
            model="deepseek-chat",
            api_key=settings.llm.deepseek_api_key,
            base_url=_DEEPSEEK_BASE,
            streaming=True,
        )
    if settings.llm.dashscope_api_key:
        return ChatOpenAI(
            model=settings.llm.strong_model,
            api_key=settings.llm.dashscope_api_key,
            base_url=_DASHSCOPE_BASE,
            streaming=True,
        )
    raise ModelNotConfiguredError("DEEPSEEK_API_KEY / DASHSCOPE_API_KEY 均未配置")
