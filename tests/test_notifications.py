"""Task A1: Windows 原生系统通知模块单元测试 (SDD+TDD 红灯先行).

通道: PowerShell 5.1 + System.Windows.Forms.NotifyIcon 气球通知。
说明: WinRT Toast 的 Activated 事件在 PowerShell 5.1 无法订阅（实测报错），
因此点击唤醒改用 .NET 事件（BalloonTipClicked）实现，零新增依赖。
"""
import subprocess
import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[1] / "src-desktop"
sys.path.insert(0, str(SRC))

import host_auth
import notifications


def _payload(**overrides):
    base = {
        "status": "success",
        "projectName": "agent-learning",
        "sessionTitle": "权限模型重构与验证",
        "sessionId": "sess-rbac-1",
        "summary": "验证完成！共处理 3,412 个条目，已生成报告。",
    }
    base.update(overrides)
    return base


def test_build_notify_script_uses_notifyicon():
    script = notifications.build_notify_script(_payload(), port=8010, token="tok")
    assert "System.Windows.Forms.NotifyIcon" in script
    assert "ShowBalloonTip" in script


def test_build_notify_script_escapes_single_quote_for_powershell():
    payload = _payload(sessionTitle="It's a \"test\"", summary="摘要 <b>& 内容")
    script = notifications.build_notify_script(payload, port=8010, token="tok")
    # PowerShell 单引号字符串内，单引号转义为两个单引号
    assert "It''s a" in script
    # & < > " 在 PowerShell 单引号字符串中为字面量，无需转义
    assert "摘要 <b>& 内容" in script


def test_build_notify_script_contains_restore_callback():
    payload = _payload(sessionId="sess-1")
    script = notifications.build_notify_script(payload, port=8010, token="tok")
    assert "http://127.0.0.1:8010/api/window/restore?sessionId=sess-1" in script
    assert "X-Tcode-Token'='tok" in script
    assert "Register-ObjectEvent" in script
    assert "BalloonTipClicked" in script
    assert "Wait-Event" in script


def test_build_notify_script_contains_title_and_summary():
    payload = _payload(sessionTitle="构建任务", summary="构建完成")
    script = notifications.build_notify_script(payload, port=8010, token="tok")
    assert "构建任务" in script
    assert "构建完成" in script


def test_build_notify_script_error_status_uses_error_icon():
    script = notifications.build_notify_script(_payload(status="error"), port=8010, token="tok")
    assert "[System.Windows.Forms.ToolTipIcon]::Error" in script


def test_build_notify_script_success_status_uses_info_icon():
    script = notifications.build_notify_script(_payload(status="success"), port=8010, token="tok")
    assert "[System.Windows.Forms.ToolTipIcon]::Info" in script


def test_show_system_notification_spawns_hidden_powershell(tmp_path, monkeypatch):
    monkeypatch.setattr(notifications, "get_notify_dir", lambda: tmp_path)
    calls = {}

    def fake_popen(cmd, **kwargs):
        calls["cmd"] = cmd
        calls["kwargs"] = kwargs
        return object()

    monkeypatch.setattr(subprocess, "Popen", fake_popen)
    host_auth.set_token("unit-test-token")
    notifications.show_system_notification(_payload(sessionId="sess-2"), port=8010)

    script_path = tmp_path / notifications.NOTIFY_SCRIPT_NAME
    assert script_path.is_file()
    expected = notifications.build_notify_script(_payload(sessionId="sess-2"), port=8010, token="unit-test-token")
    assert script_path.read_text(encoding="utf-8") == expected
    assert calls["cmd"][-2:] == ["-File", str(script_path)]
    assert calls["kwargs"]["creationflags"] == notifications.CREATE_NO_WINDOW
    assert calls["kwargs"]["startupinfo"].wShowWindow == subprocess.SW_HIDE


def test_show_system_notification_failure_raises(monkeypatch):
    def boom(*args, **kwargs):
        raise OSError("powershell not found")

    monkeypatch.setattr(subprocess, "Popen", boom)
    with pytest.raises(OSError):
        notifications.show_system_notification(_payload(), port=8010)
