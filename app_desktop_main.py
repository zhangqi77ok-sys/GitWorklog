import os
import sys
import time
import urllib.request
import threading
import asyncio
import subprocess
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

def start_backend():
    (ROOT_DIR / "data").mkdir(parents=True, exist_ok=True)
    import uvicorn
    from app.main import app

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    config = uvicorn.Config(
        app=app,
        host="127.0.0.1",
        port=8010,
        log_level="warning",
        loop="asyncio"
    )
    server = uvicorn.Server(config)
    loop.run_until_complete(server.serve())

def main():
    print("🚀 正在启动 CodeMind-Hub 原生桌面客户端后台微内核服务...")
    backend_thread = threading.Thread(target=start_backend, daemon=True)
    backend_thread.start()

    server_url = "http://127.0.0.1:8010"
    ready = False
    for i in range(35):
        time.sleep(0.3)
        try:
            with urllib.request.urlopen(f"{server_url}/health", timeout=1) as resp:
                if resp.status == 200:
                    ready = True
                    break
        except Exception:
            pass

    if not ready:
        print("❌ 服务启动超时！")
        sys.exit(1)

    print(f"✅ 后端服务已就绪: {server_url}")

    edge_candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"),
    ]
    edge_exe = None
    for cand in edge_candidates:
        if os.path.exists(cand):
            edge_exe = cand
            break

    profile_dir = ROOT_DIR / "data" / "edge_profile"
    profile_dir.mkdir(parents=True, exist_ok=True)

    if edge_exe:
        print(f"🖥️ 正在以独立应用窗口唤起 CodeMind-Hub: {edge_exe}")
        cmd = [
            edge_exe,
            f"--app={server_url}",
            "--window-size=1560,940",
            f"--user-data-dir={profile_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions"
        ]
        proc = subprocess.Popen(cmd)
        proc.wait()
    else:
        print(f"🌐 未探测到专用 Edge 引擎，打开默认浏览器: {server_url}")
        webbrowser.open(server_url)
        while True:
            time.sleep(1)

if __name__ == "__main__":
    main()
