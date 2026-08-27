"""文件与知识库接口单元测试（对应 app/api/files.py）。"""

from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.main import app
from app.platform.auth.security import create_token


def test_files_upload_list_preview_delete():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 上传文件
    content = b"This is a test business document.\nDepartment: Sales\nTotal Revenue: 500000\n"
    file_payload = {"file": ("sales_report.txt", io.BytesIO(content), "text/plain")}
    resp = client.post("/api/files/upload", headers=headers, files=file_payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    file_id = body["data"]["file_id"]
    assert body["data"]["filename"] == "sales_report.txt"
    assert "Sales" in body["data"]["summary"]

    # 2. 列表
    list_resp = client.get("/api/files/list", headers=headers)
    assert list_resp.status_code == 200
    files = list_resp.json()["data"]
    assert any(f["file_id"] == file_id for f in files)

    # 3. 预览
    prev_resp = client.get(f"/api/files/{file_id}/preview", headers=headers)
    assert prev_resp.status_code == 200
    assert "Total Revenue" in prev_resp.json()["data"]["text_content"]

    # 4. 删除
    del_resp = client.delete(f"/api/files/{file_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["data"]["deleted"] == file_id

    # 5. 验证删除后 404
    prev2 = client.get(f"/api/files/{file_id}/preview", headers=headers)
    assert prev2.status_code == 404
