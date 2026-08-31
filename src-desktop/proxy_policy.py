"""SSRF guard: upstream target allowlist for the local /api/proxy relay."""
import ipaddress
from urllib.parse import urlparse

DEFAULT_ALLOWED_HOSTS = {
    "opencode.ai", "api.openai.com", "auth.openai.com", "chatgpt.com",
    "api.anthropic.com", "platform.claude.com", "claude.ai",
    "api.x.ai", "accounts.x.ai",
    "generativelanguage.googleapis.com",
    "api.deepseek.com", "api.moonshot.cn", "api.dashscope.aliyuncs.com",
    "api.siliconflow.cn", "api.z.ai", "agentrouter.org",
}

LOCAL_HOSTS = {"127.0.0.1", "localhost", "0.0.0.0", "::1"}


def _is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def is_allowed_target(url: str, extra_hosts=None) -> tuple:
    extra_hosts = extra_hosts or set()
    try:
        parsed = urlparse(url)
    except ValueError:
        return False, "MALFORMED_URL"
    if parsed.scheme not in ("https", "http"):
        return False, "SCHEME_NOT_ALLOWED"
    if parsed.username or parsed.password:
        return False, "URL_WITH_CREDENTIALS"
    host = (parsed.hostname or "").lower()
    if not host:
        return False, "EMPTY_HOST"
    if host in LOCAL_HOSTS:
        if parsed.scheme != "http":
            return False, "LOCAL_HOST_MUST_BE_HTTP"
        return True, ""
    if parsed.scheme != "https":
        return False, "NON_LOCAL_HTTP_DENIED"
    if _is_ip_literal(host):
        return False, "IP_LITERAL_DENIED"
    allowed = DEFAULT_ALLOWED_HOSTS | extra_hosts
    if host in allowed or any(host.endswith("." + h) for h in allowed):
        return True, ""
    return False, "UNKNOWN_HOST"


def extract_extra_hosts(providers_payload) -> set:
    hosts = set()
    for p in providers_payload or []:
        base = (p or {}).get("baseUrl")
        if not base:
            continue
        try:
            parsed = urlparse(str(base))
        except ValueError:
            continue
        h = (parsed.hostname or "").lower()
        if h and h not in LOCAL_HOSTS:
            hosts.add(h)
    return hosts
