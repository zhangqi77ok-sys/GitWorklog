# Windows 安装器构建契约

## 目标
每次原型或宿主代码变更完成后，使用可复现的 PyInstaller 链路生成根目录 `release/CodeMind-Studio-Setup.exe`。安装器必须嵌入本次构建的前端静态资源和桌面宿主，不得复用历史二进制文件。

## 构建顺序
1. 在 `prototype/` 运行 `npm run build`；
2. 在 `prototype/` 运行 `npm test`；
3. 以 `src-desktop/desktop_app.py` 生成窗口化核心 `CodeMind-Studio.exe`，并把 `prototype/dist` 嵌入为 `dist/`；
4. 把核心 EXE 放入安装器 payload；
5. 以 `src-desktop/setup_wizard.py` 生成窗口化单文件安装器 `release/CodeMind-Studio-Setup.exe`。

## 运行时契约
- 桌面宿主绑定 `127.0.0.1:8010`；端口不可用时启动失败，不可静默切换端口。
- `GET /health` 返回 HTTP 200 和 JSON `{"status":"ok"}`；`GET /` 由嵌入的前端 `index.html` 提供。
- 打包脚本在任何子步骤失败时立即返回非零退出码，不产生成功声明。

## 可测试接口
`build_installer.py` 必须暴露 `core_command()`、`setup_command()` 和 `installer_output()`：测试验证命令使用当前源码、当前前端 dist、受控 work/dist 目录和精确目标文件名。
