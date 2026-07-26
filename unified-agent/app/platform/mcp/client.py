"""MCP 客户端装配抽象（融合 gogo 天气/签证 + dodo Tavily/echarts）。

统一：连接(stdio/streamable-http)、工具白名单、优雅降级、结果压缩。
具体连接需 live MCP server，本文件定义配置与接口。

需 live 验证：真实 MCP server 连接与工具调用。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol


class McpTransport(StrEnum):
    STDIO = "stdio"
    STREAMABLE_HTTP = "streamable_http"


@dataclass
class McpServerConfig:
    name: str
    transport: McpTransport
    # stdio
    command: str = ""
    args: list[str] = field(default_factory=list)
    # http
    url: str = ""
    headers: dict[str, str] = field(default_factory=dict)
    # 工具白名单（空表示全部放行）
    allowed_tools: list[str] = field(default_factory=list)
    # 降级：连接失败时是否静默跳过
    degrade_on_failure: bool = True


class McpClient(Protocol):
    def list_tools(self) -> list[str]: ...
    def call_tool(self, name: str, arguments: dict[str, object]) -> object: ...


def filter_allowed(tools: list[str], allowed: list[str]) -> list[str]:
    """按白名单过滤工具（纯逻辑，可测）。空白名单 = 全放行。"""
    if not allowed:
        return tools
    allow = set(allowed)
    return [t for t in tools if t in allow]
