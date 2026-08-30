/**
 * ────────────────────────────────────────────────────────────
 * 📦 AGENT SKILLS ENGINE (agentskills.io Specification Compliance)
 * ────────────────────────────────────────────────────────────
 * 
 * Implements the official Agent Skills standard:
 * 1. Directory Structure: .agents/skills/<name>/SKILL.md
 * 2. Frontmatter: name (<=64 chars, lowercase/numbers/hyphen, matches dir), description (<=1024 chars)
 * 3. Progressive Disclosure (3-Tier Token Strategy):
 *    - Tier 1 (Startup / System Prompt): name + description (~100 tokens total)
 *    - Tier 2 (Active Inspection): Complete SKILL.md body (<5000 tokens)
 *    - Tier 3 (On-Demand Execution): scripts/, references/, assets/
 */

export interface SkillMetadata {
  name: string;              // Required: matches directory name, lowercase alphanumeric and hyphens
  description: string;       // Required: max 1024 chars, what it does and when to trigger
  license?: string;          // Optional license
  compatibility?: string;    // Optional compatibility environment
  metadata?: Record<string, string>; // Optional arbitrary key-value metadata
  allowedTools?: string[];   // Optional pre-approved tools
  path: string;              // File system path
  icon?: string;             // UI icon decoration
  enabled: boolean;          // Enabled toggle
  bodyContent?: string;      // Loaded on-demand in Tier 2
}

const STORAGE_KEY_SKILLS = 'tcode_agent_skills_v2';

export const INITIAL_OFFICIAL_SKILLS: SkillMetadata[] = [
  {
    name: 'sdd-tdd-workflow',
    description: '严格遵循 SDD 规格驱动开发与 Vitest/Pytest TDD 闭环验收流程，先补全断言测试再执行功能落盘',
    metadata: { author: 'Tcode Core', version: '2.0.0', category: 'workflow' },
    path: '.agents/skills/sdd-tdd-workflow/SKILL.md',
    icon: '🧪',
    enabled: true,
    bodyContent: `# SDD & TDD Specification Driven Workflow

## 目标与原则
1. 任何核心功能变更前，必须在 tests/ 下编写完整的行为契约测试 (Contracts Test)。
2. 先运行测试确保红灯 (Red)，编写最小代码使其绿灯 (Green)，最后重构 (Refactor)。
3. 在 Agent Loop 回复中，必须明确提供已通过的测试断言证据。`
  },
  {
    name: 'build-installer',
    description: 'Windows 生产级安装包自动化流水线，执行前端构建、单元测试门禁、PyInstaller 编译与单文件打包',
    metadata: { author: 'Tcode Core', version: '1.5.0', category: 'packaging' },
    path: '.agents/skills/build-installer/SKILL.md',
    icon: '📦',
    enabled: true,
    bodyContent: `# Windows Installer Build Pipeline

## 流程规范
1. 前端产物编译：npm run build
2. 单元测试门禁：npm test (100% 通过率)
3. 宿主编译：PyInstaller 生成 Tcode-Core.exe 与 Tcode-Setup.exe
4. 发布归档：生成 release/ 目录单文件 exe 与 zip 归档`
  },
  {
    name: 'security-audit',
    description: '全面检测硬编码密钥、SQL注入、XSS跨站脚本、反序列化与鉴权缺陷，提供安全补丁',
    metadata: { author: 'Security Team', version: '1.0.0', category: 'security' },
    path: '.agents/skills/security-audit/SKILL.md',
    icon: '🔍',
    enabled: true,
    bodyContent: `# Security Audit & Remediation Guide

## 检查项
- 严禁在源码中硬编码 API Key、私钥或凭据（必须使用环境变量或系统安全存储）
- 终端指令必须经过 SandboxGuard 过滤与 Sudo 授权校验
- 外部输入必须通过类型系统过滤与转义`
  },
  {
    name: 'react-ts-architecture',
    description: 'React 18+ 状态下沉、Custom Hooks 解耦、Memoization 与严格 TypeScript 类型规范',
    metadata: { author: 'Frontend Team', version: '1.0.0', category: 'frontend' },
    path: '.agents/skills/react-ts-architecture/SKILL.md',
    icon: '⚛️',
    enabled: true,
    bodyContent: `# React & TypeScript Architecture Standard

## 铁律规范
1. 严禁使用 any 类型，所有 Props 与 State 必须有严格 TypeScript Interface
2. 弹窗与高频浮层状态必须下沉至子组件内部，严禁全局状态滥用导致整树重渲染
3. 耗时计算与回调函数必须合理使用 useMemo / useCallback`
  },
  {
    name: 'fastapi-async-backend',
    description: 'Python FastAPI/AsyncIO 异步高并发、Pydantic V2 校验、连接池与无阻塞 IO 优化',
    metadata: { author: 'Backend Team', version: '1.0.0', category: 'backend' },
    path: '.agents/skills/fastapi-async-backend/SKILL.md',
    icon: '🐍',
    enabled: true,
    bodyContent: `# FastAPI & AsyncIO Performance Standard

## 规范
1. 所有外部 IO 操作（文件、网络、数据库）必须使用 async/await 异步非阻塞调用
2. 请求与响应数据结构必须使用 Pydantic BaseModel 进行严谨格式校验
3. 异常捕获必须在中间件层统一收敛并返回标准化 JSON 错误结构`
  }
];

