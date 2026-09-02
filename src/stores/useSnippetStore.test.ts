import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSnippetStore } from './useSnippetStore';

// Mock localStorage for Node test environment
const storageMock: Record<string, string> = {};
const globalLocalStorage = {
  getItem: vi.fn((key: string) => storageMock[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    storageMock[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete storageMock[key];
  }),
  clear: vi.fn(() => {
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
  }),
};

(globalThis as any).localStorage = globalLocalStorage;

describe('useSnippetStore', () => {
  beforeEach(() => {
    globalLocalStorage.clear();
    useSnippetStore.setState({
      snippets: [],
      query: '',
      selectedId: null,
    });
  });

  it('adds, searches and retrieves snippets', () => {
    const store = useSnippetStore.getState();
    const created = store.addSnippet({
      title: '测试片段 1',
      content: 'console.log("hello world");',
      language: 'typescript',
      tags: ['test', 'demo'],
    });

    expect(created).toBeDefined();
    expect(created?.title).toBe('测试片段 1');
    expect(useSnippetStore.getState().snippets).toHaveLength(1);

    useSnippetStore.getState().setQuery('hello');
    expect(useSnippetStore.getState().query).toBe('hello');
  });

  it('updates and deletes snippet by id', () => {
    const store = useSnippetStore.getState();
    const snippet = store.addSnippet({
      title: '原标题',
      content: 'const a = 1;',
    });

    expect(snippet).toBeDefined();
    if (!snippet) return;

    store.updateSnippetById(snippet.id, {
      title: '新标题',
    });

    const updated = useSnippetStore.getState().snippets.find((s) => s.id === snippet.id);
    expect(updated?.title).toBe('新标题');

    store.deleteSnippetById(snippet.id);
    expect(useSnippetStore.getState().snippets).toHaveLength(0);
  });

  it('exports payload with tcode version metadata', () => {
    const store = useSnippetStore.getState();
    store.addSnippet({
      title: '导出测试',
      content: 'export const a = 1;',
    });

    const payload = store.exportPayload();
    expect(payload.app).toBe('tcode');
    expect(payload.version).toBe(1);
    expect(payload.snippets).toHaveLength(1);
  });
});
