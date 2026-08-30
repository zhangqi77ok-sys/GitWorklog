import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROTOTYPE_DIR = ROOT / "prototype"
FRONTEND_DIST = PROTOTYPE_DIR / "dist"
DESKTOP_ENTRY = ROOT / "src-desktop" / "desktop_app.py"
SETUP_ENTRY = ROOT / "src-desktop" / "setup_wizard.py"
BUILD_TEMP = ROOT / "build_temp"
RELEASE_DIR = ROOT / "release"
CORE_DIST_DIR = BUILD_TEMP / "core"
PAYLOAD_DIR = BUILD_TEMP / "payload"
WORK_CORE_DIR = BUILD_TEMP / "work_core"
WORK_SETUP_DIR = BUILD_TEMP / "work_setup"

VERSION = "1.5.0"
CORE_EXE_NAME = "Tcode-Core.exe"
SETUP_EXE_NAME = f"Tcode-Setup-v{VERSION}.exe"
ZIP_NAME = f"Tcode-Setup-v{VERSION}-windows-x64.zip"

CORE_OUTPUT = CORE_DIST_DIR / CORE_EXE_NAME
INSTALLER_OUTPUT = RELEASE_DIR / SETUP_EXE_NAME
COMPAT_INSTALLER_OUTPUT = ROOT / "dist" / "Tcode-Setup.exe"
ZIP_OUTPUT = RELEASE_DIR / ZIP_NAME

PYINSTALLER_EXE = r"C:\Users\13605\AppData\Roaming\uv\python\cpython-3.12.14-windows-x86_64-none\Scripts\pyinstaller.exe"
if not os.path.exists(PYINSTALLER_EXE):
    PYINSTALLER_EXE = sys.executable

NODE_EXECUTABLE = shutil.which("node") or shutil.which("node.exe") or "node"
NPM_CLI = Path(NODE_EXECUTABLE).resolve().parent / "node_modules" / "npm" / "bin" / "npm-cli.js"


def frontend_npm_command(*args: str) -> list[str]:
    """Invoke npm through Node to avoid Windows PowerShell/npm.cmd policy wrappers."""
    if not NPM_CLI.is_file():
        raise FileNotFoundError(f"Node npm CLI was not found at {NPM_CLI}")
    return [NODE_EXECUTABLE, str(NPM_CLI), *args]

def pyinstaller_base_cmd() -> list[str]:
    if PYINSTALLER_EXE == sys.executable:
        return [sys.executable, "-m", "PyInstaller"]
    return [PYINSTALLER_EXE]

def run(command: list[str], cwd: Path | None = None) -> None:
    print("\n> " + " ".join(f'"{part}"' if " " in part else part for part in command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)

def clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)

def build() -> Path:
    print(f"=== [Tcode v{VERSION}] Starting Release Build Pipeline ===")
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Build & Test Frontend
    print("\n[1/5] Building prototype frontend...")
    run(frontend_npm_command("run", "build"), cwd=PROTOTYPE_DIR)
    print("\n[2/5] Running Vitest unit tests...")
    run(frontend_npm_command("test"), cwd=PROTOTYPE_DIR)

    if not FRONTEND_DIST.joinpath("index.html").is_file():
        raise FileNotFoundError(f"Frontend build did not create {FRONTEND_DIST / 'index.html'}")

    clean_dir(CORE_DIST_DIR)
    clean_dir(PAYLOAD_DIR)
    clean_dir(WORK_CORE_DIR)
    clean_dir(WORK_SETUP_DIR)

    # 2. Build Tcode-Core.exe
    print(f"\n[3/5] Compiling {CORE_EXE_NAME}...")
    icon_path = ROOT / "src-desktop" / "icon.ico"
    core_cmd = [
        *pyinstaller_base_cmd(),
        "--noconfirm",
        "--clean",
        "--windowed",
        "--onefile",
        "--name=Tcode-Core",
        f"--icon={icon_path}",
        f"--add-data={FRONTEND_DIST}{os.pathsep}dist",
        f"--distpath={CORE_DIST_DIR}",
        f"--workpath={WORK_CORE_DIR}",
        f"--specpath={BUILD_TEMP}",
        str(DESKTOP_ENTRY)
    ]
    run(core_cmd, cwd=ROOT)
    if not CORE_OUTPUT.is_file():
        raise FileNotFoundError(f"Failed to create {CORE_OUTPUT}")

    # 3. Inject payload
    shutil.copy2(CORE_OUTPUT, PAYLOAD_DIR / CORE_EXE_NAME)
    if (ROOT / "src-desktop" / "app.ico").is_file():
        shutil.copy2(ROOT / "src-desktop" / "app.ico", PAYLOAD_DIR / "app.ico")

    # 4. Build Tcode-Setup-v1.5.0.exe
    print(f"\n[4/5] Compiling {SETUP_EXE_NAME} in {RELEASE_DIR}...")
    setup_cmd = [
        *pyinstaller_base_cmd(),
        "--noconfirm",
        "--clean",
        "--windowed",
        "--onefile",
        f"--name=Tcode-Setup-v{VERSION}",
        f"--icon={icon_path}",
        f"--add-data={PAYLOAD_DIR}{os.pathsep}payload",
        f"--distpath={RELEASE_DIR}",
        f"--workpath={WORK_SETUP_DIR}",
        f"--specpath={BUILD_TEMP}",
        str(SETUP_ENTRY)
    ]
    run(setup_cmd, cwd=ROOT)

    if not INSTALLER_OUTPUT.is_file() or INSTALLER_OUTPUT.stat().st_size == 0:
        raise FileNotFoundError(f"Failed to create installer: {INSTALLER_OUTPUT}")

    # Keep the stable single-file contract used by local smoke tests and CI.
    COMPAT_INSTALLER_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(INSTALLER_OUTPUT, COMPAT_INSTALLER_OUTPUT)

    # 5. Create zip distribution package
    print(f"\n[5/5] Creating {ZIP_NAME}...")
    import zipfile
    import time
    time.sleep(1.0)
    with zipfile.ZipFile(ZIP_OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(INSTALLER_OUTPUT, arcname=INSTALLER_OUTPUT.name)

    print(f"\n✨ Successfully generated Windows installer: {INSTALLER_OUTPUT} ({INSTALLER_OUTPUT.stat().st_size:,} bytes)")
    print(f"✨ Successfully generated Zip archive: {ZIP_OUTPUT} ({ZIP_OUTPUT.stat().st_size:,} bytes)")
    return INSTALLER_OUTPUT

if __name__ == "__main__":
    try:
        build()
    except Exception as e:
        print(f"\n✕ Build failed: {e}", file=sys.stderr)
        sys.exit(1)
