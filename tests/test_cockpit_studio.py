import pytest
import asyncio
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
from app.platform.harness.service import get_harness
from app.platform.audit.service import get_audit_skill, get_ironman_skill
from app.platform.loop.engine import get_loop_engine
from app.core.db import session_scope

client = TestClient(app)

def test_health_check():
    resp = client.get("/health")
    assert resp.status_code == 200
    json_data = resp.json()
    assert json_data["code"] == 0
    assert json_data["data"]["status"] == "up"

def test_session_lifecycle_and_tags():
    import uuid
    conv_id = f"test-conv-{uuid.uuid4().hex[:8]}"
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

def test_harness_syntax_and_safety():
    harness = get_harness()
    # 1. 语法检查
    ok, msg = harness.check_ast_syntax("def add(a: int, b: int) -> int: return a + b")
    assert ok is True
    fail_ok, fail_msg = harness.check_ast_syntax("def invalid_func(:")
    assert fail_ok is False
    assert "SyntaxError" in fail_msg

    # 2. 路径穿越安全防护
    safe = harness.validate_path_safety("app/utils/math.py")
    assert safe is True
    unsafe = harness.validate_path_safety("../../../Windows/System32/calc.exe")
    assert unsafe is False

    # 3. Diff 补丁
    diff = harness.generate_diff("a = 1\n", "a = 2\n", "test.py")
    assert "-a = 1" in diff
    assert "+a = 2" in diff

def test_audit_skill_and_dual_ironman():
    # 1. 审核 Skill
    auditor = get_audit_skill()
    good_code = '''def calculate_total(items: list[float]) -> float:
    """计算总额。"""
    return sum(items)
'''
    res_good = auditor.inspect_code(good_code)
    assert res_good["passed"] is True
    assert res_good["score"] == 100

    bad_code = "eval('__import__(\\'os\\').system(\\'calc\\')')"
    res_bad = auditor.inspect_code(bad_code)
    assert res_bad["passed"] is False
    assert len(res_bad["violations"]) >= 1

    # 2. 双向钢人对抗辩论 Skill
    ironman = get_ironman_skill()
    debate = ironman.conduct_debate("实现数值计算", good_code)
    assert debate["approved"] is True
    assert len(debate["transcript"]) >= 3
    assert any(t["role"] == "Critic" for t in debate["transcript"])

@pytest.mark.asyncio
async def test_self_correcting_loop_engine():
    loop_engine = get_loop_engine()
    steps = await loop_engine.run_loop("构建高可用统计计算模块", "conv-loop-test", "antigravity", "antigravity-core")
    assert len(steps) == 5
    agent_names = [s["agent"] for s in steps]
    assert "Architect" in agent_names
    assert "Coder" in agent_names
    assert "Tester" in agent_names
    assert "Auditor" in agent_names
    assert "IronMan" in agent_names

def test_skills_and_mcp_endpoints():
    # 1. 技能列表与启停
    skills_resp = client.get("/skills")
    assert skills_resp.status_code == 200
    skills = skills_resp.json()["data"]
    assert len(skills) >= 3
    target_skill = skills[0]["id"]
    
    toggle_skill_resp = client.post("/skills/toggle", json={"skill_id": target_skill, "enabled": False})
    assert toggle_skill_resp.status_code == 200
    assert toggle_skill_resp.json()["code"] == 0
    assert toggle_skill_resp.json()["data"] is True

    # 2. MCP 工具列表与启停
    mcp_resp = client.get("/mcp")
    assert mcp_resp.status_code == 200
    mcp_tools = mcp_resp.json()["data"]
    assert len(mcp_tools) >= 3
    target_mcp = mcp_tools[0]["id"]

    toggle_mcp_resp = client.post("/mcp/toggle", json={"tool_id": target_mcp, "enabled": False})
    assert toggle_mcp_resp.status_code == 200
    assert toggle_mcp_resp.json()["code"] == 0
    assert toggle_mcp_resp.json()["data"] is True
