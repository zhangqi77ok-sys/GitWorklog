# 工作流 Provider 发现与确认 PRD

**版本**：v1.0
**状态**：原型验收前
**适用范围**：Tcode 桌面端普通任务、SDD/TDD、Superspec 及其他用户安装的开发工作流

## 1. 背景与问题

Tcode 当前会将全局规则、可用 Skill 和 Agent Loop 约束注入模型上下文，但没有区分“环境中存在某种工作流”和“用户本次任务选择了某种工作流”。因此用户只是在普通咨询或开发任务中提到项目时，界面可能直接出现 SDD/TDD 阶段约束，造成默认套用范式、流程被打断、用户不知道下一步该做什么。

用户可能安装 Superspec、SpecKit、OpenSpec、企业内部工作流或自定义 Skill。核心产品不能为每个工具写死关键词，也不能因为工具已安装就自动启用。

## 2. 产品目标

1. 识别用户是否明确想使用某种开发范式或已安装工作流。
2. 将工作流 Provider 的“发现、选择、启用、执行”分成四个独立状态。
3. 用户没有表达范式意图时，默认使用普通任务模式，不显示 SDD/TDD 专属阶段，也不注入对应工作流 Prompt。
4. 支持发现 Superspec 等外部 Provider，但只有用户确认后才能激活。
5. 对未知、未适配或不可信 Provider 清晰降级，不伪造支持，不自动执行外部命令。
6. 通过可点击原型验证用户能理解当前模式、Provider 来源、权限和下一步。

## 3. 非目标

- v1 不实现所有外部工具的完整执行适配器。
- v1 不自动安装 Provider、不自动联网下载 Provider、不自动执行未知安装脚本。
- v1 不允许 Provider 绕过 Tcode 的文件、命令、网络和高风险审批机制。
- v1 不把项目中的 `AGENTS.md`、Skill 或规则文件直接等同于用户选择。
- v1 不在普通模式下强制启用 SDD/TDD。

## 4. 术语与状态

| 术语 | 定义 |
|---|---|
| Provider | 一个提供开发流程、规范或任务编排能力的来源，例如内置 SDD/TDD、Superspec、企业工作流。 |
| Discovered | 系统在允许的项目/用户范围内发现了 Provider。 |
| Selected | 用户在当前任务中选择了 Provider 候选。 |
| Active | 用户确认并已为当前 Run 启用 Provider。 |
| Executing | Provider 的阶段和动作正在当前 Run 中执行。 |
| Normal | 未选择任何范式时的普通任务模式。 |

状态流转必须是：

```text
unknown → discovered → selected → active → executing
                         ↘ cancelled
```

`discovered` 不能直接跳到 `active`。

## 5. 用户意图判定

### 5.1 明确意图

以下表达可以识别为候选意图，但仍应在可能产生阶段门禁或动作前显示确认：

- “请使用 SDD”
- “请按 TDD 先写失败测试”
- “使用 SDD + TDD 完成”
- “请使用 Superspec”
- `/workflow superspec`

### 5.2 非工作流意图

以下内容必须保持普通模式：

- “什么是 TDD？”
- “解释一下 SDD 和 TDD 的区别。”
- “帮我修复窗口没有居中的问题。”
- “我安装了 Superspec。”
- 引用、粘贴、审查某个工作流文档但没有要求采用它。

### 5.3 否定意图

以下内容必须覆盖关键词命中结果：

- “不要使用 SDD。”
- “不用 TDD，直接实现。”
- “不要走 Superspec 流程。”

### 5.4 模糊意图

“按规范做”“按最佳实践开发”“使用专业流程”等表达必须弹出选择卡，不得自动选择 SDD/TDD 或任意外部 Provider。

## 6. Provider 发现范围

### 6.1 项目范围

优先检查用户已打开工程内的显式清单或配置：

- `.agents/workflows/`
- `.agents/skills/`
- `.kiro/skills/`
- `.kiro/steering/`
- `.specify/`
- `specs/`
- `AGENTS.md`
- `package.json`、`pyproject.toml`、`Cargo.toml` 中声明的工作流入口

### 6.2 用户范围

只检查明确允许的用户配置目录，例如 `%USERPROFILE%\\.agents`、`%USERPROFILE%\\.kiro` 或用户主动添加的 Provider 根目录。不得扫描整个磁盘。

### 6.3 CLI 发现

可以在用户确认后检查已配置的 CLI 是否存在，例如 `superspec`，但“命令存在”只能证明 Provider 可被发现，不能证明它兼容 Tcode 或可以安全执行。

## 7. 交互流程

### 7.1 无范式意图

输入普通任务后显示：

```text
普通任务模式
直接描述目标即可。需要使用 SDD、TDD 或其他工作流时，可从工作流选择器中启用。
```

不显示 SDD/TDD 阶段卡，不注入范式专属 Prompt。

### 7.2 发现 Provider

```text
发现可用工作流：Superspec
来源：当前工程 / 用户级安装
状态：已发现，尚未启用
能力：Spec、任务拆解、验收清单

[查看详情] [本次启用] [忽略]
```

### 7.3 启用确认

```text
本次任务将启用 Superspec
版本：1.2.0
工作范围：当前工程
需要权限：读取文件、生成文档、执行验证命令

[确认启用] [改为普通任务] [取消]
```

### 7.4 未适配 Provider

```text
已发现 Superspec，但当前没有可验证的 Tcode 适配器。
你可以手动提供 manifest，或继续使用普通任务模式。

[查看发现信息] [提供适配配置] [普通任务]
```

## 8. 原型验收标准

- A1：普通任务不会自动出现 SDD/TDD 专属约束。
- A2：输入“请使用 TDD”后显示候选确认，确认前不进入 TDD Run。
- A3：输入“我安装了 Superspec”只显示发现提示，不自动启用。
- A4：选择 Superspec 后能看到来源、版本、能力、权限和适配状态。
- A5：点击“本次启用”后显示 Active 状态，并提供“切换为普通任务”。
- A6：点击取消、忽略或普通任务后，当前任务不携带 Provider。
- A7：未知 Provider 显示未适配降级状态，不显示虚假的执行阶段。
- A8：同一界面能处理 SDD、TDD、SDD + TDD 和外部 Provider。
- A9：关闭面板或切换会话不会把未确认 Provider 变成已启用。
- A10：原型中的所有按钮都有可见状态变化或明确的取消反馈。

## 9. 产品成功指标

- 用户能在 3 秒内判断当前是普通模式还是某个 Provider 模式。
- 用户不会因系统发现文件或安装 CLI 而意外进入 SDD/TDD。
- 用户能在一次交互内完成 Provider 发现 → 查看 → 确认 → 激活。
- 未适配 Provider 的错误不会被误解为“工具执行失败”。
