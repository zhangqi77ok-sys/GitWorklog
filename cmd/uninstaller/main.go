package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

var (
	user32           = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW  = user32.NewProc("MessageBoxW")
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
	ans := messageBox("卸载 Tcode Studio", "您确定要从这台计算机上完全卸载 Tcode Studio 及其所有快捷方式吗？", MB_YESNO|MB_ICONQUESTION)
	if ans != IDYES {
		return
	}

	// 1. 尝试结束可能正在运行的进程
	_ = exec.Command("taskkill", "/F", "/IM", "tcode.exe").Run()

	homeDir, _ := os.UserHomeDir()
	desktop := filepath.Join(homeDir, "Desktop", "Tcode Studio.lnk")
	startMenu := filepath.Join(homeDir, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Tcode Studio.lnk")

	// 2. 删除快捷方式
	_ = os.Remove(desktop)
	_ = os.Remove(startMenu)

	// 3. 删除注册表卸载项
	_ = registry.DeleteKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Uninstall\TcodeStudio`)

	installDir, _ := os.UserCacheDir()
	appDir := filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "TcodeStudio")

	// 4. 延迟自删除目录
	cmdStr := fmt.Sprintf("timeout /t 1 /nobreak >nul & rmdir /s /q \"%s\"", appDir)
	_ = exec.Command("cmd.exe", "/c", cmdStr).Start()

	_ = installDir
	messageBox("卸载完成", "Tcode Studio 已成功从您的计算机移除。", MB_ICONINFO)
}
