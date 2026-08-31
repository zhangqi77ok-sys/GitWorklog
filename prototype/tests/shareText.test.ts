import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../src/types/contracts';
import {
  buildCleanConversationText,
  buildCleanRoundsText,
  stripAgentActionBlocks,
  stripThinkingProcess,
} from '../src/services/shareText';

function msg(partial: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    ...partial,
  };
}

describe('stripThinkingProcess', () => {
  it('strips think blocks and reasoning markers', () => {
    const raw = '<think>内部推演过程</think>\n最终答案';
    expect(stripThinkingProcess(raw)).toBe('最终答案');
  });

  it('keeps plain content intact', () => {
    expect(stripThinkingProcess('普通文本')).toBe('普通文本');
  });
});

describe('stripAgentActionBlocks', () => {
  it('strips write_file and run_command fences but keeps analysis text', () => {
    const raw = [
      '先分析接口契约。',
      '```write_file:src/api.ts',
      'export const x = 1;',
      '```',
      '```run_command',
      'npm test',
      '```',
      '验证已通过。',
    ].join('\n');
    const out = stripAgentActionBlocks(raw);
    expect(out).toContain('先分析接口契约。');
    expect(out).toContain('验证已通过。');
    expect(out).not.toContain('write_file');
    expect(out).not.toContain('export const x = 1;');
    expect(out).not.toContain('run_command');
    expect(out).not.toContain('npm test');
  });
});

describe('buildCleanConversationText', () => {
  it('strips tool blocks for agent loop messages', () => {
    const m = msg({
      content: '分析完成。\n```write_file:a.ts\ncode\n```\n下一步验证。',
    });
    const out = buildCleanConversationText(m);
    expect(out).toContain('分析完成。');
    expect(out).toContain('下一步验证。');
    expect(out).not.toContain('write_file');
    expect(out).not.toContain('code');
  });

  it('composes swarm roles/summary when content is empty', () => {
    const m = msg({
      auditTag: '🐝 Swarm 团队协同 (多角色并发)',
      swarm: {
        phase: 'done',
        masterPlanning: '先做架构设计',
        roles: [
          { id: 'architect', name: '系统架构师', icon: '📐', content: '接口契约定义', status: 'passed' },
          { id: 'tester', name: '质量测试专家', icon: '🧪', content: '测试用例设计', status: 'error', error: '模型超时' },
        ],
        masterSummary: '整体交付总结',
      },
    });
    const out = buildCleanConversationText(m);
    expect(out).toContain('【Master 拆解】');
    expect(out).toContain('先做架构设计');
    expect(out).toContain('### 📐 [系统架构师]');
    expect(out).toContain('接口契约定义');
    expect(out).toContain('### 🧪 [质量测试专家]（失败）');
    expect(out).toContain('【Master 终审】');
    expect(out).toContain('整体交付总结');
  });

  it('prefers message.content when both content and swarm exist', () => {
    const m = msg({
      content: '正文内容',
      swarm: { phase: 'done', masterPlanning: 'p', roles: [], masterSummary: 's' },
    });
    expect(buildCleanConversationText(m)).toBe('正文内容');
  });

  it('returns empty string when nothing available', () => {
    expect(buildCleanConversationText(msg({}))).toBe('');
  });
});

describe('buildCleanRoundsText', () => {
  it('uses dynamic round titles and cleaned content', () => {
    const m = msg({
      rounds: [
        { roundId: 1, title: '💬 分析与回答', status: 'passed', phase: 'inspect', content: '分析\n```write_file:a.ts\ncode\n```', timestamp: 1 },
      ],
    });
    const out = buildCleanRoundsText(m);
    expect(out).toContain('[第 1 轮] 💬 分析与回答');
    expect(out).toContain('分析');
    expect(out).not.toContain('write_file');
    expect(out).not.toContain('code');
  });

  it('falls back to conversation text when no rounds', () => {
    expect(buildCleanRoundsText(msg({ content: '直接内容' }))).toBe('直接内容');
  });
});
