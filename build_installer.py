# -*- coding: utf-8 -*-
"""
CodeMind-Hub 增量安装包构建工具 (Incremental Installer Builder)
每次功能开发完成后自动调用，极速增量构建单文件安装程序 CodeMind-Studio-Setup.exe
"""
import os
import sys
import shutil
import zipfile
import subprocess
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

def run_cmd(cmd, check=True):
    print(f"--> [CMD] {cmd}")
    res = subprocess.run(cmd, shell=True, cwd=str(ROOT_DIR))
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed with code {res.returncode}: {cmd}")
    return res.returncode

def incremental_build():
    start_time = time.time()
    print("==================================================================")
    print("🚀 开始增量构建 CodeMind-Studio-Setup.exe 安装包...")
    print("==================================================================")

    # 1. 增量构建前端产物
    print("\n[Step 1/4] 增量构建前端静态产物 (TypeScript + Vite)...")
    run_cmd("npm run build")

    # 2. 检查并同步至 dist/CodeMind-Studio 目录
    print("\n[Step 2/4] 同步更新运行时工作目录...")
    studio_dir = ROOT_DIR / "dist" / "CodeMind-Studio"
    need_full_rebuild = not (studio_dir / "CodeMind-Studio.exe").exists()

    if need_full_rebuild:
        print("首次或核心运行库缺失，触发全量 PyInstaller 运行时构建...")
        run_cmd("uv run --with pyinstaller pyinstaller CodeMind-Studio.spec --noconfirm")
    else:
        print("增量同步静态资源与页面文件...")
        # 增量复制 dist 到 studio_dir/dist
        dest_dist = studio_dir / "dist"
        if dest_dist.exists():
            shutil.rmtree(dest_dist)
        shutil.copytree(ROOT_DIR / "dist", dest_dist, ignore=shutil.ignore_patterns("CodeMind-Studio*", "*.exe", "*.zip"))

    # 3. 压缩运行时载荷为 app_payload.zip
    print("\n[Step 3/4] 压缩封装应用载荷包 (app_payload.zip)...")
    zip_path = ROOT_DIR / "app_payload.zip"
    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, dirs, files in os.walk(str(studio_dir)):
            for f in files:
                fp = os.path.join(root, f)
                arcname = os.path.relpath(fp, str(studio_dir))
                zf.write(fp, arcname)

    zip_size_mb = zip_path.stat().st_size / 1024 / 1024
    print(f"✔ 载荷包压缩完成: {zip_size_mb:.2f} MB")

    # 4. 增量编译单文件图形化安装包
    print("\n[Step 4/4] 编译单文件 Windows 安装向导 CodeMind-Studio-Setup.exe...")
    run_cmd("uv run --with pyinstaller pyinstaller CodeMind-Studio-Setup.spec --noconfirm")

    setup_exe = ROOT_DIR / "dist" / "CodeMind-Studio-Setup.exe"
    if not setup_exe.exists():
        raise FileNotFoundError(f"未找到生成的安装包: {setup_exe}")

    exe_size_mb = setup_exe.stat().st_size / 1024 / 1024
    duration = time.time() - start_time

    # 清理中间 zip 载荷保持目录整洁
    if zip_path.exists():
        zip_path.unlink()

    print("\n==================================================================")
    print(f"🎉 增量安装包构建成功！")
    print(f"📦 产物路径: {setup_exe}")
    print(f"📊 文件大小: {exe_size_mb:.2f} MB")
    print(f"⏱️ 耗时统计: {duration:.2f} 秒")
    print("==================================================================")

if __name__ == "__main__":
    incremental_build()
