import { create } from 'zustand';
import {
  createSnippet,
  normalizeSnippetArray,
  sortSnippets,
  updateSnippet as updateSnippetEntity,
  type Snippet,
  type SnippetInput,
  type SnippetPatch,
} from '../lib/snippets';

const STORAGE_KEY = 'tcode.snippets.v1';

function loadInitialSnippets(): Snippet[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    return normalizeSnippetArray(JSON.parse(raw));
  } catch (error) {
    console.warn('[tcode] 读取本地片段失败，已使用空列表', error);
    return [];
  }
}

function persistSnippets(snippets: Snippet[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  } catch (error) {
    console.warn('[tcode] 保存本地片段失败', error);
  }
}

const initialSnippets = sortSnippets(loadInitialSnippets());

export interface SnippetStoreState {
  snippets: Snippet[];
  query: string;
  selectedId: string | null;

  setQuery: (query: string) => void;
  selectSnippet: (id: string | null) => void;

  addSnippet: (input: SnippetInput) => Snippet | null;
  updateSnippetById: (id: string, patch: SnippetPatch) => void;
  deleteSnippetById: (id: string) => void;
  duplicateSnippetById: (id: string) => void;

  replaceAll: (snippets: Snippet[]) => void;
  exportPayload: () => {
    app: 'tcode';
    version: 1;
    exportedAt: string;
    snippets: Snippet[];
  };
}

export const useSnippetStore = create<SnippetStoreState>((set, get) => ({
  snippets: initialSnippets,
  query: '',
  selectedId: initialSnippets[0]?.id ?? null,

  setQuery: (query) => set({ query }),

  selectSnippet: (selectedId) => set({ selectedId }),

  addSnippet: (input) => {
    try {
      const snippet = createSnippet(input);
      const snippets = sortSnippets([snippet, ...get().snippets]);

      persistSnippets(snippets);
      set({ snippets, selectedId: snippet.id });

      return snippet;
    } catch (error) {
      console.warn('[tcode] 新增片段失败', error);
      return null;
    }
  },

  updateSnippetById: (id, patch) => {
    set((state) => {
      const snippets = state.snippets.map((item) => {
        if (item.id !== id) return item;

        try {
          return updateSnippetEntity(item, patch);
        } catch (error) {
          console.warn('[tcode] 更新片段失败', error);
          return item;
        }
      });

      const nextSnippets = sortSnippets(snippets);
      persistSnippets(nextSnippets);

      return { snippets: nextSnippets };
    });
  },

  deleteSnippetById: (id) => {
    set((state) => {
      const snippets = state.snippets.filter((item) => item.id !== id);
      persistSnippets(snippets);

      return {
        snippets,
        selectedId: state.selectedId === id ? null : state.selectedId,
      };
    });
  },

  duplicateSnippetById: (id) => {
    const source = get().snippets.find((item) => item.id === id);
    if (!source) return;

    try {
      const copy = createSnippet({
        title: `${source.title}（副本）`,
        content: source.content,
        language: source.language,
        tags: source.tags,
      });

      const snippets = sortSnippets([copy, ...get().snippets]);

      persistSnippets(snippets);
      set({ snippets, selectedId: copy.id });
    } catch (error) {
      console.warn('[tcode] 复制片段失败', error);
    }
  },

  replaceAll: (snippets) => {
    const normalized = normalizeSnippetArray(snippets);
    const nextSnippets = sortSnippets(normalized);

    persistSnippets(nextSnippets);

    set({
      snippets: nextSnippets,
      query: '',
      selectedId: nextSnippets[0]?.id ?? null,
    });
  },

  exportPayload: () => ({
    app: 'tcode',
    version: 1,
    exportedAt: new Date().toISOString(),
    snippets: get().snippets,
  }),
}));
