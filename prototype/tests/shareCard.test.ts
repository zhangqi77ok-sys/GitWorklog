import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../src/types/contracts';
import { extractShareableContent, stripThinkingProcess } from '../src/components/ShareCardModal';

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

describe('extractShareableContent', () => {
  it('returns message.content for regular messages', () => {
    expect(extractShareableContent(msg({ content: '普通回复内容' }))).toBe('普通回复内容');
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
    const out = extractShareableContent(m);
    expect(out).toContain('【Master 拆解】');
    expect(out).toContain('先做架构设计');
    expect(out).toContain('### 📐 [系统架构师]');
    expect(out).toContain('接口契约定义');
    expect(out).toContain('### 🧪 [质量测试专家]（失败）');
    expect(out).toContain('测试用例设计');
    expect(out).toContain('【Master 终审】');
    expect(out).toContain('整体交付总结');
  });

  it('prefers message.content when both content and swarm exist', () => {
    const m = msg({
      content: '正文内容',
      swarm: { phase: 'done', masterPlanning: 'p', roles: [], masterSummary: 's' },
    });
    expect(extractShareableContent(m)).toBe('正文内容');
  });

  it('returns empty string when nothing available', () => {
    expect(extractShareableContent(msg({}))).toBe('');
  });
});
