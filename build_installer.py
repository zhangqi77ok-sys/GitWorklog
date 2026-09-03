import os
import sys
import subprocess
import shutil
import zipfile
import urllib.request
import urllib.error
import time
import json

WORKSPACE = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(WORKSPACE, "frontend")
FRONTEND_DIST = os.path.join(FRONTEND_DIR, "dist")
RELEASE_DIR = os.path.join(WORKSPACE, "release")
DIST_DIR = os.path.join(WORKSPACE, "dist")
TEST_INSTALL_DIR = os.path.join(WORKSPACE, "test_install_sandbox")

def log(msg):
    print(f"\n[BUILD PIPELINE] ===> {msg}")

def run_cmd(cmd, cwd=WORKSPACE):
    log(f"Executing: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str))
    if res.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {res.returncode}")

def build_frontend():
    if not os.path.exists(os.path.join(FRONTEND_DIST, "index.html")):
        log("Frontend dist not found, running npm run build...")
        run_cmd("npm run build", cwd=FRONTEND_DIR)
    else:
        log("Frontend dist already built.")

def create_payload():
    log("Step 1: Compiling desktop_app.py -> Tcode.exe...")
    # 编译 Tcode.exe (包含前端静态资源)
    run_cmd([
        "pyinstaller",
        "--noconfirm",
        "--onedir",
        "--name", "Tcode",
        f"--add-data={FRONTEND_DIST};frontend_dist",
        "desktop_app.py"
    ])

    tcode_dir = os.path.join(DIST_DIR, "Tcode")
    log(f"Tcode package generated at: {tcode_dir}")

    # 将整个 Tcode 目录打包为 payload.zip
    payload_zip = os.path.join(WORKSPACE, "payload.zip")
    log(f"Packaging into {payload_zip}...")
    with zipfile.ZipFile(payload_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(tcode_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, tcode_dir)
                z.write(full_path, rel_path)
    return payload_zip

def build_installer(payload_zip):
    log("Step 2: Compiling setup_wizard.py -> Tcode-Setup.exe...")
    os.makedirs(RELEASE_DIR, exist_ok=True)
    os.makedirs(DIST_DIR, exist_ok=True)

    run_cmd([
        "pyinstaller",
        "--noconfirm",
        "--onefile",
        "--name", "Tcode-Setup",
        f"--add-data={payload_zip};.",
        "setup_wizard.py"
    ])

    setup_exe = os.path.join(DIST_DIR, "Tcode-Setup.exe")
    release_exe = os.path.join(RELEASE_DIR, "Tcode-Setup-v2.0.0.exe")
    shutil.copy2(setup_exe, release_exe)
    log(f"Successfully generated: {setup_exe}")
    log(f"Successfully generated release artifact: {release_exe}")
    return setup_exe

def test_installation_and_runtime(setup_exe):
    log("Step 3: Testing silent installation [Iron Rule 1.5]...")
    if os.path.exists(TEST_INSTALL_DIR):
        shutil.rmtree(TEST_INSTALL_DIR, ignore_errors=True)

    # 真实静默安装
    run_cmd([setup_exe, "--silent-install-dir", TEST_INSTALL_DIR])

    installed_tcode_exe = os.path.join(TEST_INSTALL_DIR, "Tcode.exe")
    if not os.path.exists(installed_tcode_exe):
        raise FileNotFoundError(f"Installed executable not found at: {installed_tcode_exe}")
    log(f"Verified: installed executable exists at {installed_tcode_exe}")

    log("Step 4: Launching installed Tcode.exe and running real E2E verification...")
    # 启动进程 (headless, port 8777)
    proc = subprocess.Popen([installed_tcode_exe, "--headless", "--port", "8777"])
    time.sleep(2.5)

    try:
        # 1. 探活验证
        log("Testing health probe: http://127.0.0.1:8777/api/health")
        with urllib.request.urlopen("http://127.0.0.1:8777/api/health", timeout=5) as res:
            assert res.status == 200
            data = json.loads(res.read().decode("utf-8"))
            assert data.get("status") == "healthy"
            log(f"Probe verified! Response: {data}")

        # 2. 静态页面挂载验证
        log("Testing static UI mount: http://127.0.0.1:8777/")
        with urllib.request.urlopen("http://127.0.0.1:8777/", timeout=5) as res:
            assert res.status == 200
            html = res.read().decode("utf-8")
            assert "<!doctype html>" in html.lower() or "<html" in html.lower()
            log(f"Static HTML verified! Payload size: {len(html)} bytes")

        log("SUCCESS: All Iron Rule 1.5 installation and runtime verification passed 100%!")
    finally:
        log("Terminating test process...")
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except Exception:
            proc.kill()

    # 清理测试目录与临时 payload
    if os.path.exists(TEST_INSTALL_DIR):
        shutil.rmtree(TEST_INSTALL_DIR, ignore_errors=True)
    payload_zip = os.path.join(WORKSPACE, "payload.zip")
    if os.path.exists(payload_zip):
        os.remove(payload_zip)

def main():
    print("================================================================")
    print("  Tcode Windows Standalone Installer Builder & E2E Verifier     ")
    print("================================================================")
    build_frontend()
    payload = create_payload()
    setup_exe = build_installer(payload)
    test_installation_and_runtime(setup_exe)
    print("\n[ALL FINISHED] 恭喜！Windows 桌面端安装包已全部打包并通过真实安装验证闭环！")

if __name__ == "__main__":
    main()
