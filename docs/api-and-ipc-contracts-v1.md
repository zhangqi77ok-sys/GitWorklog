# v1 首批 API / IPC 接口定义

## 1. 目标

本文档定义 v1 第一批最重要的应用接口，覆盖：

- Task 管理
- LoopRun 管理
- Session 发现与绑定
- 文档和计划绑定
- 分析、决策、动作与审核流查看

v1 建议采用：

- 桌面主进程负责本地能力与数据访问
- 渲染进程通过 IPC 调用主进程服务
- 如果后续要拆 Web API，可直接复用相同领域模型

## 2. 资源视图

主要资源：

- `tasks`
- `loop-runs`
- `sessions`
- `document-bindings`
- `plan-steps`
- `analyses`
- `actions`
- `reviews`
- `policies`

## 3. IPC 通道建议

建议统一前缀：

- `tasks:*`
- `loopRuns:*`
- `sessions:*`
- `documents:*`
- `planSteps:*`
- `analysis:*`
- `actions:*`
- `reviews:*`
- `policies:*`

## 4. Task 接口

### `tasks:list`

用途：
- 获取任务列表

返回字段建议：
- `taskId`
- `title`
- `goal`
- `riskProfile`
- `projectPath`
- `latestLoopRun`

### `tasks:create`

输入：
- `title`
- `description`
- `goal`
- `constraints`
- `successCriteria`
- `riskProfile`
- `templateType`
- `projectPath`

### `tasks:update`

输入：
- `taskId`
- 可更新字段

### `tasks:get`

输入：
- `taskId`

### `tasks:delete`

输入：
- `taskId`

## 5. LoopRun 接口

### `loopRuns:create`

输入：
- `taskId`
- `mode`
- `policyId`

### `loopRuns:listByTask`

输入：
- `taskId`

### `loopRuns:get`

输入：
- `loopRunId`

返回应包含：
- 基础信息
- 当前状态
- 绑定 Session
- 文档绑定
- 计划步骤
- 最近 Decision
- 最近 Action

### `loopRuns:updateStatus`

输入：
- `loopRunId`
- `status`

## 6. Session 接口

### `sessions:discover`

用途：
- 扫描本地 Codex 会话

返回字段建议：
- `sessionId`
- `threadId`
- `windowId`
- `title`
- `projectPath`
- `sourcePath`
- `sourceType`
- `lastEventAt`

### `sessions:bind`

输入：
- `loopRunId`
- `session`

用途：
- 将发现到的会话绑定到当前 LoopRun
- 持久化 `sourcePath`，供后续导入原始 JSONL 事件

### `sessions:ingestEvents`

输入：
- `loopRunId`
- `sessionId`
- `limit` 可选

返回：
- `importedCount`

用途：
- 从绑定 session 的 `sourcePath` 读取 Codex JSONL
- 将解析后的事件写入 `session_events`
- 重复导入同一来源时保持幂等，`importedCount` 只统计新增事件
- 重复事件按 `loopRunId + sessionId + eventType + createdAt + payload` 判断
- 导入后可通过 `loopRuns:snapshot` 查看 Replay Seed 时间线

### `sessions:refresh`

输入：
- `sessionId`

用途：
- 触发一次主动同步

## 7. 文档和计划绑定接口

### `documents:bind`

输入：
- `loopRunId`
- `docType`
- `sourcePath`
- `version`

### `documents:list`

输入：
- `loopRunId`

### `documents:disable`

输入：
- `bindingId`

### `planSteps:create`

输入：
- `taskId`
- `title`
- `description`
- `orderIndex`
- `relatedFiles`
- `dependsOn`

### `planSteps:listByTask`

输入：
- `taskId`

### `planSteps:update`

输入：
- `planStepId`
- 可更新字段

## 8. 分析与决策接口

### `analysis:runForLoop`

输入：
- `loopRunId`

用途：
- 对某个 LoopRun 触发一次分析流程

返回：
- 最新分析摘要
- 决策结果

### `analysis:getLatest`

输入：
- `loopRunId`

返回：
- 当前任务判断
- 停止原因
- 风险等级
- 建议动作
- 证据列表

### `analysis:listDecisions`

输入：
- `loopRunId`

## 9. Action 与 Review 接口

### `actions:createSuggestion`

输入：
- `loopRunId`
- `decisionId`

用途：
- 生成建议动作草稿

### `actions:listByLoopRun`

输入：
- `loopRunId`

### `actions:execute`

输入：
- `actionId`

说明：
- v1 可先仅支持标记执行
- 自动续跑发送能力后续接入

### `reviews:listPending`

用途：
- 获取待审核动作

### `reviews:approve`

输入：
- `reviewId`
- `comment`

### `reviews:reject`

输入：
- `reviewId`
- `comment`

## 10. Policy 接口

### `policies:list`

用途：
- 获取策略模板列表

### `policies:get`

输入：
- `policyId`

### `policies:create`

输入：
- `name`
- `scopeType`
- `mode`
- `riskThreshold`
- `autoResumeEnabled`
- `autoResumeLimit`
- `cooldownSeconds`

### `policies:update`

输入：
- `policyId`
- 可更新字段

### `policies:listRules`

输入：
- `policyId`

### `policies:updateRule`

输入：
- `ruleId`
- `enabled`
- `priority`
- `condition`
- `action`

## 11. 错误返回格式建议

统一错误结构建议：

```json
{
  "code": "TASK_NOT_FOUND",
  "message": "Task does not exist.",
  "details": {}
}
```

## 12. v1 接口实现优先级

建议优先顺序：

1. `tasks:*`
2. `loopRuns:*`
3. `sessions:discover`
4. `sessions:bind`
5. `sessions:ingestEvents`
6. `documents:*`
7. `planSteps:*`
8. `analysis:*`
9. `actions:*`
10. `reviews:*`
11. `policies:*`

## 13. 说明

本接口文档是 v1 首版草案，目标是让前后端和桌面主进程之间先有清晰边界。等接入能力稳定后，再补充：

- 批量操作接口
- 实时订阅接口
- 自动续跑实际发送接口
