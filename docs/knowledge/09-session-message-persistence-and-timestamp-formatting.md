# 09 - 会话消息持久化存盘与时间戳防御性渲染

> **归档编号**：KNOW-09  
> **关联规范**：`AGENTS.md`【铁律 6】、`AGENTS.md`【铁律 1.5】  
> **核心领域**：数据持久化 / 流式消息追踪 / 健壮性渲染

---

## ① 知识点与问题背景 (Context & Problem Statement)

用户反馈“问答突然就什么都没了”，并且从界面截图中观察到：
1. **对话内容为空**：发送对话指令后，主视图显示初始欢迎界面，之前产生的聊天历史完全消失；
2. **侧边栏状态异常**：侧边栏会话项显示 `0 轮对话` 且更新时间显示为 `NaN:NaN`。

---

## ② 核心原理与根本原因剖析 (Knowledge Content & Root Cause)

### 1. 消息未落地存盘导致重载清空
- 前端发送对话指令时，`stream_chat_prompt` 通过 SSE/代理把流式 Token 推送到界面显示；
- 流式结束时触发 `agent_stream_done` 事件，UI 自动调用 `loadInitialData()` 重新从 `list_projects_and_sessions` 拉取最新的会话数据库；
- **根本原因**：之前 `stream_chat_prompt` 和 `run_swarm_flow_task` 只负责流式推送，**未将用户的 Prompt 和 AI 的 Response 回写存入 `session.messages`**。导致 `loadInitialData()` 重载时，拉取到的 `messages` 仍为空数组，对话随之清空。

### 2. `NaN:NaN` 时间戳显示原因
- 当新会话创建或默认会话加载时，数据对象中缺少 `updated_at` 字段；
- `SessionTreeItem.tsx` 的 `formatTimestamp` 直接使用 `Date.now() - session.updated_at`。由于 `session.updated_at` 为 `undefined`，减法结果为 `NaN`，格式化为时间字符串即呈现 `NaN:NaN`。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 增加全局消息持久化落盘方法 (`tauriBridge.ts`)

```typescript
function persistMessageToSession(
  sessionId: string | null,
  role: 'user' | 'assistant' | 'system',
  content: string,
  thought?: string
) {
  if (!sessionId) return;
  const db = loadProjectsDb();
  for (const proj of db.projects) {
    const sess = proj.sessions.find((s: BridgeSessionRecord) => s.id === sessionId);
    if (sess) {
      if (!Array.isArray(sess.messages)) sess.messages = [];
      sess.messages.push({
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role,
        content,
        thought,
        timestamp: Date.now(),
      });
      sess.updated_at = Date.now(); // 实时更新最新会话时间戳
      saveProjectsDb(db);
      break;
    }
  }
}
```

### 2. 在流式链路与 SwarmFlow 节点完成处自动落盘
- **用户发送**：在 `stream_chat_prompt` / `run_swarm_flow_task` 启动瞬间自动记录 `role: 'user'` 消息；
- **AI 回答完成**：在流式完成 (`agent_stream_done`) 瞬间自动记录 `role: 'assistant'` 消息（包含思考链 `thought` 和回复文本 `content`）；
- 每次存盘同步更新 `updated_at = Date.now()`。

### 3. 时间戳格式化防御 (`SessionTreeItem.tsx`)

```typescript
const formatTimestamp = (ts?: number) => {
  if (!ts || isNaN(ts)) return '刚刚';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return '刚刚';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '刚刚';
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **先落盘后通知**：
   务必确保数据已写入持久化存储（`localStorage` 或 SQLite/JSON）之后，再触发 `loadInitialData()`，防范 Race Condition 导致的竞态冲突；
2. **时间戳初始化防范**：
   在所有 `create_project_session` 与数据初始化方法中，必须包含 `created_at` 与 `updated_at` 双字段。
