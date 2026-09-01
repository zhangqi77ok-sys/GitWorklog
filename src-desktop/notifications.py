"""src-desktop/notifications.py — Windows 原生系统通知模块 (Task A1).

通道: PowerShell 5.1 + System.Windows.Forms.NotifyIcon 气球通知。
为何不用 WinRT Toast: PowerShell 5.1 无法订阅 WinRT 事件（实测 Register-ObjectEvent
报 "cannot subscribe to Windows RT events"），点击回调不可用；NotifyIcon 的
BalloonTipClicked 是 .NET 事件，PowerShell 可订阅，实现「点击 -> 宿主唤醒窗口」闭环，
且零新增依赖。
"""

import base64
import os
import subprocess
from pathlib import Path
from urllib.parse import quote

import host_auth

NOTIFY_DIR_NAME = "notify"
NOTIFY_SCRIPT_NAME = "notify.ps1"
NOTIFY_ERROR_LOG_NAME = "notify_error.log"
NOTIFY_TIMEOUT_SECONDS = 15
BALLOON_DISPLAY_MS = 8000

CREATE_NO_WINDOW = 0x08000000
POWERSHELL_EXE = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"


def get_notify_dir() -> Path:
    """通知脚本与错误日志落盘目录（LOCALAPPDATA/Tcode/notify，随宿主升级保留）。"""
    appdata = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
    base = Path(appdata) / "Tcode" / NOTIFY_DIR_NAME
    base.mkdir(parents=True, exist_ok=True)
    return base


def _powershell_single_quote(value: str) -> str:
    """PowerShell 单引号字符串转义（'' 表示字面单引号）。"""
    return str(value).replace("'", "''")


def build_notify_script(payload: dict, port: int, token: str, timeout_seconds: int = NOTIFY_TIMEOUT_SECONDS) -> str:
    """生成 PowerShell NotifyIcon 气球通知脚本文本（Base64 安全编码，彻底杜绝中文乱码）。"""
    project_name = payload.get("projectName") or ""
    session_title = payload.get("sessionTitle") or "Tcode 会话"
    session_id = payload.get("sessionId") or ""
    summary = payload.get("summary") or ""

    title = f"Tcode · {project_name}" if project_name else "Tcode"
    message = f"{session_title}\n{summary}" if session_title else summary
    icon = "Error" if payload.get("status") == "error" else "Info"

    title_b64 = base64.b64encode(title.encode("utf-8")).decode("ascii")
    message_b64 = base64.b64encode(message.encode("utf-8")).decode("ascii")

    restore_url = (
        "http://127.0.0.1:{port}/api/window/restore?sessionId={encoded}"
    ).format(port=int(port), encoded=quote(session_id, safe=""))
    error_log = get_notify_dir() / NOTIFY_ERROR_LOG_NAME

    return """\
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.Visible = $true
$titleBytes = [System.Convert]::FromBase64String('{title_b64}')
$notify.BalloonTipTitle = [System.Text.Encoding]::UTF8.GetString($titleBytes)
$msgBytes = [System.Convert]::FromBase64String('{message_b64}')
$notify.BalloonTipText = [System.Text.Encoding]::UTF8.GetString($msgBytes)
$notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::{icon}
try {{
  $notify.ShowBalloonTip({display_ms})
}} catch {{
  $_.Exception | Out-File -FilePath '{error_log}' -Encoding utf8
  exit 1
}}
Register-ObjectEvent -InputObject $notify -EventName BalloonTipClicked -SourceIdentifier TcodeBalloonClicked -Action {{
  try {{
    Invoke-RestMethod -Method Get -Uri '{restore_url}' -Headers @{{'X-Tcode-Token'='{token}'}} -TimeoutSec 5 | Out-Null
  }} catch {{
    $_.Exception | Out-File -FilePath '{error_log}' -Encoding utf8
  }}
}} | Out-Null
Wait-Event -SourceIdentifier TcodeBalloonClicked -Timeout {timeout} | Out-Null
$notify.Dispose()
""".format(
        title_b64=title_b64,
        message_b64=message_b64,
        icon=icon,
        display_ms=BALLOON_DISPLAY_MS,
        error_log=_powershell_single_quote(str(error_log)),
        restore_url=restore_url,
        token=_powershell_single_quote(token),
        timeout=int(timeout_seconds),
    )


def show_system_notification(payload: dict, port: int) -> None:
    """将通知脚本落盘并以隐藏窗口方式派发独立 PowerShell 进程。"""
    script = build_notify_script(payload, port, host_auth.get_token())
    script_path = get_notify_dir() / NOTIFY_SCRIPT_NAME
    script_path.write_text(script, encoding="utf-8-sig")

    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startupinfo.wShowWindow = subprocess.SW_HIDE

    subprocess.Popen(
        [
            POWERSHELL_EXE,
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script_path),
        ],
        creationflags=CREATE_NO_WINDOW,
        startupinfo=startupinfo,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
