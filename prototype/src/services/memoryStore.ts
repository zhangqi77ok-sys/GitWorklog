/**
 * Cross-Session Long-Term Memory Store (Memory Vault)
 * Automatically captures user corrections, project conventions, and engineering decisions,
 * persists them across sessions, and injects a compact top-level memory snippet into the System Prompt.
 */

export interface MemoryEntry {
  id: string;
  category: 'code_style' | 'project_convention' | 'architecture_rule' | 'user_preference';
  summary: string;
  detail: string;
  createdAt: number;
  confidence: number; // 0.0 - 1.0
  sourceSessionId?: string;
}

const STORAGE_KEY = 'tcode_learned_memories_v1';

export const INITIAL_MEMORIES: MemoryEntry[] = [
  {
    id: 'mem-001',
    category: 'code_style',
    summary: '类型与空安全第一原则',
    detail: '本项目严格使用 TypeScript 强类型，杜绝 any，所有接口契约优先在 contractsTypes.ts 中显式声明。',
    createdAt: Date.now() - 86400000 * 2,
    confidence: 0.95
  },
  {
    id: 'mem-002',
    category: 'project_convention',
    summary: '测试与质量自愈规范',
    detail: '运行单元测试统一使用 Vitest (npm test)，改动核心逻辑前必须通过相关测试套件验证。',
    createdAt: Date.now() - 86400000,
    confidence: 0.9
  }
];

let memoryCache: MemoryEntry[] | null = null;

export function loadSavedMemories(): MemoryEntry[] {
  if (memoryCache !== null) return memoryCache;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCache = parsed;
          return memoryCache;
        }
      }
    }
  } catch {}
  memoryCache = [...INITIAL_MEMORIES];
  return memoryCache;
}

export function saveMemoriesToStorage(memories: MemoryEntry[]): void {
  memoryCache = memories;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tcode_memories_updated', { detail: memories }));
      }
    }
    // Also backup to backend disk storage
    if (typeof fetch !== 'undefined') {
      fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: STORAGE_KEY, data: memories })
      }).catch(() => {});
    }
  } catch {}
}

export function saveMemory(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): MemoryEntry {
  const memories = loadSavedMemories();
  const newEntry: MemoryEntry = {
    ...entry,
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now()
  };
  const updated = [newEntry, ...memories];
  saveMemoriesToStorage(updated);
  return newEntry;
}

export function deleteMemory(id: string): void {
  const memories = loadSavedMemories();
  const updated = memories.filter(m => m.id !== id);
  saveMemoriesToStorage(updated);
}

export function clearMemories(): void {
  saveMemoriesToStorage([]);
}

/**
 * Extracts new memories from a conversation by detecting explicit user corrections or rule statements.
 */
export function extractMemoriesFromConversation(
  messages: Array<{ role: string; content: string }>,
  sessionId?: string
): MemoryEntry[] {
  const extracted: MemoryEntry[] = [];
  const correctionTriggers = /(?:以后|不要|严禁|必须|习惯|请用|统一使用|总是|规范|约定|prefer|always|never|rule)[\s:：]+([^\n。；!！]+)/gi;

  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    let match: RegExpExecArray | null;
    while ((match = correctionTriggers.exec(msg.content)) !== null) {
      const statement = match[1].trim();
      if (statement.length >= 4 && statement.length <= 120) {
        const isStyle = /样式|命名|格式|驼峰|camel|snake|style|format/i.test(msg.content);
        const isArch = /架构|单例|store|factory|状态|模块|contract/i.test(msg.content);
        extracted.push({
          id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: isStyle ? 'code_style' : isArch ? 'architecture_rule' : 'project_convention',
          summary: statement.slice(0, 30),
          detail: statement,
          createdAt: Date.now(),
          confidence: 0.85,
          sourceSessionId: sessionId
        });
      }
    }
  }

  return extracted;
}

/**
 * Generates a compact system prompt snippet for injecting into the System Prompt.
 */
export function buildMemoryPromptSnippet(maxItems = 6): string {
  const memories = loadSavedMemories();
  if (memories.length === 0) return '';

  const topMemories = memories.slice(0, maxItems);
  const itemsText = topMemories.map((m, i) => `${i + 1}. [${m.summary}]: ${m.detail}`).join('\n');

  return `
【🧠 跨会话长期工程记忆 (Project & User Conventions)】
${itemsText}
`.trim();
}
