"""用户长期记忆与知识图谱单元测试。"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.db import session_scope
from app.main import app
from app.platform.auth.security import create_token
from app.platform.memory.service import (
    clear_user_memories_and_graph,
    extract_user_traits_and_graph,
    get_user_persona_prompt,
    list_user_graph_edges,
    list_user_memories,
)


def test_dynamic_memory_and_graph_extraction():
    with session_scope() as session:
        clear_user_memories_and_graph(session, user_id=1)

        # 模拟用户对话：常驻北京，喜欢国航早班机靠窗，常住万豪，关注华东区销售数据
        user_query = "我在北京常驻办公，以后订机票优先选中国国航早班机靠窗，酒店帮我定万豪，另外帮我分析一下华东区销售额"
        agent_reply = "好的，已为您记录偏好并准备查询北京出发的国航早班机与万豪酒店。"

        records = extract_user_traits_and_graph(
            session,
            user_id=1,
            user_query=user_query,
            agent_reply=agent_reply,
            conversation_id="conv-test-1",
        )

        assert len(records) >= 3
        memories = list_user_memories(session, user_id=1)
        keys = [m.key for m in memories]
        assert "home_city" in keys
        assert "preferred_airline" in keys
        assert "preferred_hotel" in keys

        # 检查知识图谱关系边
        edges = list_user_graph_edges(session, user_id=1)
        relations = [e.relation for e in edges]
        targets = [e.target_node for e in edges]
        assert "LIVES_IN" in relations
        assert "北京" in targets
        assert "PREFERS_AIRLINE" in relations
        assert "PREFERS_HOTEL" in relations

        # 检查生成的画像 Prompt 文本
        persona_prompt = get_user_persona_prompt(session, user_id=1)
        assert "【用户长期记忆与知识图谱画像】" in persona_prompt
        assert "北京" in persona_prompt
        assert "中国国航" in persona_prompt

        # 清理
        clear_user_memories_and_graph(session, user_id=1)


def test_user_memory_api_endpoints():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 清空记忆
    client.delete("/api/user/memory", headers=headers)

    # 2. 手动创建记忆
    add_resp = client.post(
        "/api/user/memory",
        headers=headers,
        json={"memory_type": "preference", "key": "airline_brand", "value": "优先乘坐中国南方航空"},
    )
    assert add_resp.status_code == 200
    mem_id = add_resp.json()["data"]["id"]

    # 3. 查询记忆与图谱
    get_resp = client.get("/api/user/memory", headers=headers)
    assert get_resp.status_code == 200
    data = get_resp.json()["data"]
    assert len(data["memories"]) >= 1
    assert data["memories"][0]["value"] == "优先乘坐中国南方航空"

    # 4. 删除单条记忆
    del_resp = client.delete(f"/api/user/memory/{mem_id}", headers=headers)
    assert del_resp.status_code == 200

    # 5. 再次查询确认已删除
    get_resp2 = client.get("/api/user/memory", headers=headers)
    assert len(get_resp2.json()["data"]["memories"]) == 0
