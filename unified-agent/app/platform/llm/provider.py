"""模型 provider 抽象（融合 gogo Qwen + dodo DeepSeek）。

按场景选择模型：strong（复杂推理，data 域 Text2SQL）、fast（意图/标题）、
embedding（向量）、multimodal（图片）。具体 DashScope/DeepSeek 适配器需 live 验证，
本文件定义统一接口，业务层只依赖接口。

需 live 验证：真实模型调用、流式、多模态。
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from enum import StrEnum
from typing import Protocol


class ModelRole(StrEnum):
    STRONG = "strong"
    FAST = "fast"
    EMBEDDING = "embedding"
    MULTIMODAL = "multimodal"


class ChatProvider(Protocol):
    def complete(self, messages: list[dict[str, str]]) -> str: ...
    def stream(self, messages: list[dict[str, str]]) -> Iterator[str]: ...
    async def astream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...


class EmbeddingProvider(Protocol):
    def embed(self, text: str) -> list[float]: ...
    def embed_batch(self, texts: list[str]) -> list[list[float]]: ...


class ModelRegistry(Protocol):
    """按角色获取 provider，实现读取配置选择 DashScope/DeepSeek。"""

    def chat(self, role: ModelRole = ModelRole.STRONG) -> ChatProvider: ...
    def embedding(self) -> EmbeddingProvider: ...
