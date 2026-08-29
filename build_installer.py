from __future__ import annotations

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
CORE_DIST_DIR = BUILD_TEMP / "installer_core"
PAYLOAD_DIR = BUILD_TEMP / "installer_payload"
PYINSTALLER_WORK_DIR = BUILD_TEMP / "installer_work"
PYINSTALLER_SPEC_DIR = BUILD_TEMP / "installer_specs"
CORE_OUTPUT = CORE_DIST_DIR / "CodeMind-Studio.exe"


def installer_output() -> Path:
    return ROOT / "release" / "CodeMind-Studio-Setup.exe"


def pyinstaller_base_command() -> list[str]:
    return [sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--windowed", "--onefile"]


def core_command() -> list[str]:
    return [
        *pyinstaller_base_command(),
        "--name", "CodeMind-Studio",
        "--distpath", str(CORE_DIST_DIR),
        "--workpath", str(PYINSTALLER_WORK_DIR / "core"),
        "--specpath", str(PYINSTALLER_SPEC_DIR),
        "--add-data", f"{FRONTEND_DIST}{os.pathsep}dist",
        str(DESKTOP_ENTRY),
    ]


def setup_command() -> list[str]:
    return [
        *pyinstaller_base_command(),
        "--name", "CodeMind-Studio-Setup",
        "--distpath", str(installer_output().parent),
        "--workpath", str(PYINSTALLER_WORK_DIR / "setup"),
        "--specpath", str(PYINSTALLER_SPEC_DIR),
        "--add-data", f"{PAYLOAD_DIR}{os.pathsep}payload",
        str(SETUP_ENTRY),
    ]


def run(command: list[str], cwd: Path | None = None) -> None:
    print("\n> " + " ".join(f'"{part}"' if " " in part else part for part in command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def clean_directory(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def npm_command() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def verify_build_inputs() -> None:
    missing = [path for path in (DESKTOP_ENTRY, SETUP_ENTRY) if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing desktop build input: {', '.join(str(path) for path in missing)}")


def build() -> Path:
    verify_build_inputs()
    run([npm_command(), "run", "build"], cwd=PROTOTYPE_DIR)
    run([npm_command(), "test"], cwd=PROTOTYPE_DIR)

    if not FRONTEND_DIST.joinpath("index.html").is_file():
        raise FileNotFoundError(f"Frontend build did not create {FRONTEND_DIST / 'index.html'}")

    clean_directory(CORE_DIST_DIR)
    clean_directory(PAYLOAD_DIR)
    clean_directory(PYINSTALLER_WORK_DIR)
    clean_directory(PYINSTALLER_SPEC_DIR)
    installer_output().parent.mkdir(parents=True, exist_ok=True)

    run(core_command(), cwd=ROOT)
    if not CORE_OUTPUT.is_file():
        raise FileNotFoundError(f"PyInstaller did not create desktop core: {CORE_OUTPUT}")

    shutil.copy2(CORE_OUTPUT, PAYLOAD_DIR / CORE_OUTPUT.name)
    run(setup_command(), cwd=ROOT)

    output = installer_output()
    if not output.is_file() or output.stat().st_size == 0:
        raise FileNotFoundError(f"PyInstaller did not create installer: {output}")

    print(f"\n✓ Windows installer created: {output} ({output.stat().st_size:,} bytes)")
    return output


if __name__ == "__main__":
    try:
        build()
    except subprocess.CalledProcessError as error:
        print(f"\n✕ Installer build failed with exit code {error.returncode}: {error.cmd}", file=sys.stderr)
        raise SystemExit(error.returncode)
    except Exception as error:
        print(f"\n✕ Installer build failed: {error}", file=sys.stderr)
        raise SystemExit(1)
