import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseSkillMarkdown,
  unpackSkillFromZip,
  addOfficialSkill,
  deleteOfficialSkill,
  toggleOfficialSkillState,
  loadSavedOfficialSkills,
  buildTier1SkillsSystemPrompt,
  getTier2SkillBody
} from '../src/services/skillsEngine';
import {
  loadSavedMcpConfigs,
  addMcpServerConfig,
  addMcpServerFromUrl,
  importMcpConfigsFromJson,
  deleteMcpServerConfig,
  toggleMcpServerEnabled,
  initializeMcpServer,
  buildMcpToolsModelPrompt
} from '../src/services/mcpGateway';

const mockStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
    key: (i: number) => null,
    length: 0
  };
}

describe('Skill Management & Import Engine (agentskills.io compliance)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('parses YAML frontmatter from SKILL.md accurately', () => {
    const rawMarkdown = `---
name: awesome-react-patterns
description: React 19 Server Components and Suspense best practices
icon: ⚛️
license: MIT
---

# React 19 Guide
Follow strictly hooks guidelines and memoization.`;

    const parsed = parseSkillMarkdown(rawMarkdown);
    expect(parsed.name).toBe('awesome-react-patterns');
    expect(parsed.description).toBe('React 19 Server Components and Suspense best practices');
    expect(parsed.icon).toBe('⚛️');
    expect(parsed.license).toBe('MIT');
    expect(parsed.bodyContent).toContain('# React 19 Guide');
  });

  it('falls back gracefully when YAML frontmatter is absent', () => {
    const rawMarkdown = `# My Custom Python Skill
Provides async SQLAlchemy session management guidelines.`;

    const parsed = parseSkillMarkdown(rawMarkdown, 'python-alchemy');
    expect(parsed.name).toBe('python-alchemy');
    expect(parsed.description).toContain('Provides async SQLAlchemy session management guidelines.');
    expect(parsed.bodyContent).toContain('# My Custom Python Skill');
  });

  it('adds, toggles and deletes official skills in persistent storage', () => {
    const skills1 = addOfficialSkill({
      name: 'vue3-composition',
      description: 'Vue 3 Composition API guidelines and Pinia store structure',
      path: '.agents/skills/vue3-composition/SKILL.md',
      icon: '💚',
      bodyContent: '# Vue 3 Guide'
    });

    expect(skills1.some(s => s.name === 'vue3-composition')).toBe(true);

    const skills2 = toggleOfficialSkillState('vue3-composition');
    const target = skills2.find(s => s.name === 'vue3-composition');
    expect(target?.enabled).toBe(false);

    const skills3 = deleteOfficialSkill('vue3-composition');
    expect(skills3.some(s => s.name === 'vue3-composition')).toBe(false);
  });

  it('generates Tier 1 progressive disclosure prompt with token frugality', () => {
    const prompt = buildTier1SkillsSystemPrompt();
    expect(prompt).toContain('【可用 Agent Skills (渐进式加载，遵循 agentskills.io 规范)】');
    expect(prompt).toContain('sdd-tdd-workflow');
  });

  it('retrieves Tier 2 full SKILL.md body on demand', () => {
    const body = getTier2SkillBody('sdd-tdd-workflow');
    expect(body).not.toBeNull();
    expect(body).toContain('SDD & TDD Specification Driven Workflow');
  });
});

describe('MCP Tools Management & URL/JSON Import Engine (2025-06-18 Spec)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds remote MCP server from URL (SSE transport)', () => {
    const configs = addMcpServerFromUrl('https://api.github.com/mcp/sse', 'GitHub Official Remote MCP');
    const added = configs.find(c => c.url === 'https://api.github.com/mcp/sse');
    expect(added).toBeDefined();
    expect(added?.transport).toBe('sse');
    expect(added?.name).toBe('GitHub Official Remote MCP');
    expect(added?.enabled).toBe(true);
  });

  it('imports Claude Desktop claude_desktop_config.json format with mcpServers', () => {
    const jsonStr = JSON.stringify({
      mcpServers: {
        "postgres-db": {
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/db"],
          "env": { "DEBUG": "true" }
        },
        "remote-search": {
          "url": "https://mcp.search.company.com/v1"
        }
      }
    });

    const res = importMcpConfigsFromJson(jsonStr);
    expect(res.errors).toBeUndefined();
    expect(res.imported.length).toBe(2);

    const configs = loadSavedMcpConfigs();
    const pg = configs.find(c => c.id.includes('postgres-db'));
    expect(pg).toBeDefined();
    expect(pg?.transport).toBe('stdio');
    expect(pg?.command).toBe('npx');

    const remote = configs.find(c => c.id.includes('remote-search'));
    expect(remote).toBeDefined();
    expect(remote?.transport).toBe('sse');
    expect(remote?.url).toBe('https://mcp.search.company.com/v1');
  });

  it('handles invalid JSON gracefully with informative error message', () => {
    const res = importMcpConfigsFromJson('{ invalid json string ...');
    expect(res.imported.length).toBe(0);
    expect(res.errors).toContain('JSON 解析失败');
  });

  it('performs standard initialize JSON-RPC handshake simulation', async () => {
    const configs = loadSavedMcpConfigs();
    const fsConfig = configs.find(c => c.id === 'mcp-filesystem')!;
    const runtime = await initializeMcpServer(fsConfig);

    expect(runtime.state).toBe('ready');
    expect(runtime.tools.length).toBeGreaterThan(0);
    expect(runtime.tools.some(t => t.name === 'read_file')).toBe(true);
    expect(runtime.tools.some(t => t.name === 'write_file')).toBe(true);
  });

  it('builds Model Function Calling schema from active MCP runtimes', async () => {
    const configs = loadSavedMcpConfigs();
    const runtimes = await Promise.all(configs.map(c => initializeMcpServer(c)));
    const prompt = buildMcpToolsModelPrompt(runtimes);

    expect(prompt).toContain('【已挂载 MCP 工具集 (Model Context Protocol)】');
    expect(prompt).toContain('read_file');
    expect(prompt).toContain('write_file');
  });
});
