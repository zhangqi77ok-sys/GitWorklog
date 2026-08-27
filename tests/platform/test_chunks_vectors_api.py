"""分片与向量可视化接口、全库与特定知识库 RAG 检索测试。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.platform.auth.security import create_token
from app.platform.files.models import FileRecord
from app.platform.files.rag import (
    get_file_chunks_detail,
    get_file_vectors_detail,
)


@pytest.fixture
def client_with_token() -> tuple[TestClient, str]:
    client = TestClient(app)
    token = create_token(1, extra={"role": "admin"})
    return client, token


def test_rag_chunks_and_vectors_extraction() -> None:
    rec = FileRecord(
        file_id="test_doc_001",
        filename="集团差旅出差标准2026.md",
        content_type="text/markdown",
        size_bytes=1024,
        kind="text",
        summary="关于2026年出差标准与交通工具报销管理规定",
        text_content="第一章 总则：为规范公司差旅报销，特制定本管理规定。第一条 员工出差需提前3天申请并由部门总监审批。\n\n第二章 交通工具与住宿标准：总监级以上可乘坐高铁一等座或飞机商务舱；普通员工可乘坐二等座与经济舱。住宿标准：一线城市每日上限600元，二线城市每日上限400元。\n\n第三章 报销流程：出差结束后5个工作日内提交发票与电子行程单。",
    )

    chunks_data = get_file_chunks_detail(rec)
    assert chunks_data["file_id"] == "test_doc_001"
    assert chunks_data["parent_count"] >= 1
    assert chunks_data["child_count"] >= 1
    assert "交通工具与住宿标准" in chunks_data["parents"][0]["content"]

    vectors_data = get_file_vectors_detail(rec)
    assert vectors_data["file_id"] == "test_doc_001"
    assert vectors_data["dimension"] == 1536
    assert vectors_data["total_vectors"] == chunks_data["child_count"]
    assert len(vectors_data["vectors"]) > 0
    assert "vector_sample" in vectors_data["vectors"][0]
    assert "raw_vector_head" in vectors_data["vectors"][0]


def test_chunks_and_vectors_api(client_with_token: tuple[TestClient, str]) -> None:
    client, token = client_with_token
    headers = {"Authorization": f"Bearer {token}"}

    # 1. 上传一个临时文件
    upload_resp = client.post(
        "/api/files/upload",
        files={"file": ("api_test_doc.txt", b"OpenAI GPT-4o and Qwen 3.7 LLM architecture specifications and prompt routing rules.", "text/plain")},
        headers=headers,
    )
    assert upload_resp.status_code == 200
    file_id = upload_resp.json()["data"]["file_id"]

    # 2. 调用 /chunks 接口
    chunks_resp = client.get(f"/api/files/{file_id}/chunks", headers=headers)
    assert chunks_resp.status_code == 200
    cdata = chunks_resp.json()["data"]
    assert cdata["file_id"] == file_id
    assert cdata["parent_count"] >= 1
    assert len(cdata["children"]) >= 1

    # 3. 调用 /vectors 接口
    vectors_resp = client.get(f"/api/files/{file_id}/vectors", headers=headers)
    assert vectors_resp.status_code == 200
    vdata = vectors_resp.json()["data"]
    assert vdata["file_id"] == file_id
    assert vdata["dimension"] in (1536, 1024)
    assert len(vdata["vectors"]) >= 1

    # 4. 调用 /rag/search 支持 all_kb
    rag_resp = client.post(
        "/api/files/rag/search",
        json={"query": "LLM architecture", "all_kb": True, "top_k": 3},
        headers=headers,
    )
    assert rag_resp.status_code == 200
    assert isinstance(rag_resp.json()["data"], list)