"""Cockpit Tools 驾驶舱工具注册与控制中心。

支持系统内置工具、Skill 插件工具、MCP 工具的集中治理、状态开关 (Enable/Disable) 与在线调试。
"""

from __future__ import annotations

import inspect
import json
import time
from typing import Any, Callable


class CockpitTool:
    def __init__(
        self,
        tool_id: str,
        name: str,
        category: str,  # system / mcp / skill / ast / git
        description: str,
        parameters_schema: dict[str, Any],
        handler: Callable[..., Any],
        enabled: bool = True,
        icon: str = "🛠️",
    ) -> None:
        self.tool_id = tool_id
        self.name = name
        self.category = category
        self.description = description
        self.parameters_schema = parameters_schema
        self.handler = handler
        self.enabled = enabled
        self.icon = icon
        self.call_count = 0
        self.last_latency_ms = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "tool_id": self.tool_id,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "parameters_schema": self.parameters_schema,
            "enabled": self.enabled,
            "icon": self.icon,
            "call_count": self.call_count,
            "last_latency_ms": self.last_latency_ms,
        }


class CockpitToolRegistry:
    """Cockpit Tools 统一控制中心。"""

    def __init__(self) -> None:
        self._tools: dict[str, CockpitTool] = {}
        self._init_builtins()

    def _init_builtins(self) -> None:
        # 1. 终端执行工具
        self.register(CockpitTool(
            tool_id="workspace_command_runner",
            name="终端命令执行器",
            category="system",
            description="在当前工程根目录中执行 shell/python/pytest 命令并捕获回显输出",
            parameters_schema={
                "project_path": {"type": "string", "description": "工程绝对路径"},
                "command": {"type": "string", "description": "要执行的命令行指令"}
            },
            handler=self._mock_cmd_runner,
            icon="📟"
        ))
        # 2. 文件创建与覆盖
        self.register(CockpitTool(
            tool_id="project_file_writer",
            name="工程文件写入与创建器",
            category="system",
            description="在本地工程中安全创建新文件或覆写已有代码文件",
            parameters_schema={
                "project_path": {"type": "string", "description": "工程路径"},
                "file_path": {"type": "string", "description": "相对路径"},
                "content": {"type": "string", "description": "代码内容"}
            },
            handler=self._mock_file_writer,
            icon="💾"
        ))
        # 3. Obsidian 知识图谱扫描
        self.register(CockpitTool(
            tool_id="knowledge_graph_inspector",
            name="Obsidian 拓扑图谱扫描器",
            category="ast",
            description="基于 AST 解析工程函数、类与 Git 变动节点",
            parameters_schema={
                "project_path": {"type": "string", "description": "工程路径"}
            },
            handler=self._mock_graph_inspector,
            icon="🕸️"
        ))
        # 4. 长期记忆检索
        self.register(CockpitTool(
            tool_id="semantic_memory_searcher",
            name="语义规范与最佳实践检索器",
            category="skill",
            description="从分层记忆库中检索团队架构规则与历史缺陷修复经验",
            parameters_schema={
                "query": {"type": "string", "description": "检索关键词"}
            },
            handler=self._mock_memory_searcher,
            icon="🧠"
        ))
        # 5. MCP 本地文件系统协议
        self.register(CockpitTool(
            tool_id="mcp_filesystem_inspector",
            name="MCP Filesystem Inspector",
            category="mcp",
            description="通过 Model Context Protocol 协议访问外部只读/可写文件系统",
            parameters_schema={
                "uri": {"type": "string", "description": "文件或目录 URI"}
            },
            handler=self._mock_mcp_fs,
            icon="🔌"
        ))

    def _mock_cmd_runner(self, **kwargs: Any) -> Any:
        return {"status": "success", "exit_code": 0, "output": f"Executed: {kwargs.get('command')}"}

    def _mock_file_writer(self, **kwargs: Any) -> Any:
        return {"status": "written", "file_path": kwargs.get("file_path"), "bytes": len(kwargs.get("content", ""))}

    def _mock_graph_inspector(self, **kwargs: Any) -> Any:
        return {"status": "scanned", "entities": 12, "commits": 3}

    def _mock_memory_searcher(self, **kwargs: Any) -> Any:
        return {"results": [{"title": "模块化积木式设计规范", "score": 0.95}]}

    def _mock_mcp_fs(self, **kwargs: Any) -> Any:
        return {"mcp_status": "connected", "resources": [kwargs.get("uri", "/")]}

    def register(self, tool: CockpitTool) -> None:
        self._tools[tool.tool_id] = tool

    def get_tool(self, tool_id: str) -> CockpitTool | None:
        return self._tools.get(tool_id)

    def list_tools(self) -> list[dict[str, Any]]:
        return [t.to_dict() for t in self._tools.values()]

    def toggle_tool(self, tool_id: str, enabled: bool) -> bool:
        if tool_id in self._tools:
            self._tools[tool_id].enabled = enabled
            return True
        return False

    async def invoke_tool(self, tool_id: str, params: dict[str, Any]) -> dict[str, Any]:
        tool = self._tools.get(tool_id)
        if not tool:
            return {"error": f"Tool {tool_id} not found", "success": False}
        if not tool.enabled:
            return {"error": f"Tool {tool_id} is disabled in Cockpit", "success": False}
        
        start = time.perf_counter()
        try:
            res = tool.handler(**params)
            if inspect.isawaitable(res):
                res = await res
            latency = int((time.perf_counter() - start) * 1000)
            tool.call_count += 1
            tool.last_latency_ms = latency
            return {"success": True, "result": res, "latency_ms": latency}
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return {"success": False, "error": str(exc), "latency_ms": latency}


_cockpit_registry = CockpitToolRegistry()

def get_cockpit_registry() -> CockpitToolRegistry:
    return _cockpit_registry