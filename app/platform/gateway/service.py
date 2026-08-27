from __future__ import annotations

import json
import time
from typing import Any

import httpx
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session


from app.core.config import settings
from app.platform.gateway.defaults import OFFICIAL_SYNC_CATALOGS, PRESET_PROVIDERS, PRESET_ROUTES
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
                models_json=json.dumps(p.get("models", []), ensure_ascii=False),
            )
            session.add(rec)
        else:
            if not existing.api_key and default_key:
                existing.api_key = default_key
            if not existing.models_json or existing.models_json == "[]":
                existing.models_json = json.dumps(p.get("models", []), ensure_ascii=False)

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


def get_provider_models(session: Session, provider_code: str) -> list[dict[str, str]]:
    """获取指定厂商合并后的完整模型列表（预置 + 官方同步 + 用户自定义）。"""
    init_gateway_defaults(session)
    provider = session.execute(
        select(LLMProviderRecord).where(LLMProviderRecord.provider_code == provider_code)
    ).scalar_one_or_none()

    preset_map = {p["provider_code"]: p.get("models", []) for p in PRESET_PROVIDERS}
    base_models = preset_map.get(provider_code, [])

    if not provider or not provider.models_json:
        return base_models

    try:
        custom_and_synced = json.loads(provider.models_json)
    except Exception:
        custom_and_synced = []

    # 按 id 去重合并
    seen = set()
    merged = []
    for m in custom_and_synced + base_models:
        if m.get("id") and m["id"] not in seen:
            seen.add(m["id"])
            merged.append(m)
    return merged


def add_custom_model(
    session: Session,
    provider_code: str,
    model_id: str,
    model_name: str,
) -> list[dict[str, str]]:
    """为指定厂商添加自定义模型。"""
    init_gateway_defaults(session)
    provider = session.execute(
        select(LLMProviderRecord).where(LLMProviderRecord.provider_code == provider_code)
    ).scalar_one_or_none()
    if not provider:
        raise ValueError(f"厂商 {provider_code} 不存在")

    current_models = get_provider_models(session, provider_code)
    new_entry = {
        "id": model_id.strip(),
        "name": model_name.strip() or model_id.strip(),
        "custom": True,
    }

    # 替换或追加
    updated_models = [m for m in current_models if m.get("id") != new_entry["id"]]
    updated_models.append(new_entry)

    provider.models_json = json.dumps(updated_models, ensure_ascii=False)
    session.commit()
    return updated_models


def delete_custom_model(
    session: Session,
    provider_code: str,
    model_id: str,
) -> list[dict[str, str]]:
    """删除厂商自定义模型。"""
    init_gateway_defaults(session)
    provider = session.execute(
        select(LLMProviderRecord).where(LLMProviderRecord.provider_code == provider_code)
    ).scalar_one_or_none()
    if not provider:
        raise ValueError(f"厂商 {provider_code} 不存在")

    current_models = get_provider_models(session, provider_code)
    updated_models = [m for m in current_models if m.get("id") != model_id]

    provider.models_json = json.dumps(updated_models, ensure_ascii=False)
    session.commit()
    return updated_models


def sync_official_models(
    session: Session,
    provider_code: str | None = None,
) -> dict[str, Any]:
    """与官方同步最新模型列表（支持在线 API 拉取与官方全量基准库融合）。"""
    init_gateway_defaults(session)

    targets = (
        [provider_code]
        if provider_code
        else [
            "dashscope",
            "deepseek",
            "openai",
            "anthropic",
            "zhipu",
            "moonshot",
            "ollama",
        ]
    )
    results = {}
    total_synced = 0

    for code in targets:
        provider = session.execute(
            select(LLMProviderRecord).where(LLMProviderRecord.provider_code == code)
        ).scalar_one_or_none()
        if not provider:
            continue

        existing_models = get_provider_models(session, code)
        custom_items = [m for m in existing_models if m.get("custom")]

        # 1. 尝试在线 API 拉取
        online_models: list[dict[str, str]] = []
        if provider.api_key and code in ["dashscope", "openai", "deepseek", "moonshot", "zhipu"]:
            try:
                endpoint = f"{provider.base_url.rstrip('/')}/models"
                headers = {"Authorization": f"Bearer {provider.api_key}"}
                resp = httpx.get(endpoint, headers=headers, timeout=4.0)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_list = data.get("data", []) or data.get("models", [])
                    for item in raw_list:
                        m_id = item.get("id") or item.get("name")
                        if m_id:
                            online_models.append({"id": m_id, "name": f"{m_id} (官方在线同步)"})
            except Exception:
                pass
        elif code == "ollama":
            try:
                endpoint = f"{provider.base_url.replace('/v1', '')}/api/tags"
                resp = httpx.get(endpoint, timeout=3.0)
                if resp.status_code == 200:
                    raw_list = resp.json().get("models", [])
                    for item in raw_list:
                        m_id = item.get("name") or item.get("model")
                        if m_id:
                            online_models.append({"id": m_id, "name": f"{m_id} (本地已拉取)"})
            except Exception:
                pass

        # 2. 融合官方全量预置基准库
        catalog_models = OFFICIAL_SYNC_CATALOGS.get(code, [])

        # 3. 按 ID 合并 (在线 > 基准库 > 自定义)
        seen = set()
        merged = []
        for m in custom_items + online_models + catalog_models:
            if m.get("id") and m["id"] not in seen:
                seen.add(m["id"])
                merged.append(m)

        provider.models_json = json.dumps(merged, ensure_ascii=False)
        total_synced += len(merged)
        results[code] = {"count": len(merged), "models": merged}

    session.commit()
    return {
        "success": True,
        "total_synced": total_synced,
        "providers": results,
    }


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


def get_model_by_provider_and_name(
    session: Session,
    provider_code: str = "dashscope",
    model_name: str = "qwen3.7-flash",
    temperature: float = 0.7,
    max_tokens: int = 2048,
    streaming: bool = True,
) -> BaseChatModel:
    """根据指定的厂商代号与模型名称直接构建 LangChain ChatOpenAI 实例。"""
    init_gateway_defaults(session)
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

    return get_model_by_provider_and_name(
        session,
        provider_code=provider_code,
        model_name=model_name,
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
    if not model_name:
        models = get_provider_models(session, provider_code)
        if models:
            target_model = models[0]["id"]

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

