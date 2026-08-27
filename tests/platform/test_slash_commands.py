"""显式 /slash 技能指令调用测试。"""

from __future__ import annotations

from app.api.chat import _parse_slash_command


def test_parse_slash_command():
    # 1. 匹配标准名
    skill, query = _parse_slash_command("/flight-booking 查明天去上海的机票")
    assert skill == "flight-booking"
    assert query == "查明天去上海的机票"

    # 2. 匹配别名
    skill, query = _parse_slash_command("/flight 订后天机票")
    assert skill == "flight-booking"
    assert query == "订后天机票"

    # 3. 匹配 data / sql
    skill, query = _parse_slash_command("/data 统计部门销售额")
    assert skill == "data-analysis"
    assert query == "统计部门销售额"

    # 4. 普通无 / 查询
    skill, query = _parse_slash_command("统计部门销售额")
    assert skill is None
    assert query == "统计部门销售额"
