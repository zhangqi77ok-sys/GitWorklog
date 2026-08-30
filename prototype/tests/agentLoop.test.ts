import { describe, expect, it } from 'vitest';
import {
  createActionResult,
  formatExecutionFeedback,
  getActionResultForId,
  parseAgentActions,
  shouldRequireActionApproval,
  parseAcceptanceCriteria,
  mergeAcceptanceCriteria,
  normalizeCriteriaKey,
  verifyTargetAcceptance,
  detectProgressStall,
  parseNativeToolCalls,
  resolveNoActionLoopStatus,
  TargetAcceptanceItem,
  ProgressVector
} from '../src/services/agentLoop';

describe('Agent Loop contract - action parsing', () => {
  it('parses only supported, closed action fences in response order with stable content-aware IDs', () => {
    const content = [
      '先创建文件，再运行验证。',
      '```write_file:src/utils/helper.ts',
      'export const answer = 42;',
      '```',
      '```typescript',
      'const example = true;',
      '```',
      '```bash',
      'npm test',
      '```',
      '```run_command',
      'git status',
      '```'
    ].join('\n');

    const actions = parseAgentActions(content);
    expect(actions.map(({ id, ...action }) => action)).toEqual([
      {
        type: 'write_file',
        target: 'src/utils/helper.ts',
        code: 'export const answer = 42;',
        isHighRisk: false,
        riskReason: undefined,
        tier: 'notify_after'
      },
      {
        type: 'run_command',
        target: 'git status',
        code: 'git status',
        isHighRisk: false,
        riskReason: undefined,
        tier: 'silent'
      }
    ]);
    expect(actions.map(action => action.id)).toEqual(parseAgentActions(content).map(action => action.id));
    expect(actions[0].id).toMatch(/^action-0-write_file-[a-z0-9]+$/);
    expect(actions[1].id).toMatch(/^action-1-run_command-[a-z0-9]+$/);

    const changedContent = content.replace('answer = 42', 'answer = 43');
    expect(parseAgentActions(changedContent)[0].id).not.toBe(actions[0].id);
  });

  it('treats ordinary shell snippets, empty fences, and unclosed fences as display-only content', () => {
    expect(parseAgentActions('```bash\nnpm test\n```')).toEqual([]);
    expect(parseAgentActions('```pwsh\nGet-ChildItem\n```')).toEqual([]);
    expect(parseAgentActions('```write_file:src/partial.ts\nexport const partial = true;')).toEqual([]);
    expect(parseAgentActions('```run_command\n```')).toEqual([]);
  });
});

describe('Agent Loop contract - permission policies & scoped trust', () => {
  const safeAction = parseAgentActions('```run_command\nnpm test\n```')[0]!;
  const safeWrite = parseAgentActions('```write_file:src/components/Card.tsx\nexport const Card = () => null;\n```')[0]!;
  const highRiskAction = parseAgentActions('```run_command\ngit push origin main\n```')[0]!;

  it('requires every action in strict approval mode, unless covered by scoped trust', () => {
    expect(shouldRequireActionApproval('strict_approval', safeAction, [], false)).toBe(true);
    expect(shouldRequireActionApproval('strict_approval', safeWrite, [{ actionType: 'write_file', pathGlob: 'src/**' }], false)).toBe(false);
  });

  it('automatically runs only low-risk actions outside strict approval', () => {
    expect(shouldRequireActionApproval('risk_adaptive', safeAction, [], false)).toBe(false);
    expect(shouldRequireActionApproval('autonomous_agent', safeAction, [], false)).toBe(false);
    expect(shouldRequireActionApproval('risk_adaptive', highRiskAction, [], false)).toBe(true);
  });

  it('never allows a session-wide choice or scoped trust to bypass high-risk review', () => {
    expect(shouldRequireActionApproval('risk_adaptive', highRiskAction, [{ actionType: '*', pathGlob: '*' }], true)).toBe(true);
    expect(shouldRequireActionApproval('autonomous_agent', highRiskAction, [], true)).toBe(true);
  });
});

describe('Agent Loop contract - execution feedback and status matching', () => {
  it('associates result status by action ID rather than code-block array index', () => {
    const actions = parseAgentActions([
      '```write_file:src/a.ts',
      'export const a = 1;',
      '```',
      '```run_command',
      'npm test',
      '```'
    ].join('\n'));
    const failedCommand = createActionResult(actions[1]!, 'failed', {
      exitCode: 1,
      error: 'one test failed'
    });
    const completedWrite = createActionResult(actions[0]!, 'success', { fileSize: 21 });
    const unorderedResults = [failedCommand, completedWrite];

    expect(getActionResultForId(actions[0]!.id, unorderedResults)).toEqual(completedWrite);
    expect(getActionResultForId(actions[1]!.id, unorderedResults)).toEqual(failedCommand);
  });

  it('formats success, failed, and rejected results into a next-turn model feedback message', () => {
    const actions = parseAgentActions([
      '```write_file:src/a.ts',
      'export const a = 1;',
      '```',
      '```run_command',
      'npm test',
      '```',
      '```run_command',
      'git push origin main',
      '```'
    ].join('\n'));
    const feedback = formatExecutionFeedback(actions, [
      createActionResult(actions[0]!, 'success', { fileSize: 21 }),
      createActionResult(actions[1]!, 'failed', { exitCode: 1, error: 'one test failed' }),
      createActionResult(actions[2]!, 'rejected')
    ]);

    expect(feedback).toContain('[Tcode Agent 执行引擎与独立验证器反馈]');
    expect(feedback).toContain('✅ write_file:src/a.ts — 写入成功 (21 字节)');
    expect(feedback).toContain('❌ run_command: npm test — 执行失败 (Exit Code: 1)');
    expect(feedback).toContain('🚫 run_command: git push origin main — 用户拒绝执行');
  });
});

