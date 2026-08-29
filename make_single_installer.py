import os
import shutil
import zipfile
import subprocess

ROOT_DIR = r"D:\weihu\agent-learning"
SRC_TAURI_EXE = os.path.join(ROOT_DIR, "src-tauri", "target", "release", "codemind-hub.exe")
WEBVIEW2_DLL = os.path.join(ROOT_DIR, "WebView2Loader.dll")
ICON_PATH = os.path.join(ROOT_DIR, "src-tauri", "icons", "icon.ico")
PKG_DIR = os.path.join(ROOT_DIR, "_pkg_tmp")
ZIP_PAYLOAD = os.path.join(ROOT_DIR, "app_payload.zip")
SETUP_RC = os.path.join(ROOT_DIR, "setup_wizard.rc")
SETUP_RES = os.path.join(ROOT_DIR, "setup_wizard.res")
SETUP_C = os.path.join(ROOT_DIR, "setup_wizard.c")
TARGET_SETUP_EXE = os.path.join(ROOT_DIR, "CodeMind-Studio-Setup.exe")

print("1. 提取执行程序与运行时依赖...")
if os.path.exists(PKG_DIR):
    shutil.rmtree(PKG_DIR)
os.makedirs(PKG_DIR, exist_ok=True)

shutil.copy2(SRC_TAURI_EXE, os.path.join(PKG_DIR, "CodeMind-Studio.exe"))
shutil.copy2(WEBVIEW2_DLL, os.path.join(PKG_DIR, "WebView2Loader.dll"))
shutil.copy2(ICON_PATH, os.path.join(PKG_DIR, "app.ico"))

print("2. 封装内嵌 Payload...")
if os.path.exists(ZIP_PAYLOAD):
    os.remove(ZIP_PAYLOAD)

with zipfile.ZipFile(ZIP_PAYLOAD, "w", zipfile.ZIP_DEFLATED) as zf:
    for f in ["CodeMind-Studio.exe", "WebView2Loader.dll", "app.ico"]:
        fp = os.path.join(PKG_DIR, f)
        zf.write(fp, arcname=f)

print("3. 编译资源与安装向导...")
with open(SETUP_RC, "w", encoding="ascii") as f:
    f.write('100 RCDATA "app_payload.zip"\n1 ICON "src-tauri/icons/icon.ico"\n')

subprocess.run(["windres", "-i", SETUP_RC, "-O", "coff", "-o", SETUP_RES], cwd=ROOT_DIR, check=True)

subprocess.run([
    "gcc", "-O2", "-municode",
    SETUP_C, SETUP_RES,
    "-o", TARGET_SETUP_EXE,
    "-mwindows", "-lcomctl32", "-lole32", "-luuid", "-lshell32", "-lgdi32", "-luser32"
], cwd=ROOT_DIR, check=True)

# 清理冗余的中间与旧版安装包
redundant_files = [
    os.path.join(ROOT_DIR, "CodeMind-Studio-Tauri-Setup-v0.10.0.exe"),
    os.path.join(ROOT_DIR, "CodeMind-Studio-Tauri-Setup-v2.11.0.exe"),
    os.path.join(ROOT_DIR, "CodeMind-Studio-Setup-v2.11.0.exe"),
    SETUP_RC, SETUP_RES, ZIP_PAYLOAD
]
for rf in redundant_files:
    if os.path.exists(rf):
        try:
            os.remove(rf)
        except Exception:
            pass

if os.path.exists(PKG_DIR):
    shutil.rmtree(PKG_DIR)

print(f"SUCCESS: {TARGET_SETUP_EXE} ({os.path.getsize(TARGET_SETUP_EXE) / 1024 / 1024:.2f} MB)")
