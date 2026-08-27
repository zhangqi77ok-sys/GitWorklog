"""P1-S4 凭证注入 Hook（对应 gogo 的每用户独立凭证）。

Shell / MCP 类工具需要按调用者身份取凭证（如各人自己的订票系统 token），
不能全局共用一份。此处提供 CredentialProvider 接缝 + 按用户组装环境变量的纯逻辑。

安全：env_for 只返回取到的键，缺失的键单独列出交由调用方决定降级还是报错——
不静默填空串，避免工具拿着空凭证去调外部系统产生难查的失败。
凭证值不进日志；core/logging.py 的 _SENSITIVE_KEYS 已覆盖 token/secret/api_key。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


class CredentialProvider(Protocol):
    """按用户取凭证。live 实现从加密表 / KMS / Redis 读。"""

    def get(self, user_id: int, key: str) -> str | None: ...


@dataclass
class InMemoryCredentialProvider:
    """测试与本地开发用：{user_id: {key: value}}。"""

    data: dict[int, dict[str, str]] = field(default_factory=dict)

    def get(self, user_id: int, key: str) -> str | None:
        return self.data.get(user_id, {}).get(key)

    def put(self, user_id: int, key: str, value: str) -> None:
        self.data.setdefault(user_id, {})[key] = value


@dataclass
class CredentialInjector:
    """按需组装工具运行所需的环境变量。"""

    provider: CredentialProvider

    def env_for(self, user_id: int, required: list[str]) -> tuple[dict[str, str], list[str]]:
        """返回 (已取到的 env, 缺失的 key 列表)。

        调用方据 missing 决定是提示用户去绑定凭证，还是降级跳过该工具。
        """
        env: dict[str, str] = {}
        missing: list[str] = []
        for key in required:
            val = self.provider.get(user_id, key)
            if val:
                env[key] = val
            else:
                missing.append(key)
        return env, missing
