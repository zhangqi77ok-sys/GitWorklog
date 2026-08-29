# CodeMind-Hub

当前阶段：**Phase 0 · 可交互 React 原型**。CodeMind-Hub 是面向原生桌面 IDE 的暖色极简 AI 编程工作台原型，目标架构为 Tauri v2 + React 19 + TypeScript。

## Agent Loop：Think → Execute → Observe → Continue

Act 模式已采用多轮 Agent Loop：模型输出 `write_file:<path>` 或 `run_command` 围栏动作后，控制器按权限策略执行，将结果回注给模型继续决策，直到模型输出纯文本总结或达到 10 轮安全上限。

- **智能自决**：低风险动作自动执行；高风险动作仍需统一审批。
- **逐次审核**：每项动作经统一审批浮层确认，任何会话内选择都不跳过后续严格审核。
- **风险熔断**：低风险自动执行，高风险逐项审核。
- **纯展示代码块**：代码块不再提供写盘/运行/重试按钮，只显示状态徽章、复制、展开/折叠与文件定位。
- **稳定状态关联**：动作和宿主结果通过 `actionId` 绑定，而不是按代码块渲染顺序猜测。

详细产品与技术契约见：
- [`docs/PRODUCT_REQUIREMENTS_DOCUMENT.md`](docs/PRODUCT_REQUIREMENTS_DOCUMENT.md) §4.40
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §9
- [`docs/technical_reviews/agent-loop-contract.md`](docs/technical_reviews/agent-loop-contract.md)

## 仓库结构

```text
.docs/                         产品 PRD、架构和技术契约
prototype/                     独立运行的 React + TypeScript 原型
  src/services/agentLoop.ts    动作解析、授权策略、结果关联与反馈格式化
  tests/agentLoop.test.ts      Agent Loop 契约测试
src-tauri/                     Phase 1 预留
src-desktop/                   Phase 1 预留
```

## 本地验证与 Windows 安装包

原型验证可在 `prototype/` 目录执行：

```powershell
npm test
npm run build
```

每次代码完成后，在仓库根目录生成当前代码的 Windows 安装包：

```powershell
npm run build:installer
# 等价命令：python build_installer.py
```

构建流程会依次构建并测试 `prototype/`，将当前 `prototype/dist` 嵌入桌面宿主，再生成 `dist/CodeMind-Studio-Setup.exe`。安装后启动安装目录内的 `CodeMind-Studio.exe`，验证其独立运行：

```powershell
Invoke-WebRequest http://127.0.0.1:8010/health
Invoke-WebRequest http://127.0.0.1:8010/
```

前者必须返回 HTTP 200 与 `{"status":"ok","service":"codemind-studio"}`，后者必须返回完整的前端 HTML 页面。不要以历史 `release/` 目录中的安装包或单独 Web 构建替代本次安装器验证。

## 开发约束

所有功能变更必须同步维护 `docs/` 的 PRD/架构契约与 `prototype/` 的交互实现；代码遵循 SDD + TDD，先写可验证契约，再落地最小实现。
