# ==============================================================================
# Tcode Studio - Hourly Automated Bug Patrol & Quality Gate
# 执行逻辑：
# 1. 代码质量与安全规约扫描 (找最严重的前 10 个 Bug/安全漏洞)
# 2. 自动化测试套件执行 (Go + Frontend)
# 3. 产出巡检报告
# ==============================================================================

Write-Host "[Patrol] Starting hourly automated bug patrol..." -ForegroundColor Cyan

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

# 1. 执行 Go 后端全量测试
Write-Host "[Patrol] Running Go unit & regression tests..." -ForegroundColor Yellow
$env:GOROOT = "F:\codingEnvironment\go"
$env:PATH = "F:\codingEnvironment\go\bin;" + $env:PATH
go test -v ./internal/... 2>&1 | Tee-Object -Variable testOutput

# 2. 执行前端构建与语法校验
Write-Host "[Patrol] Checking frontend compilation..." -ForegroundColor Yellow
Set-Location "$root\frontend"
npm run build 2>&1 | Tee-Object -Variable frontendOutput
Set-Location $root

# 3. 检查是否有未解决的高危硬编码模式
$suspicious = Select-String -Path "app.go", "internal/**/*.go", "frontend/src/**/*.ts", "frontend/src/**/*.vue" -Pattern "sk-gKTbHfCZ|deepseek-v4-flash|gpt-5.6-sol"
if ($suspicious) {
    Write-Host "[Patrol Warning] Hardcoded demo credentials/models found:" -ForegroundColor Red
    $suspicious | ForEach-Object { Write-Host "  $($_.Filename):$($_.LineNumber)" }
} else {
    Write-Host "[Patrol Clean] No hardcoded demo credentials found." -ForegroundColor Green
}

Write-Host "[Patrol] Hourly audit completed." -ForegroundColor Cyan
