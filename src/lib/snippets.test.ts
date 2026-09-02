import { describe, expect, it } from 'vitest';
import {
  createSnippet,
  inferTitle,
  normalizeSnippetArray,
  searchSnippets,
  updateSnippet as updateSnippetEntity,
} from './snippets';

describe('snippets 领域模型', () => {
  it('创建片段时自动生成 id、标题、语言', () => {
    const snippet = createSnippet({
      title: 'fetch 请求',
      content: 'const res = await fetch(url);',
      language: 'plaintext',
      tags: ['react', 'react', ' #hooks '],
    });

    expect(snippet.id.length).toBeGreaterThan(0);
    expect(snippet.title).toBe('fetch 请求');
    expect(snippet.language).toBe('text');
    expect(snippet.tags).toEqual(['react', 'hooks']);
  });

  it('没有标题时从第一行代码推断标题', () => {
    const snippet = createSnippet({
      content: 'const a = 1;\nconst b = 2;',
    });

    expect(snippet.title).toBe('const a = 1;');
  });

  it('脏数据不会破坏启动', () => {
    const raw = [
      null,
      { content: '   ' },
      { id: 'a', content: 'const a = 1', tags: ['x', 42] },
      { id: 'a', content: 'const b = 2' },
    ];

    const result = normalizeSnippetArray(raw);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('const a = 1');
    expect(result[0].tags).toEqual(['x']);
  });

  it('可以搜索标题、内容、标签', () => {
    const snippet = createSnippet({
      title: '读取本地缓存',
      content: "localStorage.getItem('key')",
      language: 'typescript',
      tags: ['storage'],
    });

    expect(searchSnippets([snippet], '缓存')).toHaveLength(1);
    expect(searchSnippets([snippet], 'localStorage')).toHaveLength(1);
    expect(searchSnippets([snippet], 'STORAGE')).toHaveLength(1);
    expect(searchSnippets([snippet], '找不到')).toHaveLength(0);
  });

  it('更新片段会刷新 updatedAt', () => {
    const snippet = createSnippet(
      { title: 'demo', content: 'const a = 1' },
      1000,
    );

    const updated = updateSnippetEntity(
      snippet,
      { content: 'const b = 2' },
      2000,
    );

    expect(updated.updatedAt).toBe(2000);
    expect(updated.title).toBe('demo');
    expect(updated.content).toBe('const b = 2');
  });

  it('推断标题空内容时给出默认标题', () => {
    expect(inferTitle('\n\n')).toBe('未命名片段');
  });
});
