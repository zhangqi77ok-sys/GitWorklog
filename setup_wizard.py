import os
import sys
import shutil
import argparse
import zipfile

def get_base_dir():
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

def main():
    parser = argparse.ArgumentParser(description="Tcode Desktop Setup Wizard")
    parser.add_argument("--silent-install-dir", type=str, help="Install silently to target directory")
    args = parser.parse_args()

    target_dir = args.silent_install_dir
    if not target_dir:
        # 默认安装目录
        local_app_data = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
        target_dir = os.path.join(local_app_data, "Programs", "Tcode")

    target_dir = os.path.abspath(target_dir)
    os.makedirs(target_dir, exist_ok=True)
    print(f"==================================================")
    print(f"  Tcode Desktop Standalone Setup Wizard v2.0.0   ")
    print(f"==================================================")
    print(f"[Setup] Target install directory: {target_dir}")

    base_dir = get_base_dir()
    payload_zip = os.path.join(base_dir, "payload.zip")

    if os.path.exists(payload_zip):
        print(f"[Setup] Extracting payload package...")
        with zipfile.ZipFile(payload_zip, "r") as z:
            z.extractall(target_dir)
    else:
        # 开发态回退拷贝
        print(f"[Setup] Copying files from workspace...")
        tcode_exe = os.path.join(base_dir, "dist", "Tcode.exe")
        if os.path.exists(tcode_exe):
            shutil.copy2(tcode_exe, os.path.join(target_dir, "Tcode.exe"))

    # 写入安装标识与版本元信息
    version_file = os.path.join(target_dir, "version.json")
    with open(version_file, "w", encoding="utf-8") as f:
        f.write('{"name":"Tcode","version":"2.0.0","installed_at":"' + str(os.path.getmtime(target_dir)) + '"}')

    print(f"[Setup] Installation completed successfully!")
    print(f"[Setup] Executable located at: {os.path.join(target_dir, 'Tcode.exe')}")

if __name__ == "__main__":
    main()
