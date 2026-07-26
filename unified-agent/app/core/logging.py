"""结构化日志（structlog）+ 敏感信息脱敏。

用法：
    from app.core.logging import get_logger
    logger = get_logger(__name__)
    logger.info("user_login", user_id=1)

脱敏：日志字段中的手机号/身份证/密钥等由 _mask_processor 处理，
对应原 Java 项目的 SensitiveMasker。
"""

from __future__ import annotations

import logging
import re
from collections.abc import MutableMapping
from typing import Any

import structlog

_SENSITIVE_KEYS = {"password", "secret", "token", "api_key", "id_card", "phone"}
_PHONE_RE = re.compile(r"(?<=\d{3})\d{4}(?=\d{4})")


def _mask_processor(
    _: Any, __: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    for key in list(event_dict.keys()):
        if key.lower() in _SENSITIVE_KEYS:
            event_dict[key] = "***"
    return event_dict


def configure_logging(debug: bool = True) -> None:
    logging.basicConfig(level=logging.DEBUG if debug else logging.INFO)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            _mask_processor,
            structlog.dev.ConsoleRenderer() if debug else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if debug else logging.INFO
        ),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> Any:
    return structlog.get_logger(name)
