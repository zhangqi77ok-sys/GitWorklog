# Windows 纯 Go 单文件安装向导自定义安装目录解析、系统原生文件夹选取与卸载器自适应清理闭环

> 归档分类：桌面端分发 / 原生交互 / 自动化闭环 / 铁律 1.5 实践  
> 对应版本：Tcode Studio v2.0.0+  
> 遵循规约：`AGENTS.md`【铁律 5: 弹窗与交互设计三维铁律】与【铁律 1.5: 强制闭环验证】

---

## ① 知识点与问题背景 (Context & Problem Statement)

在 Windows 桌面端分发交付体系中，标准桌面软件（如 VS Code、Cursor 等）需要兼顾两种主要安装场景：
1. **自动化/无人值守静默分发（Silent Installation）**：CI/CD 自动化部署、开发机批量安装或企业 IT 软件中心分发，通常通过参数如 `-silent -dir "D:\CustomPath\TcodeStudio"` 或 `/S /D=D:\CustomPath` 显式指定安装路径；
2. **终端用户交互式安装（GUI Installation）**：普通开发者可能希望将软件安装至非系统盘（如 `D:` 或 `E:` 盘开发目录），而不是默认的 `%LOCALAPPDATA%\Programs\TcodeStudio`。

在此前版本中：
- `cmd/installer/main.go` 硬编码了 `%LOCALAPPDATA%\Programs\TcodeStudio`，无法自定义路径；
- `cmd/uninstaller/main.go` 同样硬编码了默认路径，如果用户手工迁移或自定义安装位置，卸载程序将无法准确定位并清理自定义目录中的残留文件；
- 普通文本框让用户手输路径违背了【铁律 5: 严禁弹出文本框让用户手输路径，必须调用系统原生资源管理器文件夹选择框】的要求。

因此需要设计一套**既支持多种命令行参数格式、又具备系统原生无黑框文件夹浏览交互、同时卸载器自适应寻址的完整闭环方案**。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 命令行参数多样性与标准兼容 (POSIX vs NSIS)
在 Windows 环境下，不同的安装包格式具备不同的参数标准：
- **Inno Setup / Standard CLI**：`-dir "D:\Path"`、`--dir "D:\Path"`、`-d "D:\Path"`；
- **NSIS (Nullsoft Scriptable Install System)**：`/D=D:\Path`（注意 NSIS 规范中 `/D=` 必须直接跟路径，无空格）；
- 安装向导需要统一解析这些变体并做 `filepath.Clean` 规范化，确保在静默与交互模式下均生效。

### 2. 原生文件夹选择与 `CREATE_NO_WINDOW` 零黑框弹窗
在纯 Go 编译为 `-H windowsgui`（无控制台窗体）的可执行文件中，若要调用 Windows 原生资源管理器文件夹选择框，有两种方案：
- **方案 A (Win32 API/COM)**：调用 `SHBrowseForFolderW` 或 `IFileDialog`，需要繁重的 COM 初始化、GUID 定义以及 Cgo/syscall 结构体绑定；
- **方案 B (PowerShell + WinForms FolderBrowserDialog)**：
  利用 .NET WinForms 的 `FolderBrowserDialog`，通过带有 `CREATE_NO_WINDOW = 0x08000000` 进程标记的 PowerShell 子进程直接呼出，原生调用资源管理器，零黑框闪烁，简洁稳定且天然支持 Windows 10/11 的现代化资源管理器样式。

