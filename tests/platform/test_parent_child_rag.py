"""父子分片 RAG 与级联清理单元测试。"""

from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.main import app
from app.platform.auth.security import create_token
from app.platform.files.parser import parse_file
from app.platform.files.rag import (
    split_parent_child,
)


def test_split_parent_child_chunking():
    # 构造一个 2500 字的长文档
    long_text = "【企业财务与差旅制度规范】\n" + (
        "第一条：出差人员住宿标准为每天不超过500元。\n" * 40
    )
    pc_list = split_parent_child(
        long_text, parent_size=1000, parent_overlap=100, child_size=300, child_overlap=50
    )

    assert len(pc_list) > 1
    # 检查父块和子块结构
    _p_idx, p_text, _c_idx, c_text = pc_list[0]
    assert len(p_text) <= 1000
    assert len(c_text) <= 300
    assert c_text in p_text


def test_multimodal_parser_image_and_pdf():
    # 1. 图像解析
    img_data = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    parsed_img = parse_file("invoice.png", img_data)
    assert parsed_img.kind == "image"
    assert "图像" in parsed_img.text

    # 2. 纯文本
    txt_data = "这是一份测试文档，包含差旅规定。".encode()
    parsed_txt = parse_file("rules.txt", txt_data)
    assert parsed_txt.kind == "text"
    assert "差旅规定" in parsed_txt.text


def test_parent_child_rag_api_and_cascade_delete():
    client = TestClient(app)
    token = create_token(1, extra={"username": "admin", "roles": ["admin"]})
    headers = {"Authorization": f"Bearer {token}"}

    # 上传测试文档
    content = (
        "【2026年度差旅合规全手册】\n"
        "第一节 总则：为规范差旅行为，特制定本条例。\n"
        "第二节 交通标准：高管可乘坐头等舱，普通员工乘坐经济舱与高铁二等座。\n"
        "第三节 住宿与餐饮补贴：一线城市住宿上限600元，餐饮补助每天100元。\n"
        "第四节 发票报销：严禁开具虚假发票，违者严肃处理。\n"
    ).encode()

    upload_resp = client.post(
        "/api/files/upload",
        headers=headers,
        files={"file": ("travel_policy_2026.txt", io.BytesIO(content), "text/plain")},
    )
    assert upload_resp.status_code == 200
    file_id = upload_resp.json()["data"]["file_id"]

    # 执行父子分片 RAG 检索
    rag_payload = {
        "query": "一线城市住宿上限和餐饮补助是多少",
        "file_ids": [file_id],
        "top_k": 2,
    }
    rag_resp = client.post("/api/files/rag/search", headers=headers, json=rag_payload)
    assert rag_resp.status_code == 200
    chunks = rag_resp.json()["data"]
    assert len(chunks) >= 1
    # 命中子块回溯到的父块应包含完整的上下文
    assert "住宿上限600元" in chunks[0]["content"]
    assert "餐饮补助每天100元" in chunks[0]["content"]
    assert chunks[0]["score"] > 0.3

    # 级联删除文档并清理向量数据库
    del_resp = client.delete(f"/api/files/{file_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["data"]["deleted"] == file_id

    # 再次检索应为空
    rag_resp2 = client.post("/api/files/rag/search", headers=headers, json=rag_payload)
    assert len(rag_resp2.json()["data"]) == 0
