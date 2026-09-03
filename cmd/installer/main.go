package main

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

//go:embed assets/tcode.exe
var tcodeBinary []byte

//go:embed assets/uninstall.exe
var uninstallerBinary []byte

var (
	user32          = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW = user32.NewProc("MessageBoxW")
)

const (
	MB_YESNO        = 0x00000004
	MB_ICONQUESTION  = 0x00000020
	MB_ICONINFO      = 0x00000040
	MB_ICONERROR     = 0x00000010
	IDYES            = 6
)

func messageBox(title, text string, style uint) int {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	r, _, _ := procMessageBoxW.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), uintptr(style))
	return int(r)
}

func main() {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		home, _ := os.UserHomeDir()
		localAppData = filepath.Join(home, "AppData", "Local")
	}

	installDir := filepath.Join(localAppData, "Programs", "TcodeStudio")
	targetExe := filepath.Join(installDir, "tcode.exe")
	uninstallExe := filepath.Join(installDir, "uninstall.exe")

	isSilent := false
	for _, arg := range os.Args[1:] {
		if arg == "-silent" || arg == "/S" || arg == "/s" || arg == "--silent" {
			isSilent = true
		}
	}

	if !isSilent {
		welcomeText := fmt.Sprintf(
			"欢迎使用 Tcode Agentic Studio 安装向导！\n\n"+
				"系统将自动为您安装 Tcode Studio v2.0.0 到：\n%s\n\n"+
				"• 自动创建桌面与开始菜单快捷方式\n"+
				"• 内置完整 Go 微内核 + 纯净桌面渲染环境\n"+
				"• 注册系统控制面板安全卸载项\n\n"+
				"是否立即开始安装？",
			installDir,
		)

		ans := messageBox("Tcode Studio v2.0 安装向导", welcomeText, MB_YESNO|MB_ICONQUESTION)
		if ans != IDYES {
			return
		}
	}

	// 1. 终止旧进程
	_ = exec.Command("taskkill", "/F", "/IM", "tcode.exe").Run()

	// 2. 创建安装目录
	if err := os.MkdirAll(installDir, 0755); err != nil {
		messageBox("安装失败", fmt.Sprintf("无法创建安装目录: %v", err), MB_ICONERROR)
		return
	}

	// 3. 释放主体 tcode.exe
	_ = os.Remove(targetExe)
	if err := os.WriteFile(targetExe, tcodeBinary, 0755); err != nil {
		messageBox("安装失败", fmt.Sprintf("无法写入应用程序文件: %v", err), MB_ICONERROR)
		return
	}

	// 4. 释放卸载程序 uninstall.exe
	_ = os.WriteFile(uninstallExe, uninstallerBinary, 0755)

	// 5. 创建快捷方式 (桌面 + 开始菜单)
	homeDir, _ := os.UserHomeDir()
	desktopLnk := filepath.Join(homeDir, "Desktop", "Tcode Studio.lnk")
	startMenuDir := filepath.Join(homeDir, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs")
	startMenuLnk := filepath.Join(startMenuDir, "Tcode Studio.lnk")

	createShortcut(desktopLnk, targetExe, installDir)
	createShortcut(startMenuLnk, targetExe, installDir)

	// 6. 注册 Windows 卸载表项
	regPath := `Software\Microsoft\Windows\CurrentVersion\Uninstall\TcodeStudio`
	k, _, err := registry.CreateKey(registry.CURRENT_USER, regPath, registry.ALL_ACCESS)
	if err == nil {
		defer k.Close()
		_ = k.SetStringValue("DisplayName", "Tcode Agentic Studio v2.0")
		_ = k.SetStringValue("DisplayVersion", "2.0.0")
		_ = k.SetStringValue("Publisher", "Tcode Studio")
		_ = k.SetStringValue("DisplayIcon", targetExe+",0")
		_ = k.SetStringValue("InstallLocation", installDir)
		_ = k.SetStringValue("UninstallString", fmt.Sprintf("\"%s\"", uninstallExe))
		_ = k.SetDWordValue("NoModify", 1)
		_ = k.SetDWordValue("NoRepair", 1)
	}

	// 7. 安装完成提示与直接启动选项
	if !isSilent {
		launchAns := messageBox(
			"安装成功",
			"✓ Tcode Studio v2.0.0 已成功安装到您的计算机！\n\n桌面与开始菜单已生成快捷方式。\n\n是否立即启动应用程序？",
			MB_YESNO|MB_ICONINFO,
		)

		if launchAns == IDYES {
			cmd := exec.Command(targetExe)
			cmd.Dir = installDir
			_ = cmd.Start()
		}
	}
}

func createShortcut(lnkPath, targetPath, workDir string) {
	psScript := fmt.Sprintf(
		`$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%s'); $s.TargetPath = '%s'; $s.WorkingDirectory = '%s'; $s.IconLocation = '%s,0'; $s.Save()`,
		lnkPath, targetPath, workDir, targetPath,
	)
	_ = exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psScript).Run()
}
