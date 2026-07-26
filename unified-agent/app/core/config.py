"""统一配置：pydantic-settings 从环境变量 / .env 加载，全项目唯一配置入口。

用法：
    from app.core.config import settings
    settings.db.url  # 组装好的连接串

分组用嵌套 model，环境变量用前缀映射（如 DB_HOST -> settings.db.host）。
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class _Base(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


class AppSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="APP_", env_file=".env", extra="ignore")
    env: str = "dev"
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True


class AuthSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="AUTH_", env_file=".env", extra="ignore")
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 43200


class DBSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="DB_", env_file=".env", extra="ignore")
    host: str = "127.0.0.1"
    port: int = 3306
    name: str = "unified_agent"
    user: str = "root"
    password: str = ""

    @property
    def url(self) -> str:
        return (
            f"mysql+pymysql://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.name}?charset=utf8mb4"
        )


class RedisSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="REDIS_", env_file=".env", extra="ignore")
    host: str = "127.0.0.1"
    port: int = 6379
    db: int = 0

    @property
    def url(self) -> str:
        return f"redis://{self.host}:{self.port}/{self.db}"


class DataDBSettings(_Base):
    """data 域被查询业务库（独立只读连接，与平台库隔离）。"""

    model_config = SettingsConfigDict(env_prefix="DATA_DB_", env_file=".env", extra="ignore")
    host: str = "127.0.0.1"
    port: int = 3306
    name: str = "sakila"
    user: str = "readonly"
    password: str = ""

    @property
    def url(self) -> str:
        return (
            f"mysql+pymysql://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.name}?charset=utf8mb4"
        )


class PgVectorSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="PGVECTOR_", env_file=".env", extra="ignore")
    host: str = "127.0.0.1"
    port: int = 5432
    db: str = "vectors"
    user: str = "postgres"
    password: str = ""


class MinioSettings(_Base):
    model_config = SettingsConfigDict(env_prefix="MINIO_", env_file=".env", extra="ignore")
    endpoint: str = "127.0.0.1:9000"
    access_key: str = "minioadmin"
    secret_key: str = "minioadmin"
    bucket: str = "unified-agent-files"
    secure: bool = False


class LLMSettings(_Base):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    dashscope_api_key: str = Field(default="", alias="DASHSCOPE_API_KEY")
    deepseek_api_key: str = Field(default="", alias="DEEPSEEK_API_KEY")
    strong_model: str = Field(default="qwen3.7-max", alias="LLM_STRONG_MODEL")
    fast_model: str = Field(default="qwen3.6-flash", alias="LLM_FAST_MODEL")
    embedding_model: str = Field(default="text-embedding-v4", alias="LLM_EMBEDDING_MODEL")


class HookSettings(_Base):
    """Agent Hook 体系：熔断阈值、上下文压缩策略、持久化开关。"""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="HOOK_", extra="ignore")
    breaker_failure_threshold: int = 5
    breaker_cooldown_seconds: float = 30.0
    context_max_chars: int = 8000
    context_keep_recent: int = 6
    persist_enabled: bool = True


class Settings:
    """聚合各分组配置，供全项目引用的单例。"""

    def __init__(self) -> None:
        self.app = AppSettings()
        self.auth = AuthSettings()
        self.db = DBSettings()
        self.data_db = DataDBSettings()
        self.redis = RedisSettings()
        self.pgvector = PgVectorSettings()
        self.minio = MinioSettings()
        self.llm = LLMSettings()
        self.hooks = HookSettings()


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
