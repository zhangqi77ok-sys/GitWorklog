import { describe, it, expect, beforeEach } from 'vitest';

// Polyfill window, crypto, localStorage for node test environment
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 1000000);
      return arr;
    },
  };
}
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

import { initTauriBridge, parseToolCallsFromText, sanitizeTextContent } from './tauriBridge';
import { invoke } from '@tauri-apps/api/core';

describe('tauriBridge Universal IPC Adapter', () => {
  beforeEach(() => {
    (globalThis as any).__TAURI_INTERNALS__ = undefined;
    (globalThis as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = undefined;
    initTauriBridge();
  });

  it('defines __TAURI_INTERNALS__ and invoke', () => {
    expect((globalThis as any).__TAURI_INTERNALS__).toBeDefined();
    expect((globalThis as any).__TAURI_INTERNALS__.invoke).toBeDefined();
  });

  it('handles list_projects_and_sessions', async () => {
    const db: any = await invoke('list_projects_and_sessions');
    expect(db).toBeDefined();
    expect(Array.isArray(db.projects)).toBe(true);
    expect(db.projects.length).toBeGreaterThan(0);
    expect(db.projects[0].name).toBe('agent-learning');
  });

  it('handles list_plugins and export_tools', async () => {
    const plugins: any = await invoke('list_plugins');
    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBe(5);

    const tools: any = await invoke('export_tools');
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(3);
  });

  it('handles add_project_folder and create_project_session', async () => {
    const newProj: any = await invoke('add_project_folder', {
      path: 'D:/workspace/test-proj',
      name: 'test-proj',
    });
    expect(newProj).toBeDefined();
    expect(newProj.name).toBe('test-proj');

    const newSess: any = await invoke('create_project_session', {
      projectId: newProj.id,
      title: '单元测试任务',
      tags: ['#测试'],
    });
    expect(newSess).toBeDefined();
    expect(newSess.title).toBe('单元测试任务');
  });

  it('handles run_swarm_flow_task smoothly', async () => {
    const decision: any = await invoke('run_swarm_flow_task', {
      prompt: '重构执行流',
      budgetTokens: 25000,
    });
    expect(decision).toBeDefined();
    expect(decision.selected_candidate.worker_id).toBe('Worker-B');
    expect(decision.confidence_score).toBe(0.96);
  });

  it('handles gateway channel test and model pulling for AgentRouter', async () => {
    const models: any = await invoke('pull_gateway_models', {
      baseUrl: 'https://agentrouter.org',
      apiKey: 'sk-test',
    });
    expect(Array.isArray(models)).toBe(true);
    expect(models).toContain('deepseek-v4-flash');

    const probe: any = await invoke('test_gateway_channel', {
      channel: {
        id: 'ch_test',
        base_url: 'https://agentrouter.org',
        api_key: 'sk-test',
        models: ['deepseek-v4-flash'],
      },
    });
    expect(probe).toBeDefined();
    expect(probe.success).toBe(true);
    expect(probe.http_status).toBe(200);
    expect(probe.latency_ms).toBeGreaterThan(0);
  });

  it('parses DSML tool calls with spaces and pipes correctly', () => {
    const rawText = `
    我来继续扫描项目的关键目录和配置文件。
    < | | DSML | | tool_calls>
    < | | DSML | | invoke name="Lookup">
    < | | DSML | | parameter name="path" string="true">src</ | | DSML | | parameter>
    </ | | DSML | | invoke>
    </ | | DSML | | tool_calls>
    `;
    const calls = parseToolCallsFromText(rawText);
    expect(calls.length).toBe(1);
    expect(calls[0].name).toBe('Lookup');
    expect(calls[0].args.path).toBe('src');

    const clean = sanitizeTextContent(rawText);
    expect(clean).toBe('我来继续扫描项目的关键目录和配置文件。');
  });

  it('handles delete_project_session and delete_project_folder correctly', async () => {
    const newProj: any = await invoke('add_project_folder', {
      path: 'D:/workspace/to-delete',
      name: 'to-delete',
    });
    const newSess: any = await invoke('create_project_session', {
      projectId: newProj.id,
      title: '即将删除的会话',
    });

    // 1. Delete session
    const delSessRes: any = await invoke('delete_project_session', { sessionId: newSess.id });
    expect(delSessRes).toBe(true);

    const dbAfterSessionDel: any = await invoke('list_projects_and_sessions');
    const projFound = dbAfterSessionDel.projects.find((p: any) => p.id === newProj.id);
    expect(projFound.sessions.find((s: any) => s.id === newSess.id)).toBeUndefined();

    // 2. Delete project
    const delProjRes: any = await invoke('delete_project_folder', { projectId: newProj.id });
    expect(delProjRes).toBe(true);

    const dbAfterProjDel: any = await invoke('list_projects_and_sessions');
    expect(dbAfterProjDel.projects.find((p: any) => p.id === newProj.id)).toBeUndefined();
  });

  it('handles cancel_chat_prompt without errors', async () => {
    const cancelRes = await invoke('cancel_chat_prompt', { sessionId: 'sess_test_cancel' });
    expect(cancelRes).toBe(true);
  });

  it('cleans up orphaned or unclosed DSML tags properly', () => {
    const brokenText = `工具输出疑似有误。我用终端命令来验证真实情况。\n</|DSML|invoke>\n</|DSML|invoke>`;
    const cleaned = sanitizeTextContent(brokenText);
    expect(cleaned).toBe('工具输出疑似有误。我用终端命令来验证真实情况。');
  });

  it('parses standard XML invoke tags without DSM prefix and sanitizes all 6 dangling invoke tags', () => {
    const standardXml = `我先读取工作区的关键文件来审查架构和逻辑。\n<invoke name="execute_command">\n<parameter name="command">dir /s /b</parameter>\n</invoke>\n</invoke>\n</invoke>\n</invoke>\n</invoke>\n</invoke>`;
    const calls = parseToolCallsFromText(standardXml);
    expect(calls.length).toBe(1);
    expect(calls[0].name).toBe('execute_command');
    expect(calls[0].args.command).toBe('dir /s /b');

    const clean = sanitizeTextContent(standardXml);
    expect(clean).toBe('我先读取工作区的关键文件来审查架构和逻辑。');
  });

  it('parses Anthropic style tool_call with JSON arguments', () => {
    const anthropicXml = `Here is the tool invocation:\n<tool_call><name>read_file</name><arguments>{"path": "vite.config.ts"}</arguments></tool_call>`;
    const calls = parseToolCallsFromText(anthropicXml);
    expect(calls.length).toBe(1);
    expect(calls[0].name).toBe('read_file');
    expect(calls[0].args.path).toBe('vite.config.ts');

    const clean = sanitizeTextContent(anthropicXml);
    expect(clean).toBe('Here is the tool invocation:');
  });
});
