import { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AgentEvent, Message, ModelConfig, PluginMetadata, Subtask, TaskDAG, ToolSchema } from '../types';

export function useTauriAgent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [plugins, setPlugins] = useState<PluginMetadata[]>([]);
  const [tools, setTools] = useState<ToolSchema[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [currentThinking, setCurrentThinking] = useState<string>('');
  const [sessionId] = useState<string>(() => 'session-' + Date.now());
  const workspaceDirRef = useRef<string>('.');

  const fetchPluginsAndTools = useCallback(async () => {
    try {
      const pluginList = await invoke<PluginMetadata[]>('list_plugins');
      const toolList = await invoke<ToolSchema[]>('export_tools');
      setPlugins(pluginList);
      setTools(toolList);
    } catch (e) {
      console.warn('Tauri IPC not available yet, using mock capabilities:', e);
      setPlugins([
        { id: 'plugin_fs', name: 'FileSystem Capability', version: '2.0.0', description: 'Native file I/O & patching', author: 'Tcode Team', is_builtin: true },
        { id: 'plugin_terminal', name: 'Terminal Runner', version: '2.0.0', description: 'PowerShell / Shell execution', author: 'Tcode Team', is_builtin: true },
        { id: 'plugin_search', name: 'Search & Grep', version: '2.0.0', description: 'Fast text grep', author: 'Tcode Team', is_builtin: true },
        { id: 'plugin_lsp', name: 'LSP & Diagnostics', version: '2.0.0', description: 'Language Server Protocol verification', author: 'Tcode Team', is_builtin: true },
        { id: 'mcp_github', name: 'MCP GitHub Server', version: '1.0.0', description: 'Model Context Protocol connector', author: 'External', is_builtin: false }
      ]);
    }
  }, []);

  useEffect(() => {
    fetchPluginsAndTools();

    let unlistenFn: (() => void) | undefined;
    listen<AgentEvent>('tcode_agent_event', (event) => {
      const payload = event.payload;
      if (!payload) return;

      if (payload.type === 'thought_chunk') {
        setCurrentThinking((prev) => prev + payload.payload.text);
      } else if (payload.type === 'content_chunk') {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + payload.payload.text }
            ];
          } else {
            return [
              ...prev,
              {
                id: 'msg-' + Date.now(),
                role: 'assistant',
                content: payload.payload.text,
                timestamp: Date.now()
              }
            ];
          }
        });
      } else if (payload.type === 'subtask_updated') {
        setSubtasks((prev) => {
          const idx = prev.findIndex((s) => s.id === payload.payload.subtask.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = payload.payload.subtask;
            return copy;
          }
          return [...prev, payload.payload.subtask];
        });
      } else if (payload.type === 'session_finished') {
        setIsStreaming(false);
      }
    }).then((fn) => {
      unlistenFn = fn;
    }).catch((e) => console.warn('Could not register Tauri event listener:', e));

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [fetchPluginsAndTools]);

  const sendPrompt = async (prompt: string) => {
    if (!prompt.trim() || isStreaming) return;

    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setCurrentThinking('');

    try {
      await invoke<TaskDAG>('submit_prompt', {
        sessionId,
        workspaceDir: workspaceDirRef.current,
        prompt
      });
    } catch (e: any) {
      console.error('Failed to submit prompt via Tauri IPC:', e);
      // Local fallback simulation for web preview mode
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: 'msg-' + Date.now(),
            role: 'assistant',
            content: `已接收任务：「${prompt}」。正在通过 Rust Core 双循环与五大稳定轨道执行。`,
            thinking: `[Reasoning Core]: 正在规划任务并调用能力插件...`,
            timestamp: Date.now()
          }
        ]);
        setIsStreaming(false);
      }, 500);
    }
  };

  const testGateway = async (config: ModelConfig) => {
    try {
      return await invoke<string>('test_gateway_connection', { config });
    } catch (e: any) {
      return `测试失败: ${e}`;
    }
  };

  return {
    messages,
    plugins,
    tools,
    subtasks,
    isStreaming,
    currentThinking,
    sendPrompt,
    testGateway,
    fetchPluginsAndTools
  };
}
