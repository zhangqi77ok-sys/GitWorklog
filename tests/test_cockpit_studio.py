import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.eventbus import get_event_bus, PlatformEvent
from app.platform.session.service import (
    get_or_create_conversation,
    rename_conversation,
    update_conversation_status,
    update_conversation_tags,
    delete_conversation,
    append_message,
    get_messages,
)
from app.platform.memory.service import get_short_term_memory, get_long_term_memory
from app.platform.graph.service import get_graph_service
from app.platform.cockpit.registry import get_cockpit_registry
from app.platform.token_meter.service import get_token_meter
from app.core.db import session_scope

client = TestClient(app)

def test_health_check():
    resp = client.get("/health")
    assert resp.status_code == 200
    json_data = resp.json()
    assert json_data["code"] == 0
    assert json_data["data"]["status"] == "up"

def test_session_lifecycle_and_tags():
    conv_id = "test-conv-001"
    with session_scope() as db:
        c = get_or_create_conversation(db, conv_id, "初始会话", "feat,coding")
        assert c.conversation_id == conv_id
        assert c.title == "初始会话"

        rename_conversation(db, conv_id, "重命名后的会话")
        update_conversation_status(db, conv_id, "running")
        update_conversation_tags(db, conv_id, ["refactor", "mesh"])
        append_message(db, conv_id, "user", "请帮我编写一个单测模块")
        msgs = get_messages(db, conv_id)
        assert len(msgs) == 1
        assert msgs[0].content == "请帮我编写一个单测模块"

    # API 校验
    resp = client.get("/session/list")
    assert resp.status_code == 200
    conv_list = resp.json()["data"]
    target = next((x for x in conv_list if x["conversation_id"] == conv_id), None)
    assert target is not None
    assert target["title"] == "重命名后的会话"
    assert target["status"] == "running"
    assert "refactor" in target["tags"]

    # 删除会话
    del_resp = client.delete(f"/session/{conv_id}")
    assert del_resp.status_code == 200
    resp_after = client.get("/session/list")
    assert not any(x["conversation_id"] == conv_id for x in resp_after.json()["data"])

def test_memory_systems():
    st = get_short_term_memory()
    st.push("conv-test-mem", "user", "短期记忆上下文测试内容")
    ctx = st.get_context("conv-test-mem")
    assert len(ctx) >= 1
    assert ctx[-1]["content"] == "短期记忆上下文测试内容"

    lt = get_long_term_memory()
    m = lt.add_memory("新规范", "所有模块必须严格解耦", "architecture", ["decoupling"])
    assert m["title"] == "新规范"
    search_res = lt.search_memories("严格解耦")
    assert len(search_res) >= 1

def test_ast_knowledge_graph():
    graph_svc = get_graph_service()
    graph_svc.record_change("conv-graph-1", "app/utils/task_solver.py", "MODIFY", "重构核心函数")
    data = graph_svc.scan_project_ast()
    assert "nodes" in data
    assert "links" in data
    assert len(data["nodes"]) > 0

def test_cockpit_tools_and_multi_account_gateway():
    reg = get_cockpit_registry()
    providers = reg.list_providers()
    assert "antigravity" in providers
    assert "gemini" in providers
    assert "trae" in providers
    assert "qoder" in providers
    assert "kiro" in providers
    assert "bailian" in providers
    assert "deepseek" in providers
    assert "claude" in providers
    assert "openai" in providers
    assert "ollama" in providers

    # 验证多账号凭据池与配额
    agy = providers["antigravity"]
    assert len(agy["accounts"]) >= 2
    assert agy["accounts"][0]["quota_total"] == 100
    assert "reset_time" in agy["accounts"][0]

    # 测试账号热切换
    switched = reg.switch_account("antigravity", "acc-agy-2")
    assert switched is True
    assert reg.list_providers()["antigravity"]["active_account"] == "Account-2 (AGY Backup)"

    # 测试延迟探测 Ping
    ping_res = reg.ping_provider("antigravity")
    assert ping_res["success"] is True
    assert ping_res["latency_ms"] > 0

    # 测试沙箱调试工具
    exec_res = reg.invoke_tool("terminal_exec", {"cmd": "pytest tests/"})
    assert exec_res["success"] is True
    assert "Exit Code: 0" in exec_res["output"]

def test_token_meter_audit():
    meter = get_token_meter()
    meter.record_usage("conv-meter-test", "antigravity", "antigravity-core", 250, 150, 0.35)
    summary = meter.get_summary("conv-meter-test")
    assert summary["prompt_tokens"] >= 250
    assert summary["completion_tokens"] >= 150
    assert summary["total_tokens"] >= 400
