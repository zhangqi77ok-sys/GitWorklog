import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src-desktop"
sys.path.insert(0, str(SRC))

import airgap


def test_blocks_obvious_network_commands():
    for cmd in [
        "curl https://example.com",
        "wget http://example.com/x",
        "Invoke-WebRequest https://example.com",
        "irm https://example.com",
        "git push origin main",
        "git clone https://github.com/x/y",
        "npm install",
        "pip install requests",
        "ssh user@host",
        "ping 8.8.8.8",
    ]:
        assert airgap.blocks_network(cmd), cmd


def test_allows_local_commands():
    for cmd in [
        "echo hi",
        "git status",
        "git diff",
        "python -m pytest tests",
        "npm test",
        "node --version",
        "ls",
    ]:
        assert not airgap.blocks_network(cmd), cmd


def test_is_air_gapped_reads_settings(tmp_path):
    assert airgap.is_air_gapped(tmp_path) is False
    (tmp_path / "tcode_settings.json").write_text(
        '{"isAirGapped": true, "theme": "paper-warm"}', encoding="utf-8"
    )
    assert airgap.is_air_gapped(tmp_path) is True
    (tmp_path / "tcode_settings.json").write_text('{"isAirGapped": false}', encoding="utf-8")
    assert airgap.is_air_gapped(tmp_path) is False
