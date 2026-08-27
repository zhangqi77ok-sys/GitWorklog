"""技能管理与自动匹配测试（对应 app/api/skills.py & match_skills）。"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.db import session_scope
from app.main import app
from app.platform.auth.security import create_token
from app.platform.skills.service import match_skills, sync_from_fs


def test_skills_sync_and_match():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 同步磁盘技能
    sync_resp = client.post("/api/skills/sync", headers=headers)
    assert sync_resp.status_code == 200
    skills = sync_resp.json()["data"]
    assert len(skills) >= 5
    skill_names = {s["name"] for s in skills}
    assert "data-analysis" in skill_names
    assert "flight-booking" in skill_names
    assert "hotel-booking" in skill_names
    assert "tuniu-travel-guide" in skill_names

    # 2. 测试 match_skills 自动匹配
    with session_scope() as session:
        sync_from_fs(session, "skills")
        # 航班匹配
        matched_flight = match_skills(session, "帮我查一下明天去上海的机票")
        assert any(s.name == "flight-booking" for s in matched_flight)

        # 酒店匹配
        matched_hotel = match_skills(session, "帮我预订下周三北京的酒店")
        assert any(s.name == "hotel-booking" for s in matched_hotel)

        # 攻略/天气匹配
        matched_guide = match_skills(session, "查一下北京明天的天气和攻略")
        assert any(s.name == "tuniu-travel-guide" for s in matched_guide)

        # 报销匹配
        matched_reimburse = match_skills(session, "我要提交出差发票进行报销")
        assert any(s.name == "travel-reimbursement" for s in matched_reimburse)

    # 3. 测试启停 Toggle
    toggle_resp = client.put(
        "/api/skills/flight-booking/toggle",
        headers=headers,
        json={"enabled": False},
    )
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["data"]["enabled"] is False

    # 恢复启用
    toggle_resp2 = client.put(
        "/api/skills/flight-booking/toggle",
        headers=headers,
        json={"enabled": True},
    )
    assert toggle_resp2.status_code == 200
    assert toggle_resp2.json()["data"]["enabled"] is True
