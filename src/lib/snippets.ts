export interface Snippet {
  id: string;
  title: string;
  content: string;
  language: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SnippetInput {
  title?: string;
  content: string;
  language?: string;
  tags?: string[];
}

export interface SnippetPatch {
  title?: string;
  content?: string;
  language?: string;
  tags?: string[];
}

export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `snp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function inferTitle(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  return firstLine.slice(0, 80) || '未命名片段';
}

function normalizeTitle(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function normalizeContent(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n') : '';
}

function normalizeLanguage(value: unknown): string {
  if (typeof value !== 'string') return 'text';
  const language = value.trim().toLowerCase();
  return language === 'plaintext' ? 'text' : language || 'text';
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

function normalizeId(value: unknown): string {
  if (typeof value === 'string') {
    const id = value.trim();
    if (id) return id;
  }
  return makeId();
}

export function createSnippet(input: SnippetInput, now = Date.now()): Snippet {
  const content = normalizeContent(input.content);

  if (!content.trim()) {
    throw new Error('片段内容不能为空');
  }

  const title = normalizeTitle(input.title ?? '') || inferTitle(content);

  return {
    id: makeId(),
    title,
    content,
    language: normalizeLanguage(input.language),
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateSnippet(
  current: Snippet,
  patch: SnippetPatch,
  now = Date.now(),
): Snippet {
  const content =
    patch.content === undefined ? current.content : normalizeContent(patch.content);

  if (!content.trim()) {
    throw new Error('片段内容不能为空');
  }

  const title =
    patch.title === undefined ? current.title : normalizeTitle(patch.title);

  return {
    ...current,
    title: title || inferTitle(content),
    content,
    language:
      patch.language === undefined
        ? current.language
        : normalizeLanguage(patch.language),
    tags:
      patch.tags === undefined ? current.tags : normalizeTags(patch.tags),
    updatedAt: now,
  };
}

export function normalizeSnippet(raw: unknown): Snippet | null {
  if (!isRecord(raw)) return null;

  const content = normalizeContent(raw.content);
  if (!content.trim()) return null;

  const createdAt =
    typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
      ? raw.createdAt
      : Date.now();

  const updatedAt =
    typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
      ? raw.updatedAt
      : createdAt;

  const title = normalizeTitle(raw.title);

  return {
    id: normalizeId(raw.id),
    title: title || inferTitle(content),
    content,
    language: normalizeLanguage(raw.language),
    tags: normalizeTags(raw.tags),
    createdAt,
    updatedAt,
  };
}

export function normalizeSnippetArray(raw: unknown): Snippet[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.snippets)
      ? raw.snippets
      : [];

  const seen = new Set<string>();
  const result: Snippet[] = [];

  for (const item of list) {
    const snippet = normalizeSnippet(item);
    if (snippet && !seen.has(snippet.id)) {
      seen.add(snippet.id);
      result.push(snippet);
    }
  }

  return result;
}

export function sortSnippets(snippets: Snippet[]): Snippet[] {
  return [...snippets].sort(
    (a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt,
  );
}

export function searchSnippets(
  snippets: Snippet[],
  query: string | null | undefined,
): Snippet[] {
  const keyword = (query ?? '').trim().toLowerCase();

  if (!keyword) return snippets;

  return snippets.filter((snippet) => {
    return (
      snippet.title.toLowerCase().includes(keyword) ||
      snippet.content.toLowerCase().includes(keyword) ||
      snippet.language.toLowerCase().includes(keyword) ||
      snippet.tags.some((tag) => tag.toLowerCase().includes(keyword))
    );
  });
}
