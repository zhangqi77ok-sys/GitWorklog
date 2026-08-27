"""分层记忆服务：短期工作记忆 (Working Buffer) + 长期语义向量记忆 (Long-Term Memory)。"""

from __future__ import annotations

import json
import math
from datetime import datetime
from typing import Any


class ShortTermMemory:
    """短期工作记忆：记录当前会话的上下文、最近修改的代码块与临时执行状态。"""

    def __init__(self) -> None:
        self._buffers: dict[str, list[dict[str, Any]]] = {}

    def push(self, conversation_id: str, role: str, content: str, meta: dict[str, Any] | None = None) -> None:
        if conversation_id not in self._buffers:
            self._buffers[conversation_id] = []
        self._buffers[conversation_id].append({
            "role": role,
            "content": content,
            "meta": meta or {},
            "timestamp": datetime.utcnow().isoformat()
        })
        if len(self._buffers[conversation_id]) > 50:
            self._buffers[conversation_id].pop(0)

    def get_context(self, conversation_id: str, limit: int = 10) -> list[dict[str, Any]]:
        return self._buffers.get(conversation_id, [])[-limit:]

    def clear(self, conversation_id: str) -> None:
        if conversation_id in self._buffers:
            del self._buffers[conversation_id]


class LongTermMemory:
    """长期语义记忆：持久化开发偏好、架构规范、代码最佳实践与缺陷经验库。"""

    def __init__(self) -> None:
        self._memories: list[dict[str, Any]] = [
            {
                "id": "mem-1",
                "category": "architecture",
                "title": "模块化积木式设计规范",
                "content": "所有业务与 UI 面板均设计为独立 Block，使用 EventBus 通信，严禁硬编码跨模块直接调用。",
                "tags": ["architecture", "decoupling", "block"]
            },
            {
                "id": "mem-2",
                "category": "code_style",
                "title": "Python 编程与单测规范",
                "content": "使用现代类型注解，函数须包含详尽 docstring，所有新增核心逻辑必须附带 PyTest 边界与异常单测。",
                "tags": ["python", "pytest", "typing"]
            },
            {
                "id": "mem-3",
                "category": "frontend",
                "title": "Vite 桌面端交互设计",
                "content": "采用深色微光主题，提供交互式代码操作栏、实时 Diff 对比与内置控制台终端回显。",
                "tags": ["vite", "ui", "diff", "terminal"]
            }
        ]

    def add_memory(self, category: str, title: str, content: str, tags: list[str] | None = None) -> dict[str, Any]:
        item = {
            "id": f"mem-{int(datetime.utcnow().timestamp()*1000)}",
            "category": category,
            "title": title,
            "content": content,
            "tags": tags or [],
            "created_at": datetime.utcnow().isoformat()
        }
        self._memories.append(item)
        return item

    def search_memories(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        query_lower = query.lower()
        scored = []
        for m in self._memories:
            score = 0
            text = f"{m['title']} {m['content']} {' '.join(m.get('tags', []))}".lower()
            words = query_lower.split()
            for w in words:
                if w in text:
                    score += 1
            if score > 0 or not query_lower:
                scored.append((score, m))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:limit]]

    def list_all(self) -> list[dict[str, Any]]:
        return list(self._memories)

    def delete_memory(self, mem_id: str) -> bool:
        initial_len = len(self._memories)
        self._memories = [m for m in self._memories if m["id"] != mem_id]
        return len(self._memories) < initial_len


# 单例
_short_term = ShortTermMemory()
_long_term = LongTermMemory()

def get_short_term_memory() -> ShortTermMemory:
    return _short_term

def get_long_term_memory() -> LongTermMemory:
    return _long_term