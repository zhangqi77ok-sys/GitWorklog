# 05 - 桌面端 WebView2 与 Tauri IPC 双轨兼容适配网桥设计

> **归档编号**：KNOW-05  
> **关联规范**：`AGENTS.md`【铁律 6】、`AGENTS.md`【铁律 1.5】  
> **核心领域**：桌面端架构 / Tauri IPC 协议 / WebView2 混合运行时

---

## ① 知识点与问题背景 (Context & Problem Statement)

在本项目由前端 React + Tauri 2.0 架构升级演进的过程中，前端全量代码库（如 `LeftPanel.tsx`、`ChatPanel.tsx`、`useProjectSessionStore.ts`、`useWorkspaceStore.ts` 等）均重构为调用 Tauri 官方接口：
```typescript
import { invoke } from '@tauri-apps/api/core';
const selectedPath = await invoke<string | null>('select_folder_dialog');
```
在 Windows 本地使用轻量化安装向导或 WebView2 运行时启动应用时，用户点击**“打开本地项目文件夹”**，前端界面立即抛出多条红线 Toast 报错：
```text
打开文件夹失败: TypeError: Cannot read properties of undefined (reading 'invoke')
```
- **影响范围**：项目挂载、会话加载、工作区文件树扫描、模型调用全部受阻，界面处于未初始化状态。

---

## ② 核心原理与根本原因剖析 (Knowledge Content & Root Cause)

### 1. `@tauri-apps/api/core` 的底层物理调用契约
查看 `@tauri-apps/api/core.js` 源代码实现（第 202 行）：
```javascript
async function invoke(cmd, args = {}, options) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
}
```
- 在原生 Tauri 运行环境中，Tauri 容器在 Webview 启动前向全局注入 `window.__TAURI_INTERNALS__` 与 `window.__TAURI_EVENT_PLUGIN_INTERNALS__`；
- 当应用以独立 WebView2 宿主（如 `pywebview` 引擎）或浏览器调试模式运行时，该宿主对象完全不存在，导致读取 `.invoke` 属性直接触发 JavaScript `TypeError`。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 构建轻量级 Universal IPC Bridge (`src/services/tauriBridge.ts`)
基于 Tauri 官方提供的 `@tauri-apps/api/mocks` 规范，实现自动环境嗅探与全功能命令映射：

```typescript
import { mockIPC } from '@tauri-apps/api/mocks';
import { emit } from '@tauri-apps/api/event';

export function initTauriBridge(): void {
  if (typeof window === 'undefined') return;

  // 1. 若检测到原生 Tauri 2.0 运行容器已存在，保持原生 IPC，绝不干预
  if ((window as any).__TAURI_INTERNALS__?.invoke) {
    return;
  }

  // 2. 在 WebView2 / 浏览器环境，挂载通用适配网桥
  mockIPC(async (cmd: string, args: any) => {
    switch (cmd) {
      // 映射原生 Windows 文件夹拾取器
      case 'select_folder_dialog': {
        try {
          const res = await fetch('/api/fs/pick_folder', { headers: getApiHeaders() });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.path) return data.path;
            if (data.cancelled) return null;
          }
        } catch (e) {}

        if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
          try {
            const dirHandle = await (window as any).showDirectoryPicker();
            return dirHandle.name || 'local-folder';
          } catch (e: any) {
            if (e.name === 'AbortError') return null;
          }
        }

        const promptPath = window.prompt('请输入本地项目绝对路径:');
        return promptPath && promptPath.trim() ? promptPath.trim() : null;
      }

      // 映射项目与会话持久化
      case 'list_projects_and_sessions':
        return loadProjectsDb();

      case 'add_project_folder':
        return handleAddProjectFolder(args);

      // 映射工作区目录树与文件读写
      case 'read_workspace_tree':
        return handleReadWorkspaceTree(args?.path);

      case 'read_file_content':
        return handleReadFileContent(args?.path);

      case 'save_file_content':
        return handleSaveFileContent(args?.path, args?.content);

      // 映射单智能体流式对话与 SwarmFlow 算子流
      case 'stream_chat_prompt':
        return handleStreamChatPrompt(args);

      case 'run_swarm_flow_task':
        return handleRunSwarmFlowTask(args);

      default:
        console.warn(`[TauriBridge] Unhandled IPC command: ${cmd}`);
        return null;
    }
  }, { shouldMockEvents: true });
}
```

### 2. 在应用启动主入口置顶挂载 (`src/main.tsx`)
在 ReactDOM 挂载组件树之前立即调用：
```typescript
import { initTauriBridge } from './services/tauriBridge';

// 启动前置顶初始化通用 IPC 适配网桥
initTauriBridge();
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **环境优先探测原则 (Fail-Native-First)**：
   必须严格执行 `if ((window as any).__TAURI_INTERNALS__?.invoke) return;`，防止在真实的 Tauri 2.0 容器中覆盖掉 Rust 原生高效 IPC。
2. **凭据安全透传**：
   在向本地后端 `/api/fs/` 请求时，必须提取并携带 `X-Tcode-Token` 认证头，确保宿主沙箱安全。
3. **数据一致性持久化**：
   项目与会话列表通过 `localStorage` 配合本地宿主存储实现双重容灾，保证用户选择的项目在下次打开时自动恢复。
