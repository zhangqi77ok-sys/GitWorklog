"""LLM 智能网关服务：动态路由解析、多厂商适配与连通性测试。"""

from __future__ import annotations

import time

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.platform.gateway.defaults import PRESET_PROVIDERS, PRESET_ROUTES
from app.platform.gateway.models import LLMProviderRecord, LLMRouteRecord


def init_gateway_defaults(session: Session) -> None:
    """初始化预置厂商与功能路由配置（幂等）。"""
    # 1. 预置厂商
    for p in PRESET_PROVIDERS:
        existing = session.execute(
            select(LLMProviderRecord).where(LLMProviderRecord.provider_code == p["provider_code"])
        ).scalar_one_or_none()

        default_key = ""
        # 若为百炼/DeepSeek且配置有环境变量 Key，则预填
        if p["provider_code"] == "dashscope":
            default_key = settings.llm.dashscope_api_key or ""
        elif p["provider_code"] == "deepseek":
            default_key = settings.llm.deepseek_api_key or ""

        if not existing:
            rec = LLMProviderRecord(
                provider_code=p["provider_code"],
                name=p["name"],
                base_url=p["base_url"],
                api_key=default_key,
                protocol=p.get("protocol", "openai"),
                enabled=1,
            )
            session.add(rec)
        elif not existing.api_key and default_key:
            existing.api_key = default_key

    # 2. 预置功能路由
    for r in PRESET_ROUTES:
        existing_route = session.execute(
            select(LLMRouteRecord).where(LLMRouteRecord.feature_key == r["feature_key"])
        ).scalar_one_or_none()

        if not existing_route:
            route_rec = LLMRouteRecord(
                feature_key=r["feature_key"],
                feature_name=r["feature_name"],
                provider_code=r["provider_code"],
                model_name=r["model_name"],
                temperature=r["temperature"],
                max_tokens=r["max_tokens"],
            )
            session.add(route_rec)

    session.commit()


def list_providers(session: Session) -> list[LLMProviderRecord]:
    init_gateway_defaults(session)
    return list(
        session.execute(select(LLMProviderRecord).order_by(LLMProviderRecord.id.asc()))
        .scalars()
        .all()
    )


def update_provider(
    session: Session,
    provider_code: str,
    base_url: str | None = None,
    api_key: str | None = None,
    enabled: int | None = None,
) -> LLMProviderRecord | None:
    rec = session.execute(
        select(LLMProviderRecord).where(LLMProviderRecord.provider_code == provider_code)
    ).scalar_one_or_none()
    if not rec:
        return None

    if base_url is not None:
        rec.base_url = base_url.strip()
    if api_key is not None:
        rec.api_key = api_key.strip()
    if enabled is not None:
        rec.enabled = enabled

    session.commit()
    return rec


def list_routes(session: Session) -> list[LLMRouteRecord]:
    init_gateway_defaults(session)
    return list(
        session.execute(select(LLMRouteRecord).order_by(LLMRouteRecord.id.asc())).scalars().all()
    )


def update_route(
    session: Session,
    feature_key: str,
    provider_code: str,
    model_name: str,
    temperature: float = 0.7,
    max_tokens: int = 2048,
) -> LLMRouteRecord | None:
    rec = session.execute(
        select(LLMRouteRecord).where(LLMRouteRecord.feature_key == feature_key)
    ).scalar_one_or_none()
    if not rec:
        return None

    rec.provider_code = provider_code
    rec.model_name = model_name
    rec.temperature = temperature
    rec.max_tokens = max_tokens

    session.commit()
    return rec


def get_model_for_feature(
    session: Session,
    feature_key: str = "chat_default",
    streaming: bool = True,
) -> BaseChatModel:
    """根据功能槽位动态路由获取 LangChain LLM 实例。"""
    init_gateway_defaults(session)

    route = session.execute(
        select(LLMRouteRecord).where(LLMRouteRecord.feature_key == feature_key)
    ).scalar_one_or_none()

    provider_code = route.provider_code if route else "dashscope"
    model_name = route.model_name if route else "qwen3.7-flash"
    temperature = route.temperature if route else 0.7
    max_tokens = route.max_tokens if route else 2048

    provider = session.execute(
        select(LLMProviderRecord).where(LLMProviderRecord.provider_code == provider_code)
    ).scalar_one_or_none()

    base_url = provider.base_url if provider else settings.llm.dashscope_base_url
    api_key = (
        provider.api_key if provider and provider.api_key else settings.llm.dashscope_api_key
    ) or "mock-key"

    return ChatOpenAI(
        model=model_name,
        openai_api_key=api_key,
        openai_api_base=base_url,
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=streaming,
    )


def test_provider_connectivity(
    session: Session,
    provider_code: str,
    model_name: str | None = None,
) -> tuple[bool, str, float]:
    """测试指定厂商模型的连通性与网络延迟。"""
    provider = session.execute(
        select(LLMProviderRecord).where(LLMProviderRecord.provider_code == provider_code)
    ).scalar_one_or_none()
    if not provider:
        return False, "未找到该厂商配置", 0.0

    if not provider.api_key and provider_code != "ollama":
        return False, "尚未配置 API Key，请先填写并保存", 0.0

    target_model = model_name or "qwen3.7-flash"
    # 根据厂商匹配默认探测模型
    if not model_name:
        for p in PRESET_PROVIDERS:
            if p["provider_code"] == provider_code and p["models"]:
                target_model = p["models"][0]["id"]
                break

    start_time = time.time()
    try:
        llm = ChatOpenAI(
            model=target_model,
            openai_api_key=provider.api_key or "mock",
            openai_api_base=provider.base_url,
            temperature=0.0,
            max_tokens=10,
            timeout=8.0,
        )
        res = llm.invoke("Hi")
        latency_ms = round((time.time() - start_time) * 1000, 1)
        return (
            True,
            f"连通成功！模型响应: {str(res.content)[:40]}... (耗时 {latency_ms}ms)",
            latency_ms,
        )
    except Exception as e:
        latency_ms = round((time.time() - start_time) * 1000, 1)
        return False, f"探测失败: {e} (耗时 {latency_ms}ms)", latency_ms
