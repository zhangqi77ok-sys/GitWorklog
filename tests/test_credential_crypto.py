import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src-desktop"
sys.path.insert(0, str(SRC))

import credential_crypto


def test_roundtrip_encrypt_decrypt():
    plain = "fake-api-key-0123456789abcdef"
    enc = credential_crypto.encrypt_text(plain)
    assert enc != plain
    assert plain not in enc
    assert credential_crypto.decrypt_text(enc) == plain


def test_protect_unprotect_bytes_roundtrip():
    blob = credential_crypto.protect_bytes(b"hello-dpapi")
    assert blob != b"hello-dpapi"
    assert credential_crypto.unprotect_bytes(blob) == b"hello-dpapi"


def test_envelope_make_unwrap():
    env = credential_crypto.make_envelope("secret-value")
    assert credential_crypto.is_encrypted_envelope(env)
    assert credential_crypto.unwrap_envelope(env) == "secret-value"


def test_plain_dict_is_not_envelope():
    assert not credential_crypto.is_encrypted_envelope({"apiKey": "fake-api-key-0123456789abcdef"})
    assert not credential_crypto.is_encrypted_envelope(None)
