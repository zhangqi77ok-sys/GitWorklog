import { describe, expect, it } from 'vitest';
import {
  createActionResult,
  formatExecutionFeedback,
  getActionResultForId,
  parseAgentActions,
  shouldRequireActionApproval
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
        isHighRisk: false
      },
      {
        type: 'run_command',
        target: 'git status',
        code: 'git status',
        isHighRisk: false
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

describe('Agent Loop contract - permission policies', () => {
  const safeAction = parseAgentActions('```run_command\nnpm test\n```')[0]!;
  const highRiskAction = parseAgentActions('```run_command\ngit push origin main\n```')[0]!;

  it('requires every action in strict approval mode, including after a session-level allowance', () => {
    expect(shouldRequireActionApproval('strict_approval', safeAction, false)).toBe(true);
    expect(shouldRequireActionApproval('strict_approval', safeAction, true)).toBe(true);
  });

  it('automatically runs only low-risk actions outside strict approval', () => {
    expect(shouldRequireActionApproval('risk_adaptive', safeAction, false)).toBe(false);
    expect(shouldRequireActionApproval('autonomous_agent', safeAction, false)).toBe(false);
    expect(shouldRequireActionApproval('risk_adaptive', highRiskAction, false)).toBe(true);
  });

  it('never allows a session-wide choice to bypass high-risk review', () => {
    expect(shouldRequireActionApproval('risk_adaptive', highRiskAction, true)).toBe(true);
    expect(shouldRequireActionApproval('autonomous_agent', highRiskAction, true)).toBe(true);
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

    expect(feedback).toContain('[Tcode Agent 执行引擎反馈]');
    expect(feedback).toContain('✅ write_file:src/a.ts — 写入成功 (21 字节)');
    expect(feedback).toContain('❌ run_command: npm test — 执行失败 (Exit Code: 1)');
    expect(feedback).toContain('🚫 run_command: git push origin main — 用户拒绝执行');
  });
});