describe('Target-driven Agent Loop - Acceptance criteria & Verifier', () => {
  it('parses target acceptance criteria from markdown goal breakdown', () => {
    const markdown = [
      '目标拆解如下：',
      '□ 登录成功路径正常',
      '✓ 密码加密处理正确',
      '✕ 未登录拦截存在漏洞',
      '- [ ] 补充自动化测试'
    ].join('\n');

    const items = parseAcceptanceCriteria(markdown);
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ id: 'crit-1', description: '登录成功路径正常', status: 'pending' });
    expect(items[1]).toEqual({ id: 'crit-2', description: '密码加密处理正确', status: 'passed' });
    expect(items[2]).toEqual({ id: 'crit-3', description: '未登录拦截存在漏洞', status: 'failed' });
    expect(items[3]).toEqual({ id: 'crit-4', description: '补充自动化测试', status: 'pending' });
  });

  it('verifier marks loop as completed only when all acceptance items are passed with real evidence', () => {
    const items: TargetAcceptanceItem[] = [
      { id: 'c1', description: '修改 src/auth.ts', status: 'pending' },
      { id: 'c2', description: '单元测试通过', status: 'pending' }
    ];

    const actions = parseAgentActions([
      '```write_file:src/auth.ts',
      'export const auth = true;',
      '```',
      '```run_command',
      'npm test',
      '```'
    ].join('\n'));

    const results = [
      createActionResult(actions[0]!, 'success', { fileSize: 25 }),
      createActionResult(actions[1]!, 'success', { exitCode: 0, output: '2 passed' })
    ];

    const verifierResult = verifyTargetAcceptance(items, actions, results, []);
    expect(verifierResult.status).toBe('completed');
    expect(verifierResult.summary).toContain('2/2 项验收通过 · 测试通过');
    expect(verifierResult.items.every(i => i.status === 'passed')).toBe(true);
  });

  it('detects progress stall when agent repeats identical actions with no new passed items', () => {
    const stallHistory: ProgressVector[] = [
      { stepIndex: 1, phase: 'act', actionFingerprints: ['write_file:src/a.ts'], passedCount: 1, failedCount: 1 },
      { stepIndex: 2, phase: 'act', actionFingerprints: ['write_file:src/a.ts'], passedCount: 1, failedCount: 1 },
      { stepIndex: 3, phase: 'act', actionFingerprints: ['write_file:src/a.ts'], passedCount: 1, failedCount: 1 }
    ];

    expect(detectProgressStall(stallHistory)).toBe(true);

    const items: TargetAcceptanceItem[] = [
      { id: 'c1', description: '修复死循环', status: 'failed' }
    ];
    const actions = parseAgentActions('```write_file:src/a.ts\nconst a = 1;\n```');
    const results = [createActionResult(actions[0]!, 'success')];

    const result = verifyTargetAcceptance(items, actions, results, stallHistory);
    expect(result.status).toBe('no_progress');
    expect(result.suggestedActions).toHaveLength(3);
    expect(result.suggestedActions![0].label).toContain('换一种架构方案');
  });

  it('mergeAcceptanceCriteria cleanly deduplicates across multiple LLM rounds and preserves evidence', () => {
    const round1: TargetAcceptanceItem[] = [
      { id: 'crit-1', description: '1. 识别工程结构', status: 'passed' },
      { id: 'crit-2', description: '2. 安装 SDD / TDD Skill', status: 'pending' },
      { id: 'crit-3', description: '3. 运行单元测试通过', status: 'pending' }
    ];

    // Model repeats checklist on round 2 with slight wording differences and updated status
    const round2: TargetAcceptanceItem[] = [
      { id: 'crit-1', description: '识别工程结构', status: 'passed' },
      { id: 'crit-2', description: '安装 SDD / TDD Skill', status: 'passed' },
      { id: 'crit-3', description: '单元测试与类型检查通过', status: 'pending' }
    ];

    const merged = mergeAcceptanceCriteria(round1, round2);
    // Should NOT duplicate items to 6; must remain 3 deduplicated items
    expect(merged).toHaveLength(3);
    expect(merged[0].status).toBe('passed');
    expect(merged[1].status).toBe('passed');
    expect(merged[2].status).toBe('pending');
  });
});



describe('Agent Loop contract - native tools and honest termination', () => {
  it('converts complete native tool calls into the same AgentAction shape as fenced actions', () => {
    const actions = parseNativeToolCalls([
      { id: 'call-1', name: 'run_command', arguments: '{"command":"npm test"}' }
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'run_command', code: 'npm test', target: 'npm test' });
  });

  it('joins streamed native argument fragments before parsing the action', () => {
    const actions = parseNativeToolCalls([
      { id: 'call-1', name: 'write_file', arguments: '{"path":"src/a.ts","con' },
      { id: 'call-1', name: 'write_file', arguments: 'tent":"export const a = 1;"}' }
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'write_file', target: 'src/a.ts', code: 'export const a = 1;' });
  });

  it('does not classify an explicit-criteria no-action response as completed', () => {
    expect(resolveNoActionLoopStatus('running', true)).toBe('needs_decision');
    expect(resolveNoActionLoopStatus('completed', true)).toBe('completed');
  });
});
