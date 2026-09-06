package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

var (
	user32           = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW  = user32.NewProc("MessageBoxW")
	shell32          = syscall.NewLazyDLL("shell32.dll")
	procShellExecute = shell32.NewProc("ShellExecuteW")
)

const (
	MB_YESNO       = 0x00000004
	MB_ICONQUESTION = 0x00000020
	MB_ICONINFO     = 0x00000040
	IDYES           = 6
)

func messageBox(title, text string, style uint) int {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	r, _, _ := procMessageBoxW.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), uintptr(style))
	return int(r)
}

func main() {
	silent := false
	for _, arg := range os.Args[1:] {
		lower := strings.ToLower(arg)
		if lower == "/s" || lower == "-s" || lower == "--silent" || lower == "-silent" || lower == "/silent" {
			silent = true
			break
		}
	}

	if !silent {
		ans := messageBox("卸载 Tcode Studio", "您确定要从这台计算机上完全卸载 Tcode Studio 及其所有快捷方式吗？", MB_YESNO|MB_ICONQUESTION)
		if ans != IDYES {
			return
		}
	}

	// 1. 尝试结束可能正在运行的进程 (注入 /T 树杀与 0x08000000 杜绝黑框)
	killCmd := exec.Command("taskkill", "/F", "/T", "/IM", "tcode.exe")
	killCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
	_ = killCmd.Run()

	homeDir, _ := os.UserHomeDir()
	desktop := filepath.Join(homeDir, "Desktop", "Tcode Studio.lnk")
	startMenu := filepath.Join(homeDir, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Tcode Studio.lnk")

	// 2. 删除快捷方式
	_ = os.Remove(desktop)
	_ = os.Remove(startMenu)

	// 3. 读取注册表卸载项获取可能的原始安装路径，然后删除注册表项
	regPath := `Software\Microsoft\Windows\CurrentVersion\Uninstall\TcodeStudio`
	var regInstallDir string
	k, err := registry.OpenKey(registry.CURRENT_USER, regPath, registry.QUERY_VALUE)
	if err == nil {
		regInstallDir, _, _ = k.GetStringValue("InstallLocation")
		k.Close()
	}
	_ = registry.DeleteKey(registry.CURRENT_USER, regPath)

	// 4. 获取当前真实安装目录（优先以卸载程序自身所在目录为准）
	appDir := ""
	exePath, err := os.Executable()
	if err == nil {
		appDir = filepath.Dir(exePath)
	}
	if appDir == "" || appDir == "." {
		appDir = regInstallDir
	}
	if appDir == "" {
		appDir = filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "TcodeStudio")
	}
	appDir = filepath.Clean(appDir)

	// 安全防线：防止误删驱动器根目录、系统目录或用户家目录
	isSafeToDelete := false
	winDir := os.Getenv("WINDIR")
	sysRoot := os.Getenv("SYSTEMROOT")
	userProfile := os.Getenv("USERPROFILE")

	if len(appDir) > 5 &&
		!strings.EqualFold(appDir, winDir) &&
		!strings.EqualFold(appDir, sysRoot) &&
		!strings.EqualFold(appDir, userProfile) &&
		!strings.EqualFold(appDir, homeDir) {
		baseName := filepath.Base(appDir)
		if strings.EqualFold(baseName, "TcodeStudio") {
			isSafeToDelete = true
		}
	}

	// 5. 延迟自删除实际安装目录 (在临时目录生成独立 batch 脚本执行异步延时清理并自删除)
	tempDir := os.TempDir()
	batPath := filepath.Join(tempDir, fmt.Sprintf("tcode_uninstall_%d.bat", time.Now().UnixNano()))
	var batContent string
	if isSafeToDelete {
		batContent = fmt.Sprintf("@echo off\r\nping 127.0.0.1 -n 3 >nul\r\nrmdir /s /q \"%s\"\r\n(goto) 2>nul & del /f /q \"%%~f0\"\r\n", appDir)
	} else {
		batContent = fmt.Sprintf("@echo off\r\nping 127.0.0.1 -n 3 >nul\r\ndel /f /q \"%s\\tcode.exe\" \"%s\\uninstall.exe\" \"%s\\tcode.ico\"\r\n(goto) 2>nul & del /f /q \"%%~f0\"\r\n", appDir, appDir, appDir)
	}
	_ = os.WriteFile(batPath, []byte(batContent), 0755)

	if !silent {
		messageBox("卸载完成", "Tcode Studio 已成功从您的计算机移除。", MB_ICONINFO)
	}

	op, _ := syscall.UTF16PtrFromString("open")
	file, _ := syscall.UTF16PtrFromString("cmd.exe")
	params, _ := syscall.UTF16PtrFromString(fmt.Sprintf("/c \"%s\"", batPath))
	dir, _ := syscall.UTF16PtrFromString(tempDir)
	procShellExecute.Call(0, uintptr(unsafe.Pointer(op)), uintptr(unsafe.Pointer(file)), uintptr(unsafe.Pointer(params)), uintptr(unsafe.Pointer(dir)), 0)
}
