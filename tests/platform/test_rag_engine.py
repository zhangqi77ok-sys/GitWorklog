"""RAG 知识库切片与检索单元测试。"""

from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.main import app
from app.platform.auth.security import create_token
from app.platform.files.rag import _tokenize, calculate_relevance


def test_rag_tokenization_and_relevance():
    tokens = _tokenize("2026年销售报表统计与退改签政策")
    assert "2026" in tokens
    assert "销售" in tokens
    assert "退改签" in tokens or "退改" in tokens

    chunk1 = "本文件记录了2026年各部门销售报表及业绩明细。"
    chunk2 = "公司员工日常差旅住宿报销标准上限为500元。"

    score1 = calculate_relevance(tokens, chunk1, "2026年销售报表统计")
    score2 = calculate_relevance(tokens, chunk2, "2026年销售报表统计")

    assert score1 > score2
    assert score1 > 0.4


def test_rag_search_api():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    # 上传测试文档
    content = (
        "【企业战略规划】\n"
        "第一章：华东区2026年重点拓展智慧差旅业务，目标覆盖1000家头部企业。\n\n"
        "第二章：技术架构全面采用多智能体协同与自然语言转SQL，实现自动化报表输出。\n\n"
        "第三章：财务报销全面实行电子发票秒级验真与自动化合规核验。\n"
    ).encode()

    upload_resp = client.post(
        "/api/files/upload",
        headers=headers,
        files={"file": ("strategy_2026.txt", io.BytesIO(content), "text/plain")},
    )
    assert upload_resp.status_code == 200
    file_id = upload_resp.json()["data"]["file_id"]

    # 执行 RAG 检索测试
    rag_payload = {
        "query": "智慧差旅业务目标覆盖多少企业",
        "file_ids": [file_id],
        "top_k": 2,
    }
    rag_resp = client.post("/api/files/rag/search", headers=headers, json=rag_payload)
    assert rag_resp.status_code == 200
    chunks = rag_resp.json()["data"]
    assert len(chunks) >= 1
    assert "1000家头部企业" in chunks[0]["content"]
    assert chunks[0]["score"] > 0.3

    # 清理测试文档
    client.delete(f"/api/files/{file_id}", headers=headers)
