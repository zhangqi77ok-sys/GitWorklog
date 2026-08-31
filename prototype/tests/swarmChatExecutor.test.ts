import { describe, expect, it } from 'vitest';
import {
  runSwarmChat,
  SWARM_ROLES,
  StreamChatFn,
  SwarmChatInput,
} from '../src/services/swarmChatExecutor';

const ROLE_NAMES = ['系统架构师', '核心开发工程师', '质量测试专家', '代码审计与安全员'];

function makeInput(overrides: Partial<SwarmChatInput> = {}): SwarmChatInput {
  return {
    userGoal: '重构权限模型并补齐测试',
    contextSnapshotMarkdown: '工程: agent-learning, 分支: main',
    modelId: 'gpt-5.2',
    signal: undefined,
    streamChat: () => Promise.resolve(''),
    ...overrides,
  };
}

function emptyCallbacks() {
  return {
    onMasterPlanning: () => {},
    onRoleStatus: () => {},
    onRoleDelta: () => {},
    onMasterSummary: () => {},
  };
}

describe('SWARM_ROLES catalog', () => {
  it('has exactly 4 fixed roles with unique ids', () => {
    expect(SWARM_ROLES).toHaveLength(4);
    const ids = new Set(SWARM_ROLES.map(r => r.id));
    expect(ids.size).toBe(4);
    expect(SWARM_ROLES.map(r => r.id)).toEqual(['architect', 'dev', 'qa', 'security']);
  });
});

describe('runSwarmChat happy path', () => {
  it('produces planning -> concurrent roles -> master summary', async () => {
    const events: string[] = [];
    const streamChat: StreamChatFn = (req) => {
      if (req.system.includes('Swarm Master') && req.user.includes('作为 Master 拆解')) {
        return Promise.resolve('【规划】拆解完成');
      }
      if (req.user.includes('各 Subagent 产出')) {
        return Promise.resolve('【终审】交付总结');
      }
      const role = SWARM_ROLES.find(r => req.system.includes(r.name))!;
      return Promise.resolve(`<${role.name}-output>`);
    };
    const input = makeInput({ streamChat });
    const callbacks = {
      ...emptyCallbacks(),
      onMasterPlanning: (planning: string) => events.push(`planning:${planning}`),
      onRoleStatus: (roleId: string, status: string) => events.push(`role:${roleId}:${status}`),
      onMasterSummary: (summary: string) => events.push(`summary:${summary}`),
    };
    const state = await runSwarmChat(input, callbacks);

    expect(state.masterPlanning).toBe('【规划】拆解完成');
    expect(state.masterSummary).toBe('【终审】交付总结');
    expect(state.roles).toHaveLength(4);
    expect(state.roles.every(r => r.status === 'passed')).toBe(true);
    expect(state.roles.map(r => r.content)).toEqual(
      SWARM_ROLES.map(r => `<${r.name}-output>`),
    );
    // 顺序: planning -> 4 角色 -> summary
    expect(events[0]).toBe('planning:【规划】拆解完成');
    expect(events[1]).toBe('role:architect:passed');
    expect(events[4]).toBe('role:security:passed');
    expect(events[5]).toBe('summary:【终审】交付总结');
  });

  it('streams role deltas into role content', async () => {
    const deltas: string[] = [];
    const streamChat: StreamChatFn = (req) => {
      if (req.user.includes('作为 Master 拆解')) return Promise.resolve('p');
      if (req.user.includes('各 Subagent 产出')) return Promise.resolve('s');
      req.onDelta('第一段');
      req.onDelta('第二段');
      return Promise.resolve('第一段第二段');
    };
    const input = makeInput({ streamChat });
    const callbacks = {
      ...emptyCallbacks(),
      onRoleDelta: (roleId: string, delta: string) => {
        if (roleId === 'architect') deltas.push(delta);
      },
    };
    const state = await runSwarmChat(input, callbacks);
    expect(deltas).toEqual(['第一段', '第二段']);
    expect(state.roles.find(r => r.id === 'architect')!.content).toBe('第一段第二段');
  });
});

describe('runSwarmChat concurrency & failure isolation', () => {
  it('starts all four roles before any resolves', async () => {
    const started: string[] = [];
    const roleResolvers: Record<string, (v: string) => void> = {};
    let resolveSummary: (v: string) => void = () => {};
    let summaryStarted = false;

    const streamChat: StreamChatFn = (req) => {
      if (req.user.includes('作为 Master 拆解')) return Promise.resolve('p');
      if (req.user.includes('各 Subagent 产出')) {
        summaryStarted = true;
        return new Promise(res => { resolveSummary = res; });
      }
      const name = SWARM_ROLES.find(r => req.system.includes(r.name))!.name;
      started.push(name);
      return new Promise(res => { roleResolvers[name] = res; });
    };
    const runPromise = runSwarmChat(makeInput({ streamChat }), emptyCallbacks());

    // 等待 planning 微任务完成，触发 allSettled（4 个角色同步启动）
    await new Promise(r => setTimeout(r, 0));
    expect(started).toEqual(ROLE_NAMES);
    expect(summaryStarted).toBe(false); // 终审必须等角色全部结束

    Object.values(roleResolvers).forEach(r => r('out'));
    await new Promise(r => setTimeout(r, 0));
    expect(summaryStarted).toBe(true);
    resolveSummary('s');
    const state = await runPromise;
    expect(state.roles.every(r => r.status === 'passed')).toBe(true);
  });

  it('isolates a failing role and still produces master summary', async () => {
    const streamChat: StreamChatFn = (req) => {
      if (req.user.includes('作为 Master 拆解')) return Promise.resolve('p');
      if (req.user.includes('各 Subagent 产出')) return Promise.resolve('s');
      if (req.system.includes('质量测试专家')) return Promise.reject(new Error('模型超时'));
      return Promise.resolve('ok');
    };
    const statuses: string[] = [];
    const input = makeInput({ streamChat });
    const callbacks = {
      ...emptyCallbacks(),
      onRoleStatus: (roleId: string, status: string, error?: string) => {
        if (roleId === 'qa') statuses.push(`${status}:${error || ''}`);
      },
    };
    const state = await runSwarmChat(input, callbacks);
    const qa = state.roles.find(r => r.id === 'qa')!;
    expect(qa.status).toBe('error');
    expect(qa.error).toBe('模型超时');
    expect(state.roles.filter(r => r.id !== 'qa').every(r => r.status === 'passed')).toBe(true);
    expect(state.masterSummary).toBe('s');
    expect(statuses).toEqual(['error:模型超时']);
  });
});

describe('runSwarmChat abort propagation', () => {
  it('passes the same AbortSignal to every call', async () => {
    const signal = new AbortController().signal;
    const seen: (AbortSignal | undefined)[] = [];
    const streamChat: StreamChatFn = (req) => {
      seen.push(req.signal);
      if (req.user.includes('作为 Master 拆解')) return Promise.resolve('p');
      if (req.user.includes('各 Subagent 产出')) return Promise.resolve('s');
      return Promise.resolve('ok');
    };
    await runSwarmChat(makeInput({ streamChat, signal }), emptyCallbacks());
    expect(seen).toHaveLength(6); // planning + 4 roles + summary
    expect(seen.every(s => s === signal)).toBe(true);
  });
});
