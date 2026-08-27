"""企业知识库集合与文档管理测试。"""

from __future__ import annotations

import io
from fastapi.testclient import TestClient

from app.main import app
from app.platform.auth.security import create_token


def test_knowledge_base_crud_and_upload():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 查询知识库列表（自动创建默认知识库）
    kb_list_resp = client.get("/api/files/kb/list", headers=headers)
    assert kb_list_resp.status_code == 200
    kbs = kb_list_resp.json()["data"]
    assert len(kbs) >= 1

    # 2. 创建新知识库
    create_resp = client.post(
        "/api/files/kb",
        headers=headers,
        json={"name": "2026差旅财务规范库", "description": "收录最新差旅住宿标准与报销制度"},
    )
    assert create_resp.status_code == 200
    new_kb = create_resp.json()["data"]
    kb_id = new_kb["id"]
    assert new_kb["name"] == "2026差旅财务规范库"

    # 3. 上传文档归入该知识库
    doc_content = (
        "【企业差旅报销标准2026版】\n"
        "第一条：一线城市（北京、上海、广州、深圳）住宿标准上限为 800 元/间夜，二线城市上限为 500 元/间夜。\n"
        "第二条：出差人员应在返回后 5 个工作日内凭有效增值税发票完成报销审批。"
    )
    file_bytes = io.BytesIO(doc_content.encode("utf-8"))
    upload_resp = client.post(
        f"/api/files/upload?kb_id={kb_id}",
        headers=headers,
        files={"file": ("reimbursement_2026.txt", file_bytes, "text/plain")},
    )
    assert upload_resp.status_code == 200
    f_data = upload_resp.json()["data"]
    assert f_data["kb_id"] == kb_id

    # 4. 再次获取知识库列表，验证文档计数
    kb_list_resp2 = client.get("/api/files/kb/list", headers=headers)
    assert kb_list_resp2.status_code == 200
    kbs2 = kb_list_resp2.json()["data"]
    target_kb = next((k for k in kbs2 if k["id"] == kb_id), None)
    assert target_kb is not None
    assert target_kb["doc_count"] >= 1
    assert any(f["file_id"] == f_data["file_id"] for f in target_kb["files"])

    # 5. 测试按知识库 ID 检索问答 RAG
    rag_resp = client.post(
        "/api/files/rag/search",
        headers=headers,
        json={"query": "一线城市住宿标准是多少", "file_ids": [f_data["file_id"]]},
    )
    assert rag_resp.status_code == 200
    chunks = rag_resp.json()["data"]
    assert len(chunks) >= 1
    assert "800 元" in chunks[0]["content"]

    # 6. 删除该知识库，验证级联清理
    del_resp = client.delete(f"/api/files/kb/{kb_id}", headers=headers)
    assert del_resp.status_code == 200