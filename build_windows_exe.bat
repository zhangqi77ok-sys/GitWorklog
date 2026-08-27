@echo off
chcp 65001 >nul
echo ========================================================
echo   RunCabinet · Vite Coding Studio Windows EXE 打包程序
echo ========================================================
echo.
echo [1/3] 正在执行 PyInstaller 独立编译打包...
uv run --with pyinstaller pyinstaller ViteCodingStudio.spec --noconfirm

echo [2/3] 打包完成！输出路径位于: dist\ViteCodingStudio\ViteCodingStudio.exe
echo.
pause
