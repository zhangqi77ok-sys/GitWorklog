import { describe, expect, it } from 'vitest';
import {
  runSwarmChat,
  SWARM_ROLE_CATALOG,
  SwarmChatInput,
  SwarmChatCallbacks,
} from '../src/services/swarmChatExecutor';
import type { StreamChatFn } from '../src/services/swarmGatewayStream';

const CATALOG_IDS = ['architect', 'dev', 'tester', 'security', 'frontend', 'backend', 'dba', 'docs'];

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

function emptyCallbacks(): SwarmChatCallbacks {
  return {
    onMasterPlanning: () => {},
    onRolesSelected: () => {},
    onRoleStatus: () => {},
    onRoleDelta: () => {},
    onMasterSummary: () => {},
  };
}

/** 构造拆解 mock：Phase1 返回 JSON，按 system prompt 区分角色调用。 */
function mockStream(roles: string[], overrides: { failRole?: string; error?: Error } = {}): StreamChatFn {
  return (req) => {
    if (req.user.includes('【可选角色目录】')) {
      return Promise.resolve(JSON.stringify({ planning: '【规划】先架构后实现', roles }));
    }
    if (req.user.includes('各 Subagent 产出')) {
      return Promise.resolve('【终审】交付总结');
    }
    const role = SWARM_ROLE_CATALOG.find(r => req.system.includes(r.name))!;
    if (overrides.failRole && role.id === overrides.failRole) {
      return Promise.reject(overrides.error || new Error('模型超时'));
    }
    return Promise.resolve(`<${role.id}-out>`);
  };
}

describe('SWARM_ROLE_CATALOG', () => {
  it('contains 8 roles with unique ids', () => {
    expect(SWARM_ROLE_CATALOG).toHaveLength(8);
    const ids = new Set(SWARM_ROLE_CATALOG.map(r => r.id));
    expect(ids.size).toBe(8);
    expect(SWARM_ROLE_CATALOG.map(r => r.id)).toEqual(CATALOG_IDS);
  });
});

