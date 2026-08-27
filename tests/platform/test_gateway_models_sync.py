"""测试 LLM 智能网关自定义模型与官方模型同步 API。"""

import pytest
from fastapi.testclient import TestClient

from app.platform.auth.security import create_token
from app.main import app


@pytest.fixture
def auth_client():
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    client = TestClient(app)
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


def test_gateway_custom_models_crud(auth_client):
    # 1. 为 dashscope 添加自定义模型
    res = auth_client.post(
        "/api/gateway/providers/dashscope/models",
        json={"model_id": "custom-qwen-32b-finetuned", "model_name": "我的微调模型 (32B)"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["code"] == 0
    assert any(m["id"] == "custom-qwen-32b-finetuned" for m in data["data"])

    # 2. 查询列表确认包含自定义模型
    res2 = auth_client.get("/api/gateway/providers")
    assert res2.status_code == 200
    providers = res2.json()["data"]
    dashscope_p = next(p for p in providers if p["provider_code"] == "dashscope")
    assert any(m["id"] == "custom-qwen-32b-finetuned" for m in dashscope_p["models"])

    # 3. 删除自定义模型
    res3 = auth_client.delete(
        "/api/gateway/providers/dashscope/models/custom-qwen-32b-finetuned"
    )
    assert res3.status_code == 200
    assert res3.json()["code"] == 0
    assert not any(m["id"] == "custom-qwen-32b-finetuned" for m in res3.json()["data"])


def test_gateway_official_models_sync(auth_client):
    # 1. 针对单个厂商同步官方模型
    res = auth_client.post("/api/gateway/providers/deepseek/sync-models")
    assert res.status_code == 200
    data = res.json()
    assert data["code"] == 0
    assert data["data"]["success"] is True

    # 2. 全量官方模型同步
    res_all = auth_client.post("/api/gateway/sync-models")
    assert res_all.status_code == 200
    data_all = res_all.json()
    assert data_all["code"] == 0
    assert data_all["data"]["total_synced"] > 0
    assert "dashscope" in data_all["data"]["providers"]
    assert "openai" in data_all["data"]["providers"]