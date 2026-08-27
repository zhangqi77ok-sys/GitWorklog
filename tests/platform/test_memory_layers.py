"""短期与长期记忆服务测试。"""

from app.platform.memory.service import LongTermMemory, ShortTermMemory


def test_short_term_memory():
    stm = ShortTermMemory()
    stm.push("conv-1", "user", "Hello World")
    stm.push("conv-1", "assistant", "Hi there")

    ctx = stm.get_context("conv-1")
    assert len(ctx) == 2
    assert ctx[0]["role"] == "user"
    assert ctx[1]["content"] == "Hi there"


def test_long_term_memory():
    ltm = LongTermMemory()
    item = ltm.add_memory("rule", "测试规范", "所有模块需有单测", ["test", "rule"])
    assert item["id"].startswith("mem-")

    results = ltm.search_memories("测试")
    assert len(results) >= 1
    assert any(r["title"] == "测试规范" for r in results)

    ltm.delete_memory(item["id"])
    assert not any(r["id"] == item["id"] for r in ltm.list_all())