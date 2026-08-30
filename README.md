# Tcode (Tcode)

新一代企业级开源 AI 编程桌面工作台，基于 **Tauri v2 / Python Native Desktop Host + React 19 + TypeScript + 暖色极简设计**。

## 🎯 核心架构与产品特性

### 1. 目标驱动 Agent Loop (Goal-Driven Loop)
- **只因目标完成而结束**：Agent 不受死板轮数限制，通过内部目标拆解 ➔ 动作执行 ➔ 独立验证器验证 ➔ 继续修复 ➔ 全部通过闭环；
- **单卡片任务聚合 (AgentRunCard)**：一次用户请求聚合成单个任务卡片，展示目标验收清单与内部 Step 链路（`[分析] ✓` ➔ `[修改] ✓` ➔ `[验证] ⟳`）。

### 2. 三栏百分比流体拉伸与 IDE 级工作台
- **全局 Pointer 拖拽**：支持全局光标跟踪，在左侧（12%~35%，默认 18%）、中间（flex: 1）、右侧（20%~50%，默认 32%）之间流畅拉伸，双击一键复位；
- **专业 IDE 体验**：行动指引型空状态提示、顶部完整文件路径面包屑、多文件 Tab 规范。

### 3. 统一宿主安全网关 (HostGateway)
- **统一入口 `openFile(path, line)`**：所有文件与 Diff 点击统一跳转并异步读取物理磁盘文件与高亮行号；
- **多层安全边界**：所有命令与文件写入均由 `SecurityShield`（脱敏）与 `SandboxGuard`（破坏性指令阻断）审计；
- **Git 影子快照与物理恢复**：支持写前自动打快照与 `revertCheckpoint` 真实磁盘文件级回滚。

## 🛠️ 本地验证与安装包构建

```powershell
# 1. 前端原型测试与构建
cd prototype
npm test
npm run build

# 2. 生成最新 Windows 安装包 (单文件向导)
cd ..
python build_installer.py
```

产物将输出至 `release/Tcode-Setup-v1.5.0.exe` 与 `release/Tcode-Setup-v1.5.0-windows-x64.zip`。


## 上下文容量提示

右侧上下文 HUD 使用当前模型的上下文窗口作为分母。100% 表示当前原始历史已达到或超过模型窗口；接近上限时，HUD 会按非破坏性的压缩请求副本计算有效占用。顶部显示的累计 Token 是会话消耗统计，不是上下文窗口水位。


## Windows 窗口启动位置

Tcode 宿主启动时会根据当前 Windows 显示器的可用工作区计算窗口位置，并自动居中；计算会避开任务栏区域，安装完成后首次启动与普通快捷方式启动使用同一套定位逻辑。
