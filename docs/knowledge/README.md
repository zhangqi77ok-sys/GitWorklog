# Tcode 核心工程知识库与问题解决方案索引 (Knowledge Base & Solution Vault)

> 本知识库依据 `AGENTS.md`【铁律 6】强制设立：项目中遇到的每一个核心知识点、架构选型决策、环境适配陷阱与高频编译/运行报错，必须在此归档完整的知识内容、底层技术原理剖析与可落地的标准解决方案。

---

## 📚 知识点与解决方案目录索引

| 序号 | 知识点 / 技术议题 | 分类领域 | 核心关注点 | 关联文档 |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **Windows 环境下 Tauri 2.0 (Rust) 编译与安装包打包全解析** | 桌面端内核 / 构建运维 | MSVC 链接器依赖、`link.exe` 缺失、`cargo-xwin` 符号链接特权（os error 1314）与三种安装包打包方案 | [01-windows-tauri2-msvc-packaging.md](./01-windows-tauri2-msvc-packaging.md) |
| **02** | **AI Agent 跨会话长期工程记忆层与提示词动态注入机制** | Agent 认知架构 / 记忆库 | 用户纠偏规约提取、长期记忆本地化持久存储、System Prompt 置顶注入与 Token 预算平衡 | [02-cross-session-memory-vault.md](./02-cross-session-memory-vault.md) |
| **03** | **LSP 编译器诊断与代码自愈闭环设计** | 编译器工具链 / 自愈循环 | 文件落盘触发式语法诊断（TSC / Python / Rust）、红线报错结构化解析、Agent 循环下轮自愈注入 | [03-lsp-compiler-diagnostics-loop.md](./03-lsp-compiler-diagnostics-loop.md) |
| **04** | **动态多协议模型网关 (Dynamic Ingress Gateway) 设计** | 模型路由 / 渠道总线 | Sub2API / NewAPI / OpenAI / Anthropic 多协议标准化转化、多模态 Vision Payload 兼容适配 | [04-dynamic-ingress-model-gateway.md](./04-dynamic-ingress-model-gateway.md) |

---

## 📝 知识点归档标准规约 (Contribution Standard)

新增任何知识点或解决方案时，必须严格遵守以下四段式结构：
1. **① 知识点与问题背景 (Context & Problem Statement)**：出现场景、目标需求、报错日志或异常行为复现。
2. **② 核心原理与知识内容 (Knowledge Content & Root Cause)**：技术规范、底层原理、数据流向及根本原因剖析。
3. **③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)**：详细、经实测验证的命令、配置、改动代码或操作步骤。
4. **④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)**：团队工程约定与长效防范机制。
