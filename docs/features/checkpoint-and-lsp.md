# PRD 增量：Checkpoint 回滚 + 授权门禁 + LSP 诊断闭环

> 需求-原型-开发三位一体：本 PRD 与 `prototype/` 交互原型强同步。
> 状态: Draft v0.1 (待人工验收)

## 1. 背景与目标

Tcode 的 Agent 已具备自主执行写文件/命令的能力（Stage Gate 质量门禁）。
但企业级用户面对"AI 放手改代码"仍有两大信任缺口：

1. **无后悔药**：Agent 改坏多文件后无法按时间点一键回滚 —— 需要 **Checkpoint 快照与恢复点时间轴**。
2. **无权限边界**：Agent 写敏感目录、执行高危命令（git push / 删除）缺乏显式授权 —— 需要 **策略引擎 + ask 人工确认**。
3. **无编译感知**：Agent 写完代码"看似正确实则编译不过" —— 需要 **LSP 诊断注入自愈循环**。

## 2. 功能范围

### F1. Checkpoint 快照与回滚
- 在 Agent 每次 `write_file` **前**自动保存该文件的内容快照（URL-safe 编码，存于存储目录 `.tcode/checkpoints/<session_id>/`）。
- 快照链按会话组织；支持 `list(session_id)`、`restore(session_id, checkpoint_id)`、`diff(checkpoint_id)`。
- 回滚 = 将快照内容写回目标文件，并给出影响文件列表。
- API:
  - `GET  /api/checkpoints?session_id=xxx` → 时间轴
  - `POST /api/checkpoints/restore` `{session_id, checkpoint_id}`
  - `GET  /api/checkpoints/{checkpoint_id}/diff`

### F2. 授权策略引擎（Policy Engine）
- 三级判定：`allow` / `deny` / `ask`。
- 默认策略（安全基线）：
  - `deny`：出站网络（复用 airgap）、仓库外路径、系统目录（`C:\Windows` 等）
  - `ask`：`git push / rm / del / 高风险命令`、`src/` 与 `core/` 等受保护目录写入
  - `allow`：`tests/`、`*.md` 低风险写入；`read_file / 只读命令`
- 策略来源：`policies.json`（全局）+ 会话内 trust glob（前端已具备 `ActionScopeTrust`）。
- 接口:
  - `PolicyDecision = allow|deny|ask + reason`
  - `check(path_or_cmd, action_type, session_id) → PolicyDecision`
- Agent 循环接入：`write_file`/`run_command` 前查策略；`deny` 直接终止该动作，`ask` 挂起会话等待前端确认（复用 `ActionApprovalModal`），确认后按 trust 记忆。

### F3. LSP 诊断闭环
- 内置轻量 LSP 客户端（进程托管 + JSON-RPC over stdio）：
  - 支持 `typescript-language-server`（.ts/.tsx）与 `pyright-langserver`（.py，可选）。
  - `initialize` → `didOpen`/`didChange` → `publishDiagnostics` 缓存。
- Agent 循环集成：
  - 写文件后触发 `diagnose(file_path)`；
  - 若存在 error 级诊断，将诊断列表注入 LLM 的观察反馈（"你刚写的 src/x.ts 有 3 个编译错误: ..."），驱动自愈循环（最多 N=3 轮，N 收敛于 Stage Gate）。
- API:
  - `POST /api/lsp/diagnose` `{file_path, language}`
  - `GET  /api/lsp/diagnostics?file_path=xxx`
  - `POST /api/lsp/analyze-workspace`（批量）

### F4. 前端交互原型（对应上述后端）
- `CheckpointTimeline`：会话内恢复点时间轴，可点击 diff 预览 + "回滚到此"。
- `ApprovalModal`（增强现有 `ActionApprovalModal`）：展示策略判定 `ask` 的原因与风险等级。
- `DiagnosticsPanel`：实时展示当前文件 LSP 诊断（错误/警告列表），Agent 自愈过程中闪烁更新。

## 3. 非目标（本期不做）
- 不做文件级 diff 可视化合并编辑器（仅回滚）。
- 不做多 LSP 并行工作区全量索引（只做按需诊断）。
- 不做策略的 UI 在线编辑（本期为 JSON 配置文件）。

## 4. 验收标准（对齐 AC-1 ~ AC-8）
- [ ] checkpoint_service: 快照创建/列表/回滚/幂等删除
- [ ] policy_service: allow/deny/ask 判定 + airgap 联动
- [ ] desktop_app 路由挂载 /api/checkpoints /api/policy /api/lsp
- [ ] agent loop: 写文件前快照、策略门禁、诊断反馈自愈
- [ ] LSP 客户端进程托管、诊断缓存、超时回收
- [ ] 前端 Timeline / ApprovalModal / DiagnosticsPanel 可点击交互原型
- [ ] pytest 全部通过；vitest + tsc 全部通过

## 5. 风险与对策
| 风险 | 对策 |
|---|---|
| 本机缺 Python 运行时 | winget 安装 Python 3.12；安装后刷新 PATH |
| LSP server 未随包分发 | 按需探测 `node_modules/.bin` / 系统 PATH；缺失时降级为"延迟到构建期" |
| 回滚竞态（Agent 正在写） | 回滚前暂停目标会话队列（SessionActorManager 已有队列） |