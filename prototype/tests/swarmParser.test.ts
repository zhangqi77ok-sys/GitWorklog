import { describe, expect, it } from 'vitest';
import { normalizeSwarmState } from '../src/components/SwarmSubagentContainer';
import { parseSwarmContent } from '../src/services/swarmLegacyParser';
import { SwarmChatState } from '../src/types/contracts';

describe('parseSwarmContent (legacy single-stream regex fallback)', () => {
  it('returns not-formatted for empty text', () => {
    const parsed = parseSwarmContent('');
    expect(parsed.isSwarmFormatted).toBe(false);
    expect(parsed.subagents).toHaveLength(0);
  });

  it('falls back to plain content when no role markers', () => {
    const text = '你好！我是 Tcode 接入的生产级 AI Agent 架构师...';
    const parsed = parseSwarmContent(text);
    expect(parsed.isSwarmFormatted).toBe(false);
    expect(parsed.masterPlanning).toBe(text);
  });

  it('parses multi-role sections with icons and master summary', () => {
    const text = [
      '【Master 全局任务拆解与分发】',
      '先做架构规划。',
      '### 📐 [Subagent · 系统架构师]',
      '> **分工职责**: 领域建模与接口契约',
      '负责领域建模与依赖分析。',
      '### 💻 [Subagent · 核心开发工程师]',
      '实现核心业务逻辑。',
      '### 🧪 [Subagent · 质量测试专家]',
      '设计红绿测试用例。',
      '### 🎯 [Master 终审交付]',
      '全流程质量仲裁通过，交付。',
    ].join('\n');
    const parsed = parseSwarmContent(text);
    expect(parsed.isSwarmFormatted).toBe(true);
    expect(parsed.subagents).toHaveLength(3);
    expect(parsed.subagents[0].icon).toBe('📐');
    expect(parsed.subagents[0].name).toContain('系统架构师');
    expect(parsed.subagents[0].duty).toBe('领域建模与接口契约');
    expect(parsed.subagents[1].icon).toBe('💻');
    expect(parsed.subagents[2].icon).toBe('🧪');
    expect(parsed.masterSummary).toContain('Master 终审交付');
  });
});

describe('normalizeSwarmState (structured concurrent roles)', () => {
  it('maps structured roles into render model', () => {
    const swarm: SwarmChatState = {
      masterPlanning: 'Master 拆解计划',
      roles: [
        { id: 'architect', name: '系统架构师', icon: '📐', content: '架构输出', status: 'passed' },
        { id: 'dev', name: '核心开发工程师', icon: '💻', content: '开发输出', status: 'running' },
      ],
      masterSummary: 'Master 终审',
    };
    const parsed = normalizeSwarmState(swarm);
    expect(parsed.isSwarmFormatted).toBe(true);
    expect(parsed.masterPlanning).toBe('Master 拆解计划');
    expect(parsed.masterSummary).toBe('Master 终审');
    expect(parsed.subagents).toHaveLength(2);
    expect(parsed.subagents[0].id).toBe('architect');
    expect(parsed.subagents[0].status).toBe('passed');
    expect(parsed.subagents[1].status).toBe('running');
  });

  it('preserves role error message', () => {
    const swarm: SwarmChatState = {
      masterPlanning: '',
      roles: [
        { id: 'qa', name: '质量测试专家', icon: '🧪', content: '', status: 'error', error: '模型超时' },
      ],
      masterSummary: '',
    };
    const parsed = normalizeSwarmState(swarm);
    expect(parsed.subagents[0].status).toBe('passed'); // 渲染模型无 error 状态，错误走 error 字段
    expect(parsed.subagents[0].error).toBe('模型超时');
  });

  it('returns not-formatted when no roles', () => {
    const parsed = normalizeSwarmState({ masterPlanning: '', roles: [], masterSummary: '' });
    expect(parsed.isSwarmFormatted).toBe(false);
  });
});
