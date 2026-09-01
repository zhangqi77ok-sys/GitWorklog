"""Air-Gapped host enforcement: block outbound-network commands at the host."""
import json
import re
from pathlib import Path

OUTBOUND_NETWORK_PATTERNS = [
    r"\bcurl\b", r"\bwget\b", r"\bping\b", r"\btracert\b", r"\bnslookup\b",
    r"\bInvoke-WebRequest\b", r"\bInvoke-RestMethod\b", r"\biwr\b", r"\birm\b",
    r"\bStart-BitsTransfer\b", r"\bTest-NetConnection\b",
    r"\bgit\s+(push|fetch|clone|pull|remote)\b",
    r"\b(npm|pnpm|yarn|bun)\s+(install|add|ci)\b",
    r"\b(pip|pip3|uv)\s+install\b",
    r"\bssh\b", r"\bscp\b", r"\brsync\b", r"\bnpx\b",
]
_COMPILED = [re.compile(p, re.IGNORECASE) for p in OUTBOUND_NETWORK_PATTERNS]


def is_air_gapped(storage_dir) -> bool:
    try:
        f = Path(storage_dir) / "tcode_settings.json"
        if not f.is_file():
            return False
        data = json.loads(f.read_text(encoding="utf-8"))
        return bool(data.get("isAirGapped"))
    except Exception:
        return False


def blocks_network(command: str) -> bool:
    return any(p.search(command) for p in _COMPILED)