### 3. 卸载器物理自寻址与注册表双校验机制
卸载程序 `uninstall.exe` 在运行时位于软件安装目录内。
- 通过 `os.Executable()` 获得自身物理全路径，其父目录 `filepath.Dir(exePath)` 即为当前软件真实驻留目录；
- 辅助读取注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\TcodeStudio` 的 `InstallLocation` 字段进行交叉比对；
- 清理流程结束前，通过 Windows 原生延迟命令：
  ```cmd
  cmd.exe /c "timeout /t 1 /nobreak >nul & rmdir /s /q \"%s\""
  ```
  实现软件目录包括自身在内的完全物理自删除，不留任何死目录。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 安装向导命令行与交互选择实现 (`cmd/installer/main.go`)

```go
// 1. 原生文件夹选择框呼出函数 (注入 CREATE_NO_WINDOW 防黑框)
func chooseFolderDialog(initialDir string) (string, error) {
	psScript := fmt.Sprintf(`
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "请选择 Tcode Agentic Studio 的安装目标目录"
$f.ShowNewFolderButton = $true
if (Test-Path "%s") { $f.SelectedPath = "%s" }
$res = $f.ShowDialog()
if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
	[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
	Write-Output $f.SelectedPath
}
`, initialDir, initialDir)

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psScript)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// 2. 命令行多格式解析支持
for i := 1; i < len(os.Args); i++ {
	arg := os.Args[i]
	if arg == "-silent" || arg == "/S" || arg == "/s" || arg == "--silent" {
		isSilent = true
	} else if arg == "-dir" || arg == "--dir" || arg == "-d" {
		if i+1 < len(os.Args) {
			customDir = os.Args[i+1]
			i++
		}
	} else if strings.HasPrefix(arg, "/D=") {
		customDir = strings.TrimPrefix(arg, "/D=")
	} else if strings.HasPrefix(arg, "-dir=") {
		customDir = strings.TrimPrefix(arg, "-dir=")
	} else if strings.HasPrefix(arg, "--dir=") {
		customDir = strings.TrimPrefix(arg, "--dir=")
	}
}
```

### 2. 卸载器物理自寻址重构 (`cmd/uninstaller/main.go`)

```go
// 优先以卸载程序自身物理所在目录为准
appDir := ""
if exePath, err := os.Executable(); err == nil {
	appDir = filepath.Dir(exePath)
}
if appDir == "" || appDir == "." {
	appDir = regInstallDir
}
// 延迟完全自删除实际安装目录
cmdStr := fmt.Sprintf("timeout /t 1 /nobreak >nul & rmdir /s /q \"%s\"", appDir)
_ = exec.Command("cmd.exe", "/c", cmdStr).Start()
```

### 3. 增量构建与【铁律 1.5】真实自定义目录验证实操

```powershell
# 1. 编译卸载器与安装向导
& "F:\codingEnvironment\go\bin\go.exe" build -ldflags "-H windowsgui -s -w" -o bin/uninstall.exe cmd/uninstaller/main.go
Copy-Item "bin/uninstall.exe" -Destination "cmd/installer/assets/uninstall.exe" -Force
& "F:\codingEnvironment\go\bin\go.exe" build -ldflags "-H windowsgui -s -w" -o bin/TcodeStudio_Setup_v2.0.0.exe cmd/installer/main.go

# 2. 真实自定义目录安装验证
$customDir = "$env:TEMP\TcodeCustomTest_20260904"
Start-Process -FilePath "bin\TcodeStudio_Setup_v2.0.0.exe" -ArgumentList "-silent -dir `"$customDir`"" -Wait

# 3. 校验注册表与物理可执行文件
Test-Path "$customDir\tcode.exe"          # 输出 True
Test-Path "$customDir\uninstall.exe"      # 输出 True
$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TcodeStudio"
(Get-ItemProperty -Path $regKey).InstallLocation  # 输出与 $customDir 一致

# 4. 探活验证与自清理
$p = Start-Process "$customDir\tcode.exe" -PassThru
Start-Sleep -Seconds 2
Stop-Process -Id $p.Id -Force
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **安装路径自动补齐子目录规范**：
   如果用户通过文件夹浏览框选择了根盘或通用目录（如 `D:\Tools`），若直接将所有文件解压到该目录下会污染用户工作区。安装向导自动检查选定文件夹末尾是否已为 `TcodeStudio`；若否，自动补全为 `D:\Tools\TcodeStudio`，极大提升用户体验。
2. **注册表字段与控制面板卸载联动**：
   Windows 系统的“添加或删除程序”面板依赖 `InstallLocation`、`DisplayIcon` 以及 `UninstallString`。必须确保 `UninstallString` 包含完整转义引号（`"D:\Path\uninstall.exe"`），防止因用户选择的路径中包含空格而导致控制面板卸载报错。
3. **快捷方式 WorkingDirectory 绑定**：
   桌面与开始菜单快捷方式（`.lnk`）不仅需要设置 `TargetPath`，必须同时设置 `WorkingDirectory` 为最终选定的 `installDir`，否则应用内读取相对路径配置文件时可能落入当前命令工作区导致崩溃。