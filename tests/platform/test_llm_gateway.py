"""LLM 智能网关单元测试。"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.db import session_scope
from app.main import app
from app.platform.auth.security import create_token
from app.platform.gateway.service import (
    get_model_for_feature,
    list_providers,
    list_routes,
    update_route,
)


def test_gateway_service_and_routing():
    with session_scope() as session:
        providers = list_providers(session)
        assert len(providers) >= 6

        # 检查各预置厂商
        codes = [p.provider_code for p in providers]
        assert "dashscope" in codes
        assert "deepseek" in codes
        assert "openai" in codes
        assert "anthropic" in codes
        assert "zhipu" in codes

        routes = list_routes(session)
        assert len(routes) >= 5
        keys = [r.feature_key for r in routes]
        assert "chat_default" in keys
        assert "data_analysis" in keys
        assert "coding_agent" in keys

        # 测试更新路由为 deepseek
        updated = update_route(
            session, "coding_agent", "deepseek", "deepseek-reasoner", temperature=0.1
        )
        assert updated is not None
        assert updated.model_name == "deepseek-reasoner"

        # 获取模型实例
        model = get_model_for_feature(session, "coding_agent")
        assert model.model_name == "deepseek-reasoner"


def test_gateway_api_endpoints():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 查询厂商列表
    p_resp = client.get("/api/gateway/providers", headers=headers)
    assert p_resp.status_code == 200
    providers = p_resp.json()["data"]
    assert len(providers) >= 6

    # 2. 更新厂商 API Key
    edit_p = client.put(
        "/api/gateway/providers/openai",
        headers=headers,
        json={"api_key": "sk-mock-key-1234567890", "base_url": "https://api.openai.com/v1"},
    )
    assert edit_p.status_code == 200

    # 3. 查询功能路由
    r_resp = client.get("/api/gateway/routes", headers=headers)
    assert r_resp.status_code == 200
    routes = r_resp.json()["data"]
    assert len(routes) >= 5

    # 4. 更新功能路由
    edit_r = client.put(
        "/api/gateway/routes/chat_default",
        headers=headers,
        json={"provider_code": "dashscope", "model_name": "qwen3.7-flash", "temperature": 0.7},
    )
    assert edit_r.status_code == 200
