"""Host authentication & request policy for the local desktop HTTP server."""
import hmac
import secrets

HOST_TOKEN: str = ""

ALLOWED_ORIGINS = {
    "http://127.0.0.1:8010",
    "http://localhost:8010",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}

ALLOWED_HOST_NAMES = {"127.0.0.1", "localhost"}


def init_token() -> str:
    global HOST_TOKEN
    HOST_TOKEN = secrets.token_urlsafe(32)
    return HOST_TOKEN


def set_token(token: str) -> None:
    global HOST_TOKEN
    HOST_TOKEN = token


def get_token() -> str:
    return HOST_TOKEN


def token_is_valid(header_value: str | None) -> bool:
    if not header_value or not HOST_TOKEN:
        return False
    return hmac.compare_digest(header_value, HOST_TOKEN)


def origin_is_allowed(origin: str | None) -> bool:
    if origin is None:
        return True  # same-origin / non-browser request
    return origin in ALLOWED_ORIGINS


def host_is_allowed(host_header: str | None, port: int) -> bool:
    if not host_header:
        return False
    name, _, port_str = host_header.rpartition(":")
    if not name:
        return False
    if port_str != str(port):
        return False
    return name.lower() in ALLOWED_HOST_NAMES
