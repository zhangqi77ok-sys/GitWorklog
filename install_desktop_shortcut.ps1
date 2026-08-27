# RunCabinet · Vite Coding Studio Windows 快捷方式安装脚本
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$TargetExe = "e:\pro\agent-learning\dist\ViteCodingStudio\ViteCodingStudio.exe"

if (-Not (Test-Path $TargetExe)) {
    Write-Host "⚠️ 未检测到 dist\ViteCodingStudio\ViteCodingStudio.exe，使用桌面启动器模式..." -ForegroundColor Yellow
    $TargetExe = "C:\Users\13605\AppData\Roaming\uv\python\cpython-3.12-windows-x86_64-none\python.exe"
    $Arguments = "e:\pro\agent-learning\app_desktop_main.py"
} else {
    $Arguments = ""
}

$Shortcut = $WshShell.CreateShortcut("$DesktopPath\RunCabinet Studio.lnk")
$Shortcut.TargetPath = $TargetExe
$Shortcut.Arguments = $Arguments
$Shortcut.WorkingDirectory = "e:\pro\agent-learning"
$Shortcut.Description = "RunCabinet Vite Coding Studio 桌面端工作台"
$Shortcut.Save()

Write-Host "🎉 桌面快捷方式已成功创建至: $DesktopPath\RunCabinet Studio.lnk" -ForegroundColor Green
