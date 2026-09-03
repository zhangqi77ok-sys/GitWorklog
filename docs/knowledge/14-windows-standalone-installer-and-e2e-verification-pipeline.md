# Windows 单文件安装向导构建、PyInstaller 资源内嵌与铁律 1.5 验证闭环

> 本文档依据 `AGENTS.md`【铁律 6】强制设立，记录基于 PyInstaller 打造生产级 Windows 独立安装向导（`Tcode-Setup.exe`）、前端静态资源打包以及自动化端到端物理安装测试闭环的完整工程落地经验。

---

## ① 知识点与问题背景 (Context & Problem Statement)

现代化桌面 IDE 智能体在完成功能开发后，必须具备企业级交付与安装分发能力：
1. **单一文件便捷交付需求**：
   用户不希望在目标机器上预装 Python、Node.js 等庞杂的外部运行时环境，要求下载一个独立的 `Tcode-Setup.exe` 即可一键自解压并完成安装；
2. **PyInstaller 资源打包与路径解析陷阱**：
   将 React 19 构建产物（`dist/`）内嵌到可执行程序中后，若使用常规的 `os.path.dirname(__file__)` 访问文件，打包成 `--onefile` 或 `--onedir` 时会导致 `FileNotFoundError`；
3. **【铁律 1.5】强制闭环纪律**：
   严禁只写代码不验证，严禁以“构建成功输出日志”代替真实调用；必须在本地物理沙箱中运行安装包执行静默安装，启动安装产物并对探活端口和页面发起真实 HTTP 请求。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. PyInstaller 运行时临时解压目录 (`sys._MEIPASS`) 机制
- 在源码开发阶段，文件位于脚本同级目录；
- 在 PyInstaller 编译为可执行文件后，程序启动时会自动将嵌入的资源解压到 Windows 系统的临时目录（如 `C:\Users\...\AppData\Local\Temp\_MEIxxxxxx`），并为 Python 运行时注入全局变量 `sys._MEIPASS`；
- **标准路径兼容方案**：
  ```python
  def get_base_dir():
      if getattr(sys, "frozen", False):
          return sys._MEIPASS
      return os.path.dirname(os.path.abspath(__file__))
  ```

### 2. 双阶段安装包架构 (Two-Stage Packaging Architecture)
为了保证桌面宿主执行性能与安装向导解耦，采用经典的双阶段架构：
1. **阶段一（微内核编译）**：使用 `pyinstaller --onedir` 将 `desktop_app.py` 编译为 `dist/Tcode/` 运行时目录，嵌入前端 `dist/` 资源；
2. **阶段二（安装向导封装）**：将 `dist/Tcode/` 压缩为 `payload.zip`，并作为二进制载荷嵌入 `setup_wizard.py`，编译为独立的单文件 `Tcode-Setup.exe`。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 自动化构建与验证脚本 (`build_installer.py`)
```python
# 1. 编译前端
run_cmd("npm run build", cwd=FRONTEND_DIR)

# 2. 编译微内核并打包载荷
run_cmd(["pyinstaller", "--noconfirm", "--onedir", "--name", "Tcode", f"--add-data={FRONTEND_DIST};frontend_dist", "desktop_app.py"])
with zipfile.ZipFile("payload.zip", "w") as z:
    ...

# 3. 封装为独立单文件安装向导
run_cmd(["pyinstaller", "--noconfirm", "--onefile", "--name", "Tcode-Setup", "--add-data=payload.zip;.", "setup_wizard.py"])

# 4. 执行铁律 1.5 物理验证
run_cmd([setup_exe, "--silent-install-dir", TEST_INSTALL_DIR])
proc = subprocess.Popen([installed_tcode_exe, "--headless", "--port", "8777"])
...
```

### 2. 标准构建命令
```bash
# 在项目根目录一键触发全量流水线
npm run build:installer
# 或者直接调用
python build_installer.py
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **PowerShell 命令行引号逃逸陷阱**：
   在 PowerShell 中调用 Node 或 Python 脚本时，字符串内若包含 `(Esc)`、`$` 等符号，PowerShell 会尝试作为子表达式解析导致脚本中断；必须使用 `@' ... '@` 原生块或专有脚本文件执行；
2. **跨平台路径分隔符**：
   在 Windows 下 PyInstaller 的 `--add-data` 参数分隔符必须是分号 `;`（如 `dist;frontend_dist`），而在 Linux / macOS 下是冒号 `:`；
3. **测试沙箱目录自愈清理**：
   自动化测试运行完毕后，必须使用 `try...finally` 结构确保杀死测试子进程并移除沙箱目录，避免留下悬挂的锁定文件导致下次构建失败。
