# Tcode v1.0 功能边界与真实状态交付矩阵

本文档是 Tcode v1.0 版本的正式验收与交付合同。明确区分**【生产级真能力 (v1.0)】**与**【演进中规划特性 (v1.1+)】**，坚决杜绝用 Mock 或伪界面冒充正式能力。

---

## 📊 一、v1.0 核心能力交付矩阵

| 模块 ID | 功能名称 | 触发入口 | 真实数据链路 | 验收标准 / 真实证据 | 交付状态 |
|---|---|---|---|---|---|
| **CORE-01** | 文件系统双向读写 | 左侧工作区 / Agent Loop | Python 宿主 `/api/fs/*` | 真实读写本地文件，落盘后即刻触发刷新 | ✅ 生产交付 |
| **CORE-02** | 宿主终端真实命令执行 | Agent Loop / 终端面板 | Python 宿主 `/api/terminal/exec` | 返回真实 ExitCode、stdout 与 stderr，强校验 `ExitCode === 0` | ✅ 生产交付 |
| **CORE-03** | 目标驱动闭环 Agent Loop | 对话发送框 (Enter) | `agentLoop.ts` + SSE 流式网关 | 具备循环上限熔断、失败自愈推演与终止状态汇总 | ✅ 生产交付 |
| **SAFE-01** | Air-Gapped 离线物理隔离 | 系统设置 → 安全 | `hostGateway.ts` 拦截层 | 开启时物理拦截 `curl`、`wget`、`git push` 等出站网络 | ✅ 生产交付 |
| **SAFE-02** | 敏感凭据内存脱敏导出 | 设置中心 → 导出配置 | `settingsStore.ts` | 导出 JSON 时 API Key 自动脱敏屏蔽为 `********` | ✅ 生产交付 |
| **SAFE-03** | 单一事实源规则响应式中枢 | 设置中心 → 规约 | `rulesStore.ts` + CustomEvent | 设置面板切换规则，即刻同步 `ChatColumn` 与 Prompt 构造 | ✅ 生产交付 |
| **GIT-01** | Git 影子快照与一键无损回滚 | 消息流「↩ 回到这里」 | Git 底层 Plumbing 机制 | 每次 Agent 操作前创建独立快照，点击瞬间恢复代码与会话 | ✅ 生产交付 |
| **GIT-02** | 语义化原子提交生成 | 顶部「语义提交」按钮 | `SemanticCommitModal.tsx` | 自动执行 `git add -A` 并提交，返回真实 Short Commit Hash | ✅ 生产交付 |
| **TEST-01** | 自动化测试资源管理器 | 右侧工作台 → [测试资源] | `TestExplorer.tsx` + 宿主命令 | 真实运行 `npm test`，按用例解析耗时并支持点击跳转源码 | ✅ 生产交付 |
| **DIFF-01** | 交互式 Hunk 级变更审查 | 右侧工作台 → [Diff 审查] | `InteractiveDiffViewer.tsx` | 支持 Split / Unified 切换，Hunk 级独立接受与拒绝 | ✅ 生产交付 |
| **TELE-01** | 真实 LLM 上下文水位遥测 | 顶部/对话栏上下文胶囊 | `contextTelemetry.ts` | 动态绑定 `currentModel.contextLimit`，触发智能无损压缩 | ✅ 生产交付 |

---

## 🔮 二、v1.1+ 规划与演进边界（非 v1.0 验收阻断项）

- **Swarm 蜂群全自动多智能体编排**：当前为实验性 Harness 拓扑预览；
- **全链路 Trace 时光机可视化推演**：v1.1 规划；
- **Tauri v2 + Rust Core 深度原生化重构**：v1.2 架构演进目标。
