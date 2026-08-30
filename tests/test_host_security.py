import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src-desktop"
sys.path.insert(0, str(SRC))

import host_auth


def test_init_token_generates_and_roundtrips():
    tok = host_auth.init_token()
    assert tok and len(tok) >= 32
    assert host_auth.get_token() == tok
    assert host_auth.token_is_valid(tok)


def test_token_validation_fail_closed():
    host_auth.set_token("test-token-123")
    assert host_auth.token_is_valid("test-token-123")
    assert not host_auth.token_is_valid("wrong-token")
    assert not host_auth.token_is_valid(None)
    assert not host_auth.token_is_valid("")
    assert not host_auth.token_is_valid("test-token-1234")


def test_origin_whitelist():
    assert host_auth.origin_is_allowed("http://127.0.0.1:8010")
    assert host_auth.origin_is_allowed("http://localhost:8010")
    assert host_auth.origin_is_allowed("http://localhost:5173")
    assert host_auth.origin_is_allowed("http://127.0.0.1:5173")
    assert host_auth.origin_is_allowed(None)
    assert not host_auth.origin_is_allowed("http://evil.example.com")
    assert not host_auth.origin_is_allowed("https://api.openai.com")


def test_host_header_validation():
    assert host_auth.host_is_allowed("127.0.0.1:8010", 8010)
    assert host_auth.host_is_allowed("localhost:8010", 8010)
    assert not host_auth.host_is_allowed("evil.example.com:8010", 8010)
    assert not host_auth.host_is_allowed("127.0.0.1:9999", 8010)
    assert not host_auth.host_is_allowed(None, 8010)
