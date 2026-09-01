import { describe, it, expect } from 'vitest';
import { classifyUserIntent, buildDynamicSystemPrompt } from '../src/services/intentClassifier';

describe('User Intent Classifier & Dynamic Prompt Resolver', () => {
  it('should correctly classify greetings', () => {
    expect(classifyUserIntent('你好').type).toBe('greeting');
    expect(classifyUserIntent('hi').type).toBe('greeting');
    expect(classifyUserIntent('在吗').type).toBe('greeting');
    expect(classifyUserIntent('早上好！').type).toBe('greeting');
  });

  it('should correctly classify questions and discussions as chat_qa', () => {
    expect(classifyUserIntent('为什么我觉得agent loop老是答非所问呢').type).toBe('chat_qa');
    expect(classifyUserIntent('什么是 KV Cache？有什么作用？').type).toBe('chat_qa');
    expect(classifyUserIntent('解释一下这个组件的入参是什么意思').type).toBe('chat_qa');
    expect(classifyUserIntent('怎么理解两阶段提交 (2PC) 机制？').type).toBe('chat_qa');
  });

  it('should correctly classify code modification, reading, and execution tasks', () => {
    expect(classifyUserIntent('你直接读取new api的内容').type).toBe('task_execution');
    expect(classifyUserIntent('查看一下 src 目录下的文件结构').type).toBe('task_execution');
    expect(classifyUserIntent('修改 App.tsx 修复弹窗 bug').type).toBe('task_execution');
    expect(classifyUserIntent('创建一个新的 UserCard 组件并导出').type).toBe('task_execution');
    expect(classifyUserIntent('运行 npm test 跑一下全部测试').type).toBe('task_execution');
    expect(classifyUserIntent('重构 agentLoop.ts 消除坏味道').type).toBe('task_execution');
  });

  it('should generate concise prompt for greetings without clutter', () => {
    const intent = classifyUserIntent('你好');
    const prompt = buildDynamicSystemPrompt({
      intent,
      workMode: 'act',
      executionMode: 'act'
    });
    expect(prompt).toContain('打招呼');
    expect(prompt).toContain('友好、简短、自然地回应');
    expect(prompt).not.toContain('write_file');
    expect(prompt).not.toContain('Acceptance Criteria');
  });

  it('should generate direct QA prompt for questions focusing on direct answering', () => {
    const intent = classifyUserIntent('为什么我觉得agent loop老是答非所问呢', 'swarm');
    const prompt = buildDynamicSystemPrompt({
      intent,
      projectName: 'my-app',
      projectPath: '/path/to/my-app',
      workMode: 'act',
      executionMode: 'act'
    });
    expect(prompt).toContain('直接回答');
    expect(prompt).toContain('按需探索');
    expect(prompt).not.toContain('验收标准清单');
  });

  it('should generate action-oriented prompt for task execution', () => {
    const intent = classifyUserIntent('修改 App.tsx 修复 bug');
    const prompt = buildDynamicSystemPrompt({
      intent,
      projectName: 'my-app',
      projectPath: '/path/to/my-app',
      workMode: 'act',
      executionMode: 'act'
    });
    expect(prompt).toContain('write_file');
    expect(prompt).toContain('run_command');
    expect(prompt).toContain('真实证据闭环');
  });
});
