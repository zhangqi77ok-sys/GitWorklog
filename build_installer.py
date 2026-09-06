#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tcode Studio 增量单文件安装包与桌面端构建流水线
符合铁律 1.5 要求，自动化完成前端生产构建、微内核编译、卸载程序与单文件安装向导封装
"""

import os
import sys
import shutil
import subprocess
import time
from pathlib import Path

# 确保在 Windows 控制台下支持 UTF-8 输出
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
BIN_DIR = ROOT_DIR / "bin"
DIST_DIR = ROOT_DIR / "dist"
RELEASE_DIR = ROOT_DIR / "release"
INSTALLER_ASSETS = ROOT_DIR / "cmd" / "installer" / "assets"

def setup_environment():
    """配置系统环境变量，确保 Go 与 Wails 工具链可用"""
    extra_paths = [
        r"C:\Users\Admin\go\bin",
        r"F:\codingEnvironment\go\bin",
        r"F:\codingEnvironment\apache-maven-3.9.11\bin",
        r"F:\codingEnvironment\jdk-21\bin",
    ]
    curr_path = os.environ.get("PATH", "")
    for p in extra_paths:
        if os.path.exists(p) and p.lower() not in curr_path.lower():
            curr_path = p + os.pathsep + curr_path
    os.environ["PATH"] = curr_path

def run_cmd(cmd, cwd=ROOT_DIR, check=True):
    print(f">> [EXEC] {cmd} (cwd: {cwd})")
    start_time = time.time()
    res = subprocess.run(cmd, cwd=str(cwd), shell=True)
    duration = time.time() - start_time
    if check and res.returncode != 0:
        print(f"[ERROR] Command failed with code {res.returncode} in {duration:.2f}s: {cmd}")
        sys.exit(res.returncode)
    print(f"[OK] Completed in {duration:.2f}s\n")

def build_installer():
    start_all = time.time()
    print("==================================================================")
    print("[BUILD] Tcode Studio Desktop & Standalone Installer Pipeline")
    print("==================================================================\n")

    setup_environment()
    BIN_DIR.mkdir(parents=True, exist_ok=True)
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    INSTALLER_ASSETS.mkdir(parents=True, exist_ok=True)

    # 1. 编译前端静态资源
    print("[STEP 1/5] Building frontend static assets (Vite Build)...")
    run_cmd("npm run build", cwd=FRONTEND_DIR)

    # 2. 编译 Wails 微内核桌面主体
    print("[STEP 2/5] Building Wails desktop micro-kernel application...")
    run_cmd("wails build -clean", cwd=ROOT_DIR)

    built_app = ROOT_DIR / "build" / "bin" / "tcode.exe"
    target_tcode = BIN_DIR / "tcode.exe"
    if not built_app.exists():
        print(f"[ERROR] Build output not found: {built_app}")
        sys.exit(1)
    shutil.copy2(str(built_app), str(target_tcode))
    print(f"[OK] Ready: {target_tcode} ({target_tcode.stat().st_size:,} bytes)")

    # 3. 编译卸载程序
    print("\n[STEP 3/5] Compiling standalone uninstaller (uninstall.exe)...")
    uninstaller_target = BIN_DIR / "uninstall.exe"
    run_cmd(f'go build -ldflags="-H windowsgui -s -w" -o "{uninstaller_target}" ./cmd/uninstaller', cwd=ROOT_DIR)
    print(f"[OK] Ready: {uninstaller_target} ({uninstaller_target.stat().st_size:,} bytes)")

    # 4. 拷贝资产至安装器 assets 目录
    print("\n[STEP 4/5] Packaging binary assets into installer directory...")
    shutil.copy2(str(target_tcode), str(INSTALLER_ASSETS / "tcode.exe"))
    shutil.copy2(str(uninstaller_target), str(INSTALLER_ASSETS / "uninstall.exe"))

    # 5. 编译单文件安装向导
    print("\n[STEP 5/5] Compiling standalone Windows Setup installer...")
    bin_installer = BIN_DIR / "TcodeStudio_Setup_v2.0.0.exe"
    run_cmd(f'go build -ldflags="-H windowsgui -s -w" -o "{bin_installer}" ./cmd/installer', cwd=ROOT_DIR)

    # 6. 同步复制至 dist/ 与 release/ 目录 (满足自动化与分发规约)
    dist_installer = DIST_DIR / "Tcode-Setup.exe"
    release_installer = RELEASE_DIR / "Tcode-Setup-v2.0.0.exe"
    shutil.copy2(str(bin_installer), str(dist_installer))
    shutil.copy2(str(bin_installer), str(release_installer))

    total_time = time.time() - start_all
    print("\n==================================================================")
    print(f"[SUCCESS] Packaging completed! Total time: {total_time:.2f}s")
    print("==================================================================")
    print(f"  • bin:     {bin_installer} ({bin_installer.stat().st_size:,} bytes)")
    print(f"  • dist:    {dist_installer} ({dist_installer.stat().st_size:,} bytes)")
    print(f"  • release: {release_installer} ({release_installer.stat().st_size:,} bytes)")
    print("==================================================================\n")

if __name__ == "__main__":
    build_installer()
