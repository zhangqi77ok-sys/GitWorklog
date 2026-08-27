from datetime import datetime, timezone
from typing import Any

class ShortTermMemory:
    def __init__(self):
        self._buffers: dict[str, list[dict[str, Any]]] = {}

    def push(self, conversation_id: str, role: str, content: str, meta: dict[str, Any] | None = None) -> None:
        if conversation_id not in self._buffers:
            self._buffers[conversation_id] = []
        self._buffers[conversation_id].append({
            "role": role,
            "content": content,
            "meta": meta or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        if len(self._buffers[conversation_id]) > 50:
            self._buffers[conversation_id].pop(0)

    def get_context(self, conversation_id: str, limit: int = 10) -> list[dict[str, Any]]:
        return self._buffers.get(conversation_id, [])[-limit:]

    def clear(self, conversation_id: str) -> None:
        if conversation_id in self._buffers:
            del self._buffers[conversation_id]

class LongTermMemory:
    def __init__(self):
        self._memories: list[dict[str, Any]] = [
            {
                "id": "mem-1",
                "category": "architecture",
                "title": "模块化积木式解耦规范",
                "content": "所有业务与UI面板均设计为独立Block，使用EventBus通信，严禁硬编码跨模块直接调用。",
                "tags": ["architecture", "decoupling", "block"]
            },
            {
                "id": "mem-2",
                "category": "code_style",
                "title": "Python 现代类型注解与单测",
                "content": "函数须包含详尽docstring与类型注解，所有核心逻辑必须附带PyTest边界单测。",
                "tags": ["python", "pytest", "typing"]
            },
            {
                "id": "mem-3",
                "category": "frontend",
                "title": "RunCabinet 暖色桌面交互",
                "content": "采用陶土暖橙与砂岩材质，提供交互式代码操作栏、实时Diff对比与终端回显。",
                "tags": ["frontend", "runcabinet", "monaco"]
            }
        ]

    def add_memory(self, title: str, content: str, category: str = "general", tags: list[str] | None = None) -> dict[str, Any]:
        item = {
            "id": f"mem-{int(datetime.now(timezone.utc).timestamp()*1000)}",
            "title": title,
            "content": content,
            "category": category,
            "tags": tags or [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        self._memories.append(item)
        return item

    def search_memories(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        if not query:
            return self._memories[:limit]
        q = query.lower()
        scored = []
        for m in self._memories:
            text = f"{m['title']} {m['content']} {' '.join(m.get('tags', []))}".lower()
            score = sum(1 for w in q.split() if w in text)
            if score > 0:
                scored.append((score, m))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:limit]] or self._memories[:limit]

    def list_all(self) -> list[dict[str, Any]]:
        return list(self._memories)

_short_term = ShortTermMemory()
_long_term = LongTermMemory()

def get_short_term_memory() -> ShortTermMemory:
    return _short_term

def get_long_term_memory() -> LongTermMemory:
    return _long_term
