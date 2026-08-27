"""技能导入 (ZIP / Markdown / JSON) 单元测试。"""

from __future__ import annotations

import io
import os
import zipfile

from fastapi.testclient import TestClient

from app.core.db import session_scope
from app.main import app
from app.platform.auth.security import create_token
from app.platform.skills.service import delete_skill, get_skill


def test_import_skill_md():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    md_content = """---
name: imported-md-skill
description: 从 Markdown 文件导入的审核助手
---

这里是 Markdown 导入的 SOP 规则。
""".encode()

    resp = client.post(
        "/api/skills/import",
        headers=headers,
        files={"file": ("SKILL.md", io.BytesIO(md_content), "text/markdown")},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "imported-md-skill"
    assert "审核助手" in data[0]["description"]

    # 验证本地与数据库
    with session_scope() as session:
        sk = get_skill(session, "imported-md-skill")
        assert sk is not None
        delete_skill(session, "skills", "imported-md-skill")


def test_import_skill_zip():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    # 创建内存 zip 包
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr(
            "zip-legal-skill/SKILL.md",
            "---\nname: zip-legal-skill\ndescription: 法律合规审查技能\n---\n\n法律审查规范...",
        )
        zf.writestr(
            "zip-legal-skill/rules.txt",
            "补充法律条款数据",
        )

    zip_buffer.seek(0)

    resp = client.post(
        "/api/skills/import",
        headers=headers,
        files={"file": ("skills_bundle.zip", zip_buffer, "application/zip")},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert any(s["name"] == "zip-legal-skill" for s in data)

    # 验证提取的文件存在
    assert os.path.exists("skills/zip-legal-skill/rules.txt")

    # 清理
    with session_scope() as session:
        delete_skill(session, "skills", "zip-legal-skill")


def test_import_skill_json():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    json_content = """[
      {
        "name": "json-market-skill",
        "description": "市场营销文案生成技能",
        "body": "请生成吸引人的营销文案。"
      }
    ]""".encode()

    resp = client.post(
        "/api/skills/import",
        headers=headers,
        files={"file": ("skills.json", io.BytesIO(json_content), "application/json")},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert any(s["name"] == "json-market-skill" for s in data)

    with session_scope() as session:
        delete_skill(session, "skills", "json-market-skill")
