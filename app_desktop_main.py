"""RunCabinet · Vite Coding Studio
Windows 原生桌面客户端独立入口 (Standalone Windows Desktop Entrypoint).

特点：
1. 内嵌启动 FastAPI + Uvicorn 微内核后端（后台多线程运行，无需额外黑窗口控制台）；
2. 基于 Windows 10/11 原生 Microsoft Edge WebView2 渲染独立桌面窗口；
3. 支持离线独立打包为 Windows .exe 可执行程序及安装包。
"""

from __future__ import annotations

import os
import sys
import threading
import time
import urllib.request
import uvicorn

if getattr(sys, "frozen", False):
    BASE_DIR = os.path.dirname(sys.executable)
    BUNDLE_DIR = sys._MEIPASS  # type: ignore
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    BUNDLE_DIR = BASE_DIR

os.chdir(BASE_DIR)
os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, BUNDLE_DIR)

from app.main import app

PORT = 8010
HOST = "127.0.0.1"
SERVER_URL = f"http://{HOST}:{PORT}"
APP_TITLE = "RunCabinet · Vite Coding Studio"


def run_backend_server():
    """在后台独立线程中运行 FastAPI Uvicorn 服务。"""
    config = uvicorn.Config(
        app=app,
        host=HOST,
        port=PORT,
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config)
    server.run()


def wait_for_server(timeout_sec: float = 15.0) -> bool:
    """等待后端 HTTP 探针就绪。"""
    start_time = time.time()
    while time.time() - start_time < timeout_sec:
        try:
            with urllib.request.urlopen(f"{SERVER_URL}/health", timeout=1) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(0.2)
    return False


def main():
    print(f"🚀 正在启动 {APP_TITLE} 内核后端服务...")
    backend_thread = threading.Thread(target=run_backend_server, daemon=True)
    backend_thread.start()

    if not wait_for_server():
        print("⚠️ 警告：后端服务就绪探针超时，尝试继续启动桌面窗口...")
    else:
        print(f"✅ 后端微内核服务已成功就绪: {SERVER_URL}")

    # 1. 尝试使用原生 Microsoft Edge WebView2 (pywebview)
    try:
        import webview

        print("🖥️ 正在创建 RunCabinet 原生桌面应用窗口 (Edge WebView2)...")
        window = webview.create_window(
            title=APP_TITLE,
            url=SERVER_URL,
            width=1540,
            height=940,
            min_size=(1024, 700),
            resizable=True,
            confirm_close=False,
            easy_drag=False,
        )
        webview.start(debug=False)
        print("👋 桌面客户端已安全退出。")
        sys.exit(0)
    except Exception as e:
        print(f"ℹ️ 原生 WebView 启动回退: {e}")

    # 2. 降级为以独立 Edge/Chrome App 窗口启动
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ]
    for p in edge_paths:
        if os.path.exists(p):
            print(f"🖥️ 正在以独立应用窗口唤起: {p}")
            import subprocess
            subprocess.run([p, f"--app={SERVER_URL}", "--window-size=1540,940"])
            sys.exit(0)

    # 3. 默认浏览器兜底
    import webbrowser
    webbrowser.open(SERVER_URL)
    while True:
        time.sleep(1)


if __name__ == "__main__":
    main()
