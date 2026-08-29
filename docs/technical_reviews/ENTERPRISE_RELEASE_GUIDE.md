# CodeMind-Hub 商业级生产发布与运维全景指南
> **版本**：v1.0.0 Commercial Release (GA)  
> **适用平台**：Windows 10/11 (x86_64) · macOS (Apple Silicon ARM64 & Intel) · Linux  
> **归档路径**：`docs/technical_reviews/ENTERPRISE_RELEASE_GUIDE.md`

---

## 目录
1. [桌面客户端打包构建流程](#一桌面客户端打包构建流程)
2. [代码签名与安全认证 (Code Signing)](#二代码签名与安全认证)
3. [增量热更新机制 (Tauri Auto-Updater)](#三增量热更新机制)
4. [企业级私有化与物理隔离部署 (Air-Gapped)](#四企业级私有化与物理隔离部署)

---

## 一、桌面客户端打包构建流程

### 1. Windows 生产打包
在 Windows 开发机上运行官方构建脚本：
```powershell
# 1. 进入脚本目录执行全自动构建
powershell -ExecutionPolicy Bypass -File ./scripts/build-desktop.ps1 -Target windows -Release
```
- **构建输出产物**：
  - `src-tauri/target/release/bundle/nsis/CodeMind-Hub_1.0.0_x64-setup.exe` (NSIS 安装程序)
  - `src-tauri/target/release/bundle/msi/CodeMind-Hub_1.0.0_x64_en-US.msi` (企业部署 MSI)

### 2. macOS 跨平台打包 (Apple Silicon & Universal)
在 macOS CI 机器上运行：
```bash
bash ./scripts/build-desktop.sh --target macos --universal
```
- **构建输出产物**：
  - `src-tauri/target/release/bundle/dmg/CodeMind-Hub_1.0.0_universal.dmg` (双架构 DMG)

---

## 二、代码签名与安全认证

### 1. Windows 签名 (Authenticode)
使用 `signtool.exe` 对 `.exe` 和 `.msi` 签名：
```powershell
signtool sign /f "path/to/enterprise.pfx" /p "CertPassword" /tr http://timestamp.digicert.com /td sha256 /fd sha256 "src-tauri/target/release/bundle/nsis/CodeMind-Hub_1.0.0_x64-setup.exe"
```

### 2. macOS 公证 (Apple Notarization)
```bash
xcrun notarytool submit "src-tauri/target/release/bundle/dmg/CodeMind-Hub_1.0.0_universal.dmg" --keychain-profile "AC_PASSWORD" --wait
xcrun stapler staple "src-tauri/target/release/bundle/dmg/CodeMind-Hub_1.0.0_universal.dmg"
```

---

## 三、增量热更新机制 (Tauri Auto-Updater)

CodeMind-Hub 集成基于 **Ed25519 签名算法** 的安全静默热更新：
1. **生成签名公私钥**：
   ```bash
   npx @tauri-apps/cli signer generate -w ~/.tauri/codemind.key
   ```
2. **发布更新清例文档 (`update.json`)**：
   ```json
   {
     "version": "1.0.1",
     "notes": "优化 Monorepo 拓扑图谱渲染性能，支持 100+ 模块超大工程毫秒级展示。",
     "pub_date": "2026-09-01T00:00:00Z",
     "platforms": {
       "windows-x86_64": {
         "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
         "url": "https://releases.codemind.hub/v1.0.1/CodeMind-Hub_x64.nsis.zip"
       }
     }
   }
   ```

---

## 四、企业级私有化与物理隔离部署 (Air-Gapped)

对于银行、军工及涉密研发团队，支持 100% 纯内网物理隔离部署：
1. **本地 Ollama / vLLM 私网直连**：
   - 将模型网关 Base URL 设为 `http://10.0.0.100:11434` 或 `http://localhost:11434`；
   - 模型选型锁定为私有化部署的 `qwen2.5-coder:32b` 或 `deepseek-r1:70b`；
2. **离线安全模式**：
   - 在系统设置中开启 `物理隔离模式 (Air-Gapped Mode)`，客户端自动禁用一切公网外联与遥测采集，实现真正的数据安全底线。