describe('runSwarmChat dynamic role selection', () => {
  it('only executes roles selected by master decomposition', async () => {
    const invoked: string[] = [];
    const base = mockStream(['architect', 'dev']);
    const streamChat: StreamChatFn = (req) => {
      if (req.user.includes('【可选角色目录】')) return base(req);
      if (req.user.includes('各 Subagent 产出')) return base(req);
      const role = SWARM_ROLE_CATALOG.find(r => req.system.includes(r.name))!;
      invoked.push(role.id);
      return base(req);
    };
    const events: string[] = [];
    const callbacks = {
      ...emptyCallbacks(),
      onMasterPlanning: (p: string) => events.push(`planning:${p}`),
      onRolesSelected: (roles: unknown[]) => events.push(`roles:${(roles as { id: string }[]).map(r => r.id).join(',')}`),
      onRoleStatus: (id: string, s: string) => events.push(`role:${id}:${s}`),
      onMasterSummary: (s: string) => events.push(`summary:${s}`),
    };
    const state = await runSwarmChat(makeInput({ streamChat }), callbacks);

    expect(invoked).toEqual(['architect', 'dev']); // 只执行选中的 2 个
    expect(state.roles).toHaveLength(2);
    expect(state.roles.map(r => r.id)).toEqual(['architect', 'dev']);
    expect(state.roles.every(r => r.status === 'passed')).toBe(true);
    expect(state.masterPlanning).toBe('【规划】先架构后实现');
    expect(state.masterSummary).toBe('【终审】交付总结');
    // 顺序: planning -> rolesSelected -> 角色状态 -> summary
    expect(events[0]).toBe('planning:【规划】先架构后实现');
    expect(events[1]).toBe('roles:architect,dev');
    expect(events[2]).toBe('role:architect:passed');
    expect(events[3]).toBe('role:dev:passed');
    expect(events[4]).toBe('summary:【终审】交付总结');
  });

  it('runs up to 4 selected roles concurrently', async () => {
    const started: string[] = [];
    const roleResolvers: Record<string, (v: string) => void> = {};
    let resolveSummary: (v: string) => void = () => {};
    let summaryStarted = false;
    const streamChat: StreamChatFn = (req) => {
      if (req.user.includes('【可选角色目录】')) {
        return Promise.resolve(JSON.stringify({ planning: 'p', roles: ['architect', 'dev', 'tester', 'security'] }));
      }
      if (req.user.includes('各 Subagent 产出')) {
        summaryStarted = true;
        return new Promise(res => { resolveSummary = res; });
      }
      const role = SWARM_ROLE_CATALOG.find(r => req.system.includes(r.name))!;
      started.push(role.id);
      return new Promise(res => { roleResolvers[role.id] = res; });
    };
    const runPromise = runSwarmChat(makeInput({ streamChat }), emptyCallbacks());
    await new Promise(r => setTimeout(r, 0));
    expect(started).toEqual(['architect', 'dev', 'tester', 'security']);
    expect(summaryStarted).toBe(false);
    Object.values(roleResolvers).forEach(r => r('out'));
    await new Promise(r => setTimeout(r, 0));
    expect(summaryStarted).toBe(true);
    resolveSummary('s');
    const state = await runPromise;
    expect(state.roles.every(r => r.status === 'passed')).toBe(true);
  });

  it('isolates a failing selected role and still produces master summary', async () => {
    const streamChat = mockStream(['architect', 'dev', 'tester'], { failRole: 'tester', error: new Error('模型超时') });
    const statuses: string[] = [];
    const callbacks = {
      ...emptyCallbacks(),
      onRoleStatus: (id: string, s: string, err?: string) => {
        if (id === 'tester') statuses.push(`${s}:${err || ''}`);
      },
    };
    const state = await runSwarmChat(makeInput({ streamChat }), callbacks);
    const tester = state.roles.find(r => r.id === 'tester')!;
    expect(tester.status).toBe('error');
    expect(tester.error).toBe('模型超时');
    expect(state.roles.filter(r => r.id !== 'tester').every(r => r.status === 'passed')).toBe(true);
    expect(state.masterSummary).toBe('【终审】交付总结');
    expect(statuses).toEqual(['error:模型超时']);
  });
});

describe('runSwarmChat decomposition failure (fail-closed)', () => {
  it('throws when decomposition is not valid JSON', async () => {
    const streamChat: StreamChatFn = (req) => {
      if (req.user.includes('【可选角色目录】')) return Promise.resolve('不是 JSON 的文本');
      return Promise.resolve('ok');
    };
    await expect(runSwarmChat(makeInput({ streamChat }), emptyCallbacks())).rejects.toThrow('Master 拆解');
  });

  it('throws when decomposition contains unknown role id', async () => {
    const streamChat = mockStream(['architect', 'ghost-role']);
    await expect(runSwarmChat(makeInput({ streamChat }), emptyCallbacks())).rejects.toThrow('未知角色');
  });

  it('throws when fewer than 2 roles selected', async () => {
    const streamChat = mockStream(['architect']);
    await expect(runSwarmChat(makeInput({ streamChat }), emptyCallbacks())).rejects.toThrow('2~4');
  });

  it('throws when more than 4 roles selected', async () => {
    const streamChat = mockStream(['architect', 'dev', 'tester', 'security', 'frontend']);
    await expect(runSwarmChat(makeInput({ streamChat }), emptyCallbacks())).rejects.toThrow('2~4');
  });
});

describe('runSwarmChat abort propagation', () => {
  it('passes the same AbortSignal to every call', async () => {
    const signal = new AbortController().signal;
    const seen: (AbortSignal | undefined)[] = [];
    const base = mockStream(['architect', 'dev']);
    const streamChat: StreamChatFn = (req) => {
      seen.push(req.signal);
      return base(req);
    };
    await runSwarmChat(makeInput({ streamChat, signal }), emptyCallbacks());
    expect(seen).toHaveLength(4); // 拆解 + 2 角色 + 终审
    expect(seen.every(s => s === signal)).toBe(true);
  });
});