let skillsMemoryCache: SkillMetadata[] | null = null;

/**
 * Loads skills from persistent storage with fallback to official defaults
 */
export function loadSavedOfficialSkills(): SkillMetadata[] {
  if (skillsMemoryCache) return skillsMemoryCache;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_SKILLS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          skillsMemoryCache = parsed;
          return parsed;
        }
      }
    }
  } catch (e) {}
  skillsMemoryCache = INITIAL_OFFICIAL_SKILLS;
  return INITIAL_OFFICIAL_SKILLS;
}

/**
 * Saves skills to storage and dispatches update event
 */
export function saveOfficialSkillsToStorage(skills: SkillMetadata[]): void {
  skillsMemoryCache = skills;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(skills));
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tcode_skills_updated', { detail: skills }));
    }
  } catch (e) {}
}

export function toggleOfficialSkillState(skillName: string): SkillMetadata[] {
  const current = loadSavedOfficialSkills();
  const updated = current.map(s => s.name === skillName ? { ...s, enabled: !s.enabled } : s);
  saveOfficialSkillsToStorage(updated);
  return updated;
}

export function addOfficialSkill(skill: Omit<SkillMetadata, 'enabled'>): SkillMetadata[] {
  const current = loadSavedOfficialSkills();
  const normalizedName = skill.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64);
  const newSkill: SkillMetadata = {
    ...skill,
    name: normalizedName,
    description: skill.description.slice(0, 1024),
    enabled: true
  };
  const updated = [newSkill, ...current.filter(s => s.name !== normalizedName)];
  saveOfficialSkillsToStorage(updated);
  return updated;
}

export function deleteOfficialSkill(skillName: string): SkillMetadata[] {
  const current = loadSavedOfficialSkills();
  const updated = current.filter(s => s.name !== skillName);
  saveOfficialSkillsToStorage(updated);
  return updated;
}

/**
 * Tier 1 Progressive Disclosure:
 * Injects ONLY name + description into system prompt (~100 tokens)
 */
export function buildTier1SkillsSystemPrompt(skills?: SkillMetadata[]): string {
  const current = (skills || loadSavedOfficialSkills()).filter(s => s.enabled);
  if (current.length === 0) return '';

  const lines = current.map(s => `- \`${s.name}\`: ${s.description}`);
  return `\n【可用 Agent Skills (渐进式加载，遵循 agentskills.io 规范)】:
你可以在决策或编码时参考以下专精领域技能。如果任务涉及对应技能，你可以按需在思考中应用其指导原则：
${lines.join('\n')}
（💡 渐进式原则：当且仅当需要深入特定技能的细节约束时，可读取对应技能的完整规约）\n`;
}

/**
 * Tier 2 Progressive Disclosure:
 * Fetches full SKILL.md body on-demand (<5000 tokens)
 */
export function getTier2SkillBody(skillName: string): string | null {
  const current = loadSavedOfficialSkills();
  const found = current.find(s => s.name === skillName);
  if (!found) return null;
  return found.bodyContent || `# Skill: ${found.name}\n\n${found.description}`;
}
