# Tcode 核心工程知识库与问题解决方案索引 (Knowledge Base & Solution Vault)

> 本知识库依据 `AGENTS.md`【铁律 6】强制设立：项目中遇到的每一个核心知识点、架构选型决策、环境适配陷阱与高频编译/运行报错，必须在此归档完整的知识内容、底层技术原理剖析与可落地的标准解决方案。

---

## 📚 知识点与解决方案目录索引

| 序号 | 知识点 / 技术议题 | 分类领域 | 核心关注点 | 关联文档 |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **Windows 环境下 Tauri 2.0 (Rust) 编译与安装包打包全解析** | 桌面端内核 / 构建运维 | MSVC 链接器依赖、`link.exe` 缺失、`cargo-xwin` 符号链接特权（os error 1314）与三种安装包打包方案 | [01-windows-tauri2-msvc-packaging.md](./01-windows-tauri2-msvc-packaging.md) |
| **02** | **AI Agent 跨会话长期工程记忆层与提示词动态注入机制** | Agent 认知架构 / 记忆库 | 用户纠偏规约提取、长期记忆本地化持久存储、System Prompt 置顶注入与 Token 预算平衡 | [02-cross-session-memory-vault.md](./02-cross-session-memory-vault.md) |
| **03** | **LSP 编译器诊断与代码自愈闭环设计** | 编译器工具链 / 自愈循环 | 文件落盘触发式语法诊断（TSC / Python / Rust）、红线报错结构化解析、Agent 循环下轮自愈注入 | [03-lsp-compiler-diagnostics-loop.md](./03-lsp-compiler-diagnostics-loop.md) |
| **04** | **Tcode 执行模式拓扑与双环/SwarmFlow 内部逻辑设计** | 执行内核 / 模式拓扑 | 三维正交模型、单 Agent 双环极速闭环 vs SwarmFlow 7 算子流、前端胶囊收敛与统一分发契约 | [04-execution-modes-and-swarm-topology.md](./04-execution-modes-and-swarm-topology.md) |
| **05** | **桌面端 WebView2 与 Tauri IPC 双轨兼容适配网桥设计** | 桌面端架构 / IPC 协议 | `Cannot read properties of undefined (reading 'invoke')` 根因剖析、Universal Bridge 映射与原生文件拾取器直连 | [05-desktop-webview-tauri-ipc-bridge.md](./05-desktop-webview-tauri-ipc-bridge.md) |
| **06** | **AgentRouter 多模型网关对接、真实测速拉取与会话模型选择器设计** | 模型网关 / 协议路由 | 渠道保存即时关联、对话框模型选择下拉器、401 `unauthorized client` 特征攻防与真实毫秒级探活拉取 | [06-agentrouter-gateway-models-and-channel-sync.md](./06-agentrouter-gateway-models-and-channel-sync.md) |
| **07** | **客户端白屏根因防御、模块级锚定弹窗与全功能状态记忆体系** | UI 架构 / 容错机制 / 状态记忆 | 渲染层属性链防御、顶层 ErrorBoundary 容灾、顶部/底部双弹窗锚定定位与全功能状态生命周期持久化 | [07-workbench-white-screen-prevention-and-full-state-memory.md](./07-workbench-white-screen-prevention-and-full-state-memory.md) |
| **08** | **系统日志诊断追踪系统与 7 天自动清理定时任务设计** | 系统运维 / 7天日志留存 / 故障排查 | `toUpperCase` 空指针拦截修补、全量前端/后端日志收集体系、24小时守护定时任务与 7 天滑动保留算法 | [08-system-logger-and-7-day-auto-cleanup-daemon.md](./08-system-logger-and-7-day-auto-cleanup-daemon.md) |

---

## 📝 知识点归档标准规约 (Contribution Standard)

新增任何知识点或解决方案时，必须严格遵守以下四段式结构：
1. **① 知识点与问题背景 (Context & Problem Statement)**：出现场景、目标需求、报错日志或异常行为复现。
2. **② 核心原理与知识内容 (Knowledge Content & Root Cause)**：技术规范、底层原理、数据流向及根本原因剖析。
3. **③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)**：详细、经实测验证的命令、配置、改动代码或操作步骤。
4. **④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)**：团队工程约定与长效防范机制。
