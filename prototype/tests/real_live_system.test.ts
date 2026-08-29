import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  loadSavedProviders,
  saveProvidersToStorage,
  loadSavedProjects,
  saveProjectsToStorage,
  createEmptySession,
  isFirstLaunchState,
  evaluateSandboxCommandSafety,
  maskSensitiveText,
  unmaskSensitiveText,
  resolveDesktopPlatformConfig,
  AVAILABLE_MODELS,
  INITIAL_PROVIDERS,
  ProjectGroup,
  ModelProviderItem,
  STORAGE_KEYS
} from '../src/types/contracts';

const storageMap: Record<string, string> = {};

beforeAll(() => {
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in storageMap ? storageMap[k] : null),
    setItem: (k: string, v: string) => { storageMap[k] = String(v); },
    removeItem: (k: string) => { delete storageMap[k]; },
    clear: () => { Object.keys(storageMap).forEach(k => delete storageMap[k]); }
  };
});

describe('Real Production Lifecycle & Persistence Contracts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize empty projects on clean first launch', () => {
    const projects = loadSavedProjects();
    expect(projects).toEqual([]);
  });

  it('should save and reload real projects in localStorage', () => {
    const mockProjects: ProjectGroup[] = [
      {
        id: 'proj-real-1',
        name: 'my-microservice',
        path: 'D:/workspace/my-microservice',
        gitBranch: 'feature/auth',
        isExpanded: true
      }
    ];

    saveProjectsToStorage(mockProjects);
    const loaded = loadSavedProjects();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('my-microservice');
    expect(loaded[0].path).toBe('D:/workspace/my-microservice');
  });

  it('should correctly detect first launch state', () => {
    expect(isFirstLaunchState([])).toBe(true);

    const emptySession = createEmptySession('新的自由会话');
    expect(emptySession.messagesCount).toBe(0);
    expect(isFirstLaunchState([emptySession])).toBe(true);

    emptySession.messagesCount = 3;
    expect(isFirstLaunchState([emptySession])).toBe(false);
  });

  it('should load default DeepSeek StarSea provider configuration when storage is empty', () => {
    const providers = loadSavedProviders();
    expect(providers.length).toBeGreaterThan(0);
    const deepseek = providers.find(p => p.id === 'provider-deepseek');
    expect(deepseek).toBeDefined();
    expect(deepseek?.baseUrl).toContain('platform.ai.hixinghai.com');
    expect(deepseek?.apiKey).toContain('sk-xh-');
  });

  it('should persist modified provider settings and reload accurately', () => {
    const providers = loadSavedProviders();
    const updated: ModelProviderItem[] = providers.map(p =>
      p.id === 'provider-deepseek' ? { ...p, apiKey: 'sk-custom-real-key-12345678', latencyMs: 45 } : p
    );

    saveProvidersToStorage(updated);
    const reloaded = loadSavedProviders();
    const reloadedDs = reloaded.find(p => p.id === 'provider-deepseek');
    expect(reloadedDs?.apiKey).toBe('sk-custom-real-key-12345678');
    expect(reloadedDs?.latencyMs).toBe(45);
  });
});

describe('AST Security Sandbox & Real PII Shielding', () => {
  it('should strictly intercept destructive commands in sandbox', () => {
    const dangerousCommands = [
      'rm -rf /',
      'rm -rf *',
      'DROP DATABASE production;',
      'drop table users;',
      'format c: /q',
      'mkfs.ext4 /dev/sda1'
    ];

    for (const cmd of dangerousCommands) {
      const result = evaluateSandboxCommandSafety(cmd);
      expect(result.isSafe).toBe(false);
      expect(result.requiresSudo).toBe(true);
      expect(result.hazardReason).toBeDefined();
    }
  });

  it('should allow normal developer commands safely', () => {
    const safeCommands = [
      'npm test',
      'npm run build',
      'git status',
      'git commit -m "feat: login"',
      'python manage.py runserver',
      'cargo build --release'
    ];

    for (const cmd of safeCommands) {
      const result = evaluateSandboxCommandSafety(cmd);
      expect(result.isSafe).toBe(true);
      expect(result.requiresSudo).toBe(false);
    }
  });

  it('should desensitize and restore sensitive API Keys and Database Passwords bidirectionally', () => {
    const rawCode = `
      const apiKey = "sk-xh-ZVKvOZcvzLKxUSWECPQ3mUKfP9q9sxrz14NQmtoQ000";
      const dbUrl = "postgres://admin:SuperSecretPass123!@localhost:5432/proddb";
    `;

    const { maskedText, mapping } = maskSensitiveText(rawCode);
    expect(maskedText).not.toContain('sk-xh-ZVKvOZcvzLKxUSWECPQ3mUKfP9q9sxrz14NQmtoQ000');
    expect(maskedText).not.toContain('SuperSecretPass123!');
    expect(maskedText).toContain('[SEC_API_KEY_');
    expect(maskedText).toContain('[SEC_DB_PASS_');

    const restored = unmaskSensitiveText(maskedText, mapping);
    expect(restored).toBe(rawCode);
  });
});
