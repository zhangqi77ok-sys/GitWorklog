"""Cockpit Tools 驾驶舱注册、开关控制与在线调试测试。"""

import pytest
from app.platform.cockpit.registry import CockpitToolRegistry


@pytest.mark.asyncio
async def test_cockpit_tools_lifecycle():
    reg = CockpitToolRegistry()
    tools = reg.list_tools()
    assert len(tools) >= 4
    tool_ids = [t["tool_id"] for t in tools]
    assert "workspace_command_runner" in tool_ids
    assert "project_file_writer" in tool_ids
    assert "knowledge_graph_inspector" in tool_ids

    # 测试在线调试调用
    res = await reg.invoke_tool("workspace_command_runner", {"command": "echo test"})
    assert res["success"] is True
    assert "output" in res["result"]

    # 测试驾驶舱禁用开关
    reg.toggle_tool("workspace_command_runner", False)
    res_disabled = await reg.invoke_tool("workspace_command_runner", {"command": "echo test"})
    assert res_disabled["success"] is False
    assert "disabled" in res_disabled["error"]

    # 重新开启
    reg.toggle_tool("workspace_command_runner", True)
    res_enabled = await reg.invoke_tool("workspace_command_runner", {"command": "echo test"})
    assert res_enabled["success"] is True