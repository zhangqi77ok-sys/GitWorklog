import { describe, expect, it } from 'vitest';
import {
  buildInlineEditPrompt,
  computeLineDiff,
  cleanInlineEditOutput
} from '../src/services/inlineEditService';

describe('Inline Edit Engine (Cmd+K / Ctrl+K)', () => {
  it('builds a strict selection-level prompt with surrounding context', () => {
    const { systemPrompt, userPrompt } = buildInlineEditPrompt({
      filePath: 'src/contracts.ts',
      language: 'typescript',
      selectedText: 'export interface User {\n  id: string;\n}',
      startLine: 10,
      endLine: 12,
      prefixContext: '// Header comments',
      suffixContext: '// Footer functions',
      userInstruction: '添加 email 与 phone 属性'
    });

    expect(systemPrompt).toContain('高精度的代码内联编辑与重构引擎');
    expect(systemPrompt).toContain('严禁输出任何 Markdown 格式外框');
    expect(systemPrompt).toContain('src/contracts.ts');
    expect(userPrompt).toContain('第 10 - 12 行');
    expect(userPrompt).toContain('添加 email 与 phone 属性');
  });

  it('computes accurate LCS line diffs with additions and deletions', () => {
    const original = 'line 1\nline 2\nline 3';
    const modified = 'line 1\nline 2 modified\nline 3\nline 4';

    const diffs = computeLineDiff(original, modified);

    expect(diffs.some(d => d.type === 'unchanged' && d.text === 'line 1')).toBe(true);
    expect(diffs.some(d => d.type === 'deleted' && d.text === 'line 2')).toBe(true);
    expect(diffs.some(d => d.type === 'added' && d.text === 'line 2 modified')).toBe(true);
    expect(diffs.some(d => d.type === 'added' && d.text === 'line 4')).toBe(true);
  });

  it('strips unintended markdown code fences cleanly', () => {
    const rawWithFence = '```typescript\nexport const x = 1;\nexport const y = 2;\n```';
    const cleaned = cleanInlineEditOutput(rawWithFence);

    expect(cleaned).toBe('export const x = 1;\nexport const y = 2;');
  });
});
