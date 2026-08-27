"""统一智能体平台桌面客户端启动器 (Desktop Application Launcher)。

支持独立桌面窗口运行，具备原生文件系统集成、Git 分支操作与编程开发能力。
启动命令：
  python desktop_launcher.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request

APP_URL = "http://127.0.0.1:8010/"
APP_TITLE = "统一智能体平台 · Enterprise Agent Studio"


def is_server_running() -> bool:
    try:
        with urllib.request.urlopen(f"{APP_URL}health", timeout=1) as resp:
            return resp.status == 200
    except Exception:
        return False


def start_backend():
    print("🚀 正在启动统一智能体后端服务 (Port: 8010)...")
    cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8010"]
    return subprocess.Popen(cmd, cwd=os.path.dirname(os.path.abspath(__file__)))


def main():
    if not is_server_running():
        start_backend()
        for _ in range(20):
            if is_server_running():
                break
            time.sleep(0.5)

    print(f"🎉 统一智能体平台已就绪: {APP_URL}")

    # 1. 尝试使用 pywebview 打开原生桌面窗口
    try:
        import webview

        print("🖥️ 正在使用原生 WebView 启动桌面客户端...")
        webview.create_window(
            APP_TITLE,
            APP_URL,
            width=1440,
            height=900,
            min_size=(1024, 700),
            confirm_close=True,
        )
        webview.start()
        return
    except ImportError:
        pass

    # 2. 降级使用 Edge/Chrome App 独立桌面应用模式
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ]

    for p in edge_paths:
        if os.path.exists(p):
            print(f"🖥️ 正在以独立桌面应用模式唤起: {p}")
            subprocess.run([p, f"--app={APP_URL}", "--window-size=1440,900"])
            return

    # 3. 默认浏览器兜底
    import webbrowser

    webbrowser.open(APP_URL)


if __name__ == "__main__":
    main()
