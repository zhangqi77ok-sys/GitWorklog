import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatDiagnosticFeedback,
  runFileDiagnostics,
  DiagnosticError
} from '../src/services/compilerDiagnostics';
import {
  saveMemory,
  loadSavedMemories,
  deleteMemory,
  clearMemories,
  extractMemoriesFromConversation,
  buildMemoryPromptSnippet
} from '../src/services/memoryStore';
import {
  generateConventionalCommitMessage,
  commitGitChanges
} from '../src/services/gitWorkflow';
import {
  splitCodeIntoSemanticChunks,
  searchSemanticCodebase
} from '../src/services/semanticSearchEngine';
import { RequestTransformer } from '../src/services/gateway/transform';

describe('Advanced Engineering Features (需求 4 - 10 全面自测)', () => {
  // ── 需求 5: LSP 编译器诊断与自愈回路 ──
  describe('LSP & Compiler Diagnostics', () => {
    it('formats diagnostic errors into actionable priority feedback', () => {
      const errors: DiagnosticError[] = [
        {
          filePath: 'src/services/foo.ts',
          line: 42,
          column: 10,
          code: 'TS2322',
          message: "Type 'string' is not assignable to type 'number'.",
          source: 'tsc'
        }
      ];

      const feedback = formatDiagnosticFeedback(errors);
      expect(feedback).toContain('【⚡ 编译器实时诊断反馈 (LSP Compiler Diagnostics)】');
      expect(feedback).toContain('src/services/foo.ts (行 42, 列 10)');
      expect(feedback).toContain('TS2322');
      expect(feedback).toContain('Type \'string\' is not assignable to type \'number\'.');
      expect(feedback).toContain('严禁忽视上述编译器报错');
    });

    it('returns empty string when no diagnostic errors exist', () => {
      expect(formatDiagnosticFeedback([])).toBe('');
    });
  });

  // ── 需求 7: 跨会话长期工程记忆层 ──
  describe('Cross-Session Long-Term Memory Vault', () => {
    it('extracts memories from user corrections and rule statements', () => {
      const messages = [
        { role: 'user', content: '以后代码命名统一使用 camelCase 小驼峰规范，不要用下划线' },
        { role: 'assistant', content: '好的，我已经记住了命名规范。' }
      ];

      const extracted = extractMemoriesFromConversation(messages, 'sess-123');
      expect(extracted.length).toBeGreaterThanOrEqual(1);
      expect(extracted[0].detail).toContain('camelCase 小驼峰规范');
      expect(extracted[0].category).toBe('code_style');
    });

    it('persists memories and builds system prompt snippet', () => {
      const entry = saveMemory({
        category: 'architecture_rule',
        summary: '单状态源原则',
        detail: '禁止在组件内部直接 new Store 实例，统一使用 StoreFactory 单例获取',
        confidence: 0.95
      });

      expect(entry.id).toMatch(/^mem-/);
      const snippet = buildMemoryPromptSnippet();
      expect(snippet).toContain('【🧠 跨会话长期工程记忆 (Project & User Conventions)】');
      expect(snippet).toContain('单状态源原则');
      expect(snippet).toContain('StoreFactory 单例获取');
    });
  });

  // ── 需求 10: Git 工作流深度集成与 Conventional Commit ──
  describe('Deep Git Workflow & Conventional Commit', () => {
    it('infers feat(ui) commit message from components changes', () => {
      const files = ['src/components/TerminalOutputCard.tsx', 'src/components/ChatColumn.tsx'];
      const suggestion = generateConventionalCommitMessage(files, '实现内置 Terminal 命令卡片');
      expect(suggestion.type).toBe('feat');
      expect(suggestion.scope).toBe('ui');
      expect(suggestion.fullMessage).toContain('feat(ui): 内置 Terminal 命令卡片');
    });

    it('infers fix(contracts) commit message when bug or error is mentioned', () => {
      const files = ['src/types/contractsTypes.ts'];
      const suggestion = generateConventionalCommitMessage(files, '修复类型定义报错 TS2322');
      expect(suggestion.type).toBe('fix');
      expect(suggestion.scope).toBe('contracts');
      expect(suggestion.fullMessage).toBe('fix(contracts): 类型定义报错 TS2322');
    });
  });

  // ── 需求 6: 语义代码切片与检索 ──
  describe('Semantic Code Search Engine', () => {
    it('splits code into semantic function/class blocks', () => {
      const code = `
export function addNumbers(a: number, b: number): number {
  return a + b;
}

export class Calculator {
  public multiply(x: number, y: number): number {
    return x * y;
  }
}
      `.trim();

      const chunks = splitCodeIntoSemanticChunks('src/math.ts', code);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].filePath).toBe('src/math.ts');
      expect(chunks[0].content).toContain('addNumbers');
    });

    it('searches semantic codebase matching query keywords', () => {
      const chunks = [
        {
          id: 'c1',
          filePath: 'src/services/auth.ts',
          symbolName: 'loginUser',
          startLine: 1,
          endLine: 20,
          content: 'export function loginUser(token: string) { return verifyJwt(token); }',
          tokensEstimated: 25
        },
        {
          id: 'c2',
          filePath: 'src/services/database.ts',
          symbolName: 'connectPostgres',
          startLine: 1,
          endLine: 20,
          content: 'export function connectPostgres() { return pg.connect(); }',
          tokensEstimated: 20
        }
      ];

      const results = searchSemanticCodebase('如何实现 user login JWT 验证', chunks);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.symbolName).toBe('loginUser');
      expect(results[0].score).toBeGreaterThan(0.3);
    });
  });

  // ── 需求 8: 多模态 Vision 数据格式转换 ──
  describe('Multimodal Vision Payload Transformation', () => {
    it('transforms messages with images into standard OpenAI image_url payload', () => {
      const transformer = new RequestTransformer({
        platform: 'openai',
        protocol: 'chat_completions'
      });

      const transformed = transformer.transform({
        model: 'gpt-4o',
        stream: false,
        messages: [
          {
            role: 'user',
            content: '请帮我看看这个界面的报错截图',
            images: [
              {
                id: 'img-1',
                name: 'screenshot.png',
                dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
              }
            ]
          }
        ]
      });

      const messages = (transformed as any).messages;
      expect(messages).toHaveLength(1);
      const userContent = messages[0].content;
      expect(Array.isArray(userContent)).toBe(true);
      expect(userContent[0]).toEqual({ type: 'text', text: '请帮我看看这个界面的报错截图' });
      expect(userContent[1].type).toBe('image_url');
      expect(userContent[1].image_url.url).toContain('data:image/png;base64');
    });
  });
});
