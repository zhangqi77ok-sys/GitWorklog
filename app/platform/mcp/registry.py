from typing import Any

class MCPRegistry:
    def __init__(self):
        self._tools = [
            {"id": "mcp-fs-read", "name": "fs_read_file", "server": "filesystem", "desc": "读取工程目录下的指定文件内容", "enabled": True},
            {"id": "mcp-fs-write", "name": "fs_write_file", "server": "filesystem", "desc": "向工程目录下安全写入新文件或覆盖", "enabled": True},
            {"id": "mcp-shell-exec", "name": "shell_run_cmd", "server": "terminal", "desc": "在沙箱环境中执行 Python/Shell 脚本", "enabled": True},
        ]

    def list_tools(self) -> list[dict[str, Any]]:
        return list(self._tools)

    def toggle_tool(self, tool_id: str, enabled: bool) -> bool:
        for t in self._tools:
            if t["id"] == tool_id:
                t["enabled"] = enabled
                return True
        return False

_mcp_registry = MCPRegistry()
def get_mcp_registry() -> MCPRegistry:
    return _mcp_registry
