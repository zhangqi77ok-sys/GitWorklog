# WP-A · 生命周期引擎（三大黄金不变量）+ 硬沙箱设计文档

> 日期：2026-08-31
> 状态：已确认（User Approved 2026-08-31）
> 来源：TCODE-ENG-SPEC-2026-08 模块二 + 模块四（拆分后首个子项目）
> 关联铁律：铁律 1（SDD+TDD）、铁律 1.5（打包+安装+真实桌面调用闭环）

---

## 1. 背景与问题（实测证据）

### 1.1 模块二：闲聊多轮 Bug 与关键词脑补
- `App.tsx:1588` 存在自动续轮条件：`if (frozenRunMode === 'act' && hasUnfinishedWork && (hasInspectActions || hasNotWrittenCode) && loopCount <= 4 ...)`——它基于"未落盘/未通过"的猜测强制驱动下一轮，而非"本轮是否产出工具调用"。发送"你好"等闲聊会因此被拖入多轮循环。
- `agentLoop.ts:1091` 存在关键词正则自动标记验收项：`/写入|修改|实现|修复/i.test(item.description)`——系统在底层脑补验收清单，违反"验收清单唯一来源原则"。

### 1.2 模块四：工具越权无硬拦截
- 当工作流阶段只允许 `read_file` 时，仅靠 Prompt 无法阻止 LLM 产出 `write_file` Tool Call；若后端直接抛 Unhandled Exception 会导致前端红屏。缺少协议层 tools 过滤与运行时 403 结构化反馈。

## 2. 目标与非目标

### 2.1 目标
1. **黄金不变量 1**：零工具调用 = 自然终结。无论闲聊/自省/否定句，只要 `actions.length === 0`，单轮标记 completed 立即退出，绝不伪造待办项。
2. **黄金不变量 2**：工具驱动收敛。有工具调用 → 执行-反馈-自主收敛；模型自行决定何时完成，调度器不横加干预。
3. **黄金不变量 3**：验收清单唯一显式来源（工作流 spec 声明 / 模型 Markdown `- [ ]`），删除关键词脑补。
4. **硬沙箱双层防御**：协议层裁剪 `tools` 数组 + 运行时 `executeSandboxAction` 硬校验，越权返回结构化 403 反馈（不抛异常），回传模型自愈，前端 0 红屏。
5. 全部通过 SDD+TDD 与铁律 1.5 真实桌面闭环。

### 2.2 非目标（明确排除）
- 模块一（模式收敛）/ 模块三（会话并发）/ 模块五（Stage Gate）/ 模块六（真并发 Swarm）/ 模块七（缓存索引）：后续 WP-B/C/D/E。
- 真 Tree-sitter RepoMap（模块七专项）。
- ChatColumn Hook 重构。
- 协议级工具解析（XML/fenced/tool-call）保持现状，不属于"关键词正则"范畴。

## 3. 总体架构

```text
prototype/src/
├── services/
│   ├── agentLoop.ts        # 修改：新增 shouldContinueLoop；删除关键词脑补验收；新增 executeSandboxAction/filterToolDefs
│   └── (sandboxPolicy.ts   # 可选：若 agentLoop 过大则独立，否则并入 agentLoop)
├── App.tsx                 # 修改：1588 续轮条件改用 shouldContinueLoop；executeActionOnHost 接 executeSandboxAction；请求 tools 经 filterToolDefs
tests/
├── loopConvergence.test.ts # 新增：黄金不变量收敛测试
└── sandboxPolicy.test.ts   # 新增：硬沙箱测试
```

## 4. 详细设计

### 4.1 模块二：黄金不变量纯函数化（方案 A）

