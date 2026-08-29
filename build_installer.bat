@echo off
setlocal
cd /d "%~dp0"

if not exist "build_temp" mkdir "build_temp"

echo [1/2] Running installer contract tests...
python -m unittest discover -s tests -p "test_build_installer.py" > "build_temp\installer-build.log" 2>&1
if errorlevel 1 (
    echo Contract tests failed. See build_temp\installer-build.log
    type "build_temp\installer-build.log"
    exit /b 1
)

echo [2/2] Building Windows installer...
python build_installer.py >> "build_temp\installer-build.log" 2>&1
set BUILD_EXIT=%errorlevel%

type "build_temp\installer-build.log"

if not "%BUILD_EXIT%"=="0" (
    echo Installer build failed with exit code %BUILD_EXIT%
    exit /b %BUILD_EXIT%
)

if not exist "dist\CodeMind-Studio-Setup.exe" (
    echo Installer output missing: dist\CodeMind-Studio-Setup.exe
    exit /b 1
)

echo Installer created: dist\CodeMind-Studio-Setup.exe
exit /b 0
