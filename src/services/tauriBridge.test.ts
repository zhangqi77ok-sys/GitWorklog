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

import { initTauriBridge } from './tauriBridge';
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
});
