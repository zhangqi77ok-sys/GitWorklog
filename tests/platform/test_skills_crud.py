"""Skill 创建、更新、删除 CRUD 单元测试。"""

from __future__ import annotations

import os

from fastapi.testclient import TestClient

from app.core.db import session_scope
from app.main import app
from app.platform.auth.security import create_token
from app.platform.skills.service import get_skill


def test_skills_crud_api():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    skill_name = "test-customer-bot"

    # 1. 创建新技能
    create_payload = {
        "name": skill_name,
        "description": "客户接待与售后问题解答助手",
        "body": "你是一个专业的客服助手，请礼貌回答客户咨询。",
        "enabled": True,
    }
    resp = client.post("/api/skills", headers=headers, json=create_payload)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["name"] == skill_name
    assert "客户接待" in data["description"]

    # 验证本地文件与数据库均已创建
    with session_scope() as session:
        sk = get_skill(session, skill_name)
        assert sk is not None
        assert os.path.exists(f"skills/{skill_name}/SKILL.md")

    # 2. 更新技能
    update_payload = {
        "description": "更新后的客户支持助手",
        "body": "更新后的详细 SOP 规范",
    }
    up_resp = client.put(f"/api/skills/{skill_name}", headers=headers, json=update_payload)
    assert up_resp.status_code == 200
    assert "更新后" in up_resp.json()["data"]["description"]

    # 3. 删除技能
    del_resp = client.delete(f"/api/skills/{skill_name}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["data"]["deleted"] == skill_name

    # 验证本地文件与数据库均已清理
    with session_scope() as session:
        assert get_skill(session, skill_name) is None
        assert not os.path.exists(f"skills/{skill_name}")
