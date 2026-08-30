"""Windows DPAPI credential encryption (ctypes, zero runtime deps)."""
import base64
import ctypes
import os
from ctypes import wintypes


class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


CRYPTPROTECT_UI_FORBIDDEN = 0x1


def _blob(data: bytes) -> DATA_BLOB:
    buf = ctypes.create_string_buffer(data, len(data))
    return DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))


def protect_bytes(data: bytes) -> bytes:
    if os.name != "nt":
        raise NotImplementedError("DPAPI is Windows-only")
    blob_in = _blob(data)
    blob_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(blob_in), None, None, None, None,
        CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(blob_out),
    ):
        raise OSError("CryptProtectData failed")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)


def unprotect_bytes(blob: bytes) -> bytes:
    if os.name != "nt":
        raise NotImplementedError("DPAPI is Windows-only")
    blob_in = _blob(blob)
    blob_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out),
    ):
        raise OSError("CryptUnprotectData failed")
    try:
        return ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)


def encrypt_text(plain: str) -> str:
    return base64.b64encode(protect_bytes(plain.encode("utf-8"))).decode("ascii")


def decrypt_text(encoded: str) -> str:
    return unprotect_bytes(base64.b64decode(encoded)).decode("utf-8")


def is_encrypted_envelope(value) -> bool:
    return isinstance(value, dict) and value.get("__tcode_enc__") is True


def make_envelope(plain: str) -> dict:
    return {"__tcode_enc__": True, "alg": "dpapi", "v": encrypt_text(plain)}


def unwrap_envelope(envelope: dict) -> str:
    return decrypt_text(envelope["v"])