**新增纯函数（agentLoop.ts）**
```typescript
export interface LoopContinueVerdict {
  continue: boolean;
  reason: 'natural_completion' | 'tool_driven' | 'max_turns';
}

export function shouldContinueLoop(params: {
  actions: AgentAction[];
  acceptanceItems: TargetAcceptanceItem[];
  loopCount: number;
  maxTurns?: number;
}): LoopContinueVerdict {
  const maxTurns = params.maxTurns ?? 8;
  if (params.loopCount >= maxTurns) return { continue: false, reason: 'max_turns' };
  if (!params.actions || params.actions.length === 0) {
    return { continue: false, reason: 'natural_completion' };
  }
  return { continue: true, reason: 'tool_driven' };
}
```
- 黄金不变量 1：`actions.length === 0` → `natural_completion`（无论 acceptanceItems 如何，绝不被空/假验收项驱动续轮）。
- 黄金不变量 2：`actions.length > 0` → `tool_driven`，直到 maxTurns 熔断。
- 注意：`acceptanceItems` 参数保留在签名中用于未来 Graph 门禁扩展，但**不参与** `continue` 判定（避免脑补压力）。

**验收清单唯一来源（黄金不变量 3）**
- 删除 `agentLoop.ts:1091` 的 `/写入|修改|实现|修复/` 自动标记。
- 验收项仅两个来源：
  1. 工作流 spec 显式声明（Graph 模式/工作流积木）；
  2. 模型在 Markdown 中显式输出 `- [ ] 任务`。
- 两者皆无 → `acceptanceItems` 严格为空。

**App.tsx 循环体改造**
- 删除 1588 行的 `hasUnfinishedWork && (hasInspectActions || hasNotWrittenCode) && loopCount <= 4`。
- 每轮流式结束后：
  ```typescript
  const verdict = shouldContinueLoop({ actions, acceptanceItems, loopCount });
  if (!verdict.continue) {
    currentLoopStatus = verdict.reason === 'max_turns' ? 'resource_limit' : 'completed';
    break;
  }
  ```
- 现有取消信号（`agentLoopCancelledRef`）与审批挂起逻辑保持不变。

**数据流**
```
用户输入 → LLM 流式输出 (text + toolCalls)
  → actions = parseAgentActions(toolCalls)
  → shouldContinueLoop(actions, acceptanceItems, loopCount)
    → 0 actions → 自然终结（completed），单轮退出
    → >0 actions → 执行 → 回传观察 → 下一轮（循环上限 8）
```

**错误处理**
- maxTurns 熔断 → `resource_limit` 终止，不无限循环。
- 取消信号优先于一切继续判定。

### 4.2 模块四：硬沙箱双层防御（方案 A）

**新增纯函数（agentLoop.ts / sandboxPolicy.ts）**
```typescript
export function resolveAllowedTools(workflowBlock?: { allowedTools?: string[] }, mode?: string): string[] {
  if (workflowBlock?.allowedTools && workflowBlock.allowedTools.length > 0) return workflowBlock.allowedTools;
  // 模式默认集
  switch (mode) {
    case 'act': return ['read_file', 'write_file', 'run_command', 'grep_search', 'find_by_name'];
    case 'plan': return ['read_file', 'grep_search', 'find_by_name'];
    default: return ['read_file', 'write_file', 'run_command', 'grep_search', 'find_by_name'];
  }
}

export function filterToolDefs(tools: ToolDef[], allowedTools: string[]): ToolDef[] {
  return (tools || []).filter(t => allowedTools.includes(t.name) || allowedTools.includes(t.type));
}

export async function executeSandboxAction(
  action: AgentAction,
  allowedTools: string[],
  executeHost: (a: AgentAction) => Promise<ActionResult>
): Promise<ActionResult> {
  if (!allowedTools.includes(action.type)) {
    return {
      actionId: action.id,
      type: action.type,
      target: action.target,
      status: 'rejected',
      output: `【权限安全保护 403】: 当前工作流阶段受安全策略约束，仅允许使用 [${allowedTools.join(', ')}]，已拦截未经授权的 [${action.type}] 动作。请先完成当前阶段要求！`,
      error: 'PERMISSION_RESTRICTED'
    };
  }
  return executeHost(action);
}
```

