# Wails v2 生产级 Desktop 标签编译、Frameless 沉浸式窗体与纯 Go 原生安装向导封装

> 本文档依据 `AGENTS.md`【铁律 6】强制设立，记录在 Tcode Studio v2.0 原生演进中，针对 Wails v2 生产级标签编译机制、Frameless 沉浸式窗口对接、纯 Go 语言打造独立单文件安装向导（`TcodeStudio_Setup_v2.0.0.exe`）以及【铁律 1.5】真实桌面端安装与接口闭环的完整工程实践经验。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在将 Tcode 演进为纯原生桌面端应用（Go 1.22 + Wails v2 + Vue 3.4）的过程中，遇到了以下关键工程挑战：
1. **Wails v2 裸编译导致 Stub 回退报错 (红叉弹窗)**：
   若直接使用 `go build .` 编译 Wails 项目，Go 编译器默认由于缺乏编译标签，会链接进 fallback 空壳实现（`stub.go`），程序运行即弹出 `wails.Run: not implemented on this platform` 红叉错误；
2. **Windows Frameless 沉浸式无边框窗口对接**：
   为了实现现代代码编辑器的极简美学，窗口需要支持完全无系统原生外边框（Frameless: true），但在去除边框后，必须实现前端无缝拖拽区（`--wails-draggable: drag`）与最小化、最大化、关闭的强类型 IPC 穿透绑定；
3. **消除运行时 CMD 黑框与轻量化独立分发**：
   桌面 GUI 程序必须禁用控制台子系统窗口，同时用户端不应安装庞大复杂的第三方打包器（如 Inno Setup / NSIS），需要通过纯 Go 编写独立的安装向导与卸载器，将所有二进制内嵌为单文件进行交付；
4. **【铁律 1.5】强制闭环纪律**：
   必须通过自动化脚本真实执行安装向导（`-silent` 静默安装到 `%LOCALAPPDATA%`），并启动安装后的可执行程序进行微内核探活与真实模型流式推理验证。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. Wails v2 标签驱动编译体系 (Build Tags)
- Wails 内部通过 Go Build Tags 进行平台条件编译：
  - `desktop`：指示编译器启用真实的 Windows/macOS/Linux 原生窗体实现（在 Windows 上链接 Edge WebView2 运行时）；
  - `production`：去除开发期热重载与调试工具注入，优化前端静态资源服务；
- 若缺少 `-tags "desktop,production"`，编译器会匹配 `!desktop` 的空实现文件，导致程序无法创建窗口。

### 2. Windows GUI 子系统与链接器裁剪
- Windows 二进制默认链接为控制台程序（Console Subsystem），启动时会伴随弹出黑色命令行终端窗口；
- 采用编译参数 `-ldflags="-H windowsgui -s -w"`：
  - `-H windowsgui`：设置 Windows PE 头部为 GUI 子系统，彻底消除启动黑框；
  - `-s`：剥离符号表（Symbol Table）；
  - `-w`：剥离 DWARF 调试信息，使二进制体积大幅压缩约 35%（从 15MB 降至 9.6MB）。

### 3. 基于 `//go:embed` 的纯 Go 独立自解压安装向导架构
- **解耦结构**：
  - `tcode.exe` (主程序, ~9.6MB)
  - `uninstall.exe` (独立卸载器, ~1.7MB)
  - `TcodeStudio_Setup_v2.0.0.exe` (安装向导, ~13MB)
- 安装向导通过 `//go:embed assets/tcode.exe` 与 `//go:embed assets/uninstall.exe` 将两个编译好的二进制内嵌在自身只读数据段中；
- 运行时通过 Windows 原生 Win32 API `MessageBoxW` 弹出原生欢迎/确认窗口；
- 当传入 `-silent` 参数时，完全无头静默安装，释放目标文件到 `%LOCALAPPDATA%\Programs\TcodeStudio`，通过 WScript.Shell 创建桌面及开始菜单快捷方式，并在注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\TcodeStudio` 下写入规范的标准系统卸载表项。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 规范构建流水线

```bash
# 1. 编译前端 Vue 3 生产产物
cd frontend && npm run build && cd ..

# 2. 编译生产级主桌面程序 (带标签与 GUI 子系统)
go build -tags "desktop,production" -ldflags="-H windowsgui -s -w" -o bin/tcode.exe .

# 3. 编译独立卸载程序
go build -ldflags="-H windowsgui -s -w" -o bin/uninstall.exe ./cmd/uninstaller

# 4. 将产物同步至安装向导资源目录并封装单文件安装向导
copy bin\tcode.exe cmd\installer\assets\
copy bin\uninstall.exe cmd\installer\assets\
go build -ldflags="-H windowsgui -s -w" -o bin/TcodeStudio_Setup_v2.0.0.exe ./cmd/installer
```

### 2. 铁律 1.5 物理闭环验证流程

```powershell
# 1. 真实静默安装至独立沙箱目录
Start-Process -FilePath ".\bin\TcodeStudio_Setup_v2.0.0.exe" -ArgumentList "-silent" -Wait

# 2. 验证文件物理落盘与完整性
Get-ChildItem -Path "$env:LOCALAPPDATA\Programs\TcodeStudio"

# 3. 验证 Windows 注册表反注册项与桌面快捷方式
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TcodeStudio"
Test-Path "$([Environment]::GetFolderPath('Desktop'))\Tcode Studio.lnk"

# 4. 真实桌面端微内核启动探活
$proc = Start-Process -FilePath "$env:LOCALAPPDATA\Programs\TcodeStudio\tcode.exe" -PassThru
Start-Sleep -Seconds 3
Get-Process -Id $proc.Id

# 5. 执行真实模型流式推理端到端测试
go test -v -timeout 60s ./internal/llm
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **构建标签缺失排查**：
   - **症状**：编译时无任何错误，但双击 `tcode.exe` 弹出红叉报错 `not implemented on this platform`；
   - **根因**：使用了普通 `go build`；
   - **解决**：在编译脚本与 Makefile 中将 `-tags "desktop,production"` 列为强制参数，不可省略。
2. **PowerShell 启动 GUI 程序异步陷阱**：
   - **症状**：在脚本中调用 `TcodeStudio_Setup_v2.0.0.exe -silent`，命令行瞬间返回，后续检查发现安装文件尚未解压；
   - **根因**：GUI 子系统（`-H windowsgui`）程序在控制台中启动时，PowerShell 默认不阻塞等待进程退出；
   - **解决**：自动化脚本中统一使用 `Start-Process -FilePath <exe> -ArgumentList "-silent" -Wait` 显式等待进程结束。
3. **免管理员提权安装路径选择**：
   - 避免将默认安装路径指定在 `C:\Program Files`（需要 UAC 提权并触发弹窗警告）；
   - 推荐遵循现代软件规范（如 VS Code User Installer、Chrome），默认安装至当前用户的 `%LOCALAPPDATA%\Programs\TcodeStudio`，无需提权即可静默安装与无损更新。