**改造点**
1. **协议层过滤**：App.tsx 构建 LLM 请求（`buildGatewayRequestBody` / gateway `req.tools`）时，先 `filterToolDefs(tools, allowedTools)`。
2. **运行时硬校验**：`executeActionOnHost` 内部改为 `executeSandboxAction(action, allowedTools, executeHostImpl)`；越权返回结构化 rejected（不抛异常），该结果随 actionResults 回传模型 → 模型自愈纠偏。
3. allowedTools 来源：当前活动工作流 block 的 `allowedTools` 配置；无工作流时按模式默认集。

**数据流**
```
阶段 allowedTools
  → filterToolDefs → LLM 请求 tools（协议层，模型根本拿不到越权工具定义）
  → LLM 工具调用 → parseAgentActions → executeSandboxAction(action, allowedTools)
    → 越权 → rejected 403 结构化反馈 → 回传模型 → 自愈
    → 合法 → executeHost → 真实执行
```

**错误处理**
- 越权不抛异常：统一为 `ActionResult.status === 'rejected'` + `error === 'PERMISSION_RESTRICTED'`。
- 宿主层既有 401/403（Token/路径/代理）保持不变，互不干扰。

## 5. 测试计划（SDD+TDD）

### 5.1 `tests/loopConvergence.test.ts`（新增）
| 用例 | 断言 |
|---|---|
| 闲聊零工具调用 | `shouldContinueLoop` → natural_completion；验收列表为空（不脑补） |
| 只读查询收敛 | 第 1 轮 read_file → tool_driven；第 2 轮 0 动作 → natural_completion |
| 编码任务 | 持续工具调用 → tool_driven；达到 maxTurns → max_turns 熔断 |
| 验收项不因关键词自动标记 | `item.description` 含"写"/"修改"但不含显式 `- [ ]` 时不进入 acceptanceItems |
| 显式 `- [ ]` 声明 | 模型 Markdown 输出 `- [ ]` 时才生成验收项 |

### 5.2 `tests/sandboxPolicy.test.ts`（新增）
| 用例 | 断言 |
|---|---|
| resolveAllowedTools | 工作流 block 白名单优先；无 block 时按模式默认集（plan 只读） |
| executeSandboxAction 越权 | rejected + PERMISSION_RESTRICTED；**不抛异常**；output 含"403"与工具名 |
| executeSandboxAction 合法 | 调用宿主，返回宿主结果 |
| filterToolDefs | tools 数组被正确裁剪（read_file 阶段剔除 write_file） |

### 5.3 回归与铁律 1.5
- 全量 Vitest（现 302 + 新增）与 Python 49 项保持全绿；lint 0 错误。
- 打包 → 静默安装（先停实例+核对时间戳）→ `/health` 200 → `/` 200 含 Token → 无 Token 401。
- 真实模型调用：发送"你好"验证**单轮收敛**（不触发第 2 轮）；只读阶段模型试图写文件时验证 403 自愈反馈。
- 一键执行：`scripts/run_acceptance.py`。

## 6. 验收标准（Done Definition）
- [ ] 闲聊"你好"单轮收敛、验收为空（硬标准：0 工具调用即退出，绝不触发第 2 轮；0.5s 级响应为网络相关的参考指标）。
- [ ] 只读阶段 write_file 被 403 结构化拦截，模型收到反馈自愈，系统 0 崩溃。
- [ ] 关键词正则不再自动标记验收项；验收仅来自显式声明。
- [ ] shouldContinueLoop / executeSandboxAction / filterToolDefs / resolveAllowedTools 纯函数测试全绿。
- [ ] 全量回归 + 铁律 1.5 闭环通过。
- [ ] 全部提交并推送，工作区干净。

## 7. 范围外（后续 WP）
- WP-B：模块五（Stage Gate）+ 模块一（模式收敛）。
- WP-C：模块三（会话级并发）。
- WP-D：模块七（缓存接线验证）。
- WP-E：模块六（真并发 Swarm）。
