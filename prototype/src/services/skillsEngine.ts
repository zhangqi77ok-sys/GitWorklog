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
 * 4. Package Import:
 *    - .zip Archive Import & Local extraction
 *    - Online Git / URL Import
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
  files?: Record<string, string>; // Optional scripts or reference files
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
 * Parses YAML Frontmatter from a SKILL.md markdown file.
 */
export function parseSkillMarkdown(rawContent: string, fallbackName = 'custom-skill'): {
  name: string;
  description: string;
  icon?: string;
  license?: string;
  allowedTools?: string[];
  bodyContent: string;
} {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = rawContent.match(frontmatterRegex);

  let name = fallbackName;
  let description = '';
  let icon = '📦';
  let license: string | undefined = undefined;
  const allowedTools: string[] | undefined = undefined;
  let bodyContent = rawContent;

  if (match) {
    const yamlBlock = match[1];
    bodyContent = match[2].trim();

    // Parse simple key-values in YAML
    const nameMatch = yamlBlock.match(/^name:\s*(.+)$/m);
    if (nameMatch) name = nameMatch[1].trim().replace(/['"]/g, '');

    const descMatch = yamlBlock.match(/^description:\s*(.+)$/m);
    if (descMatch) description = descMatch[1].trim().replace(/['"]/g, '');

    const iconMatch = yamlBlock.match(/^icon:\s*(.+)$/m);
    if (iconMatch) icon = iconMatch[1].trim().replace(/['"]/g, '');

    const licMatch = yamlBlock.match(/^license:\s*(.+)$/m);
    if (licMatch) license = licMatch[1].trim().replace(/['"]/g, '');
  }

  // Fallbacks if frontmatter was missing or partial
  if (!description) {
    const firstLine = bodyContent.split('\n').find(l => l.trim().length > 0 && !l.startsWith('#'));
    description = firstLine ? firstLine.trim().slice(0, 300) : `Agent Skill: ${name}`;
  }

  const normalizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64);

  return {
    name: normalizedName,
    description: description.slice(0, 1024),
    icon,
    license,
    allowedTools,
    bodyContent
  };
}

/**
 * Lightweight browser-compatible ZIP archive reader using Web Standard DecompressionStream.
 */
export async function unpackSkillFromZip(buffer: ArrayBuffer, fallbackName?: string): Promise<{
  name: string;
  description: string;
  bodyContent: string;
  icon?: string;
  files: Record<string, string>;
}> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const textDecoder = new TextDecoder('utf-8');
  const files: Record<string, string> = {};

  let offset = 0;
  while (offset + 30 <= bytes.length) {
    // Check Local File Header signature: 0x04034b50 (PK\x03\x04)
    if (view.getUint32(offset, true) !== 0x04034b50) {
      break;
    }

    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const fileNameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
    const fileName = textDecoder.decode(fileNameBytes);

    const dataStart = offset + 30 + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd <= bytes.length && !fileName.endsWith('/')) {
      const fileDataBytes = bytes.subarray(dataStart, dataEnd);
      let content = '';

      if (compression === 0) {
        // Uncompressed / Stored
        content = textDecoder.decode(fileDataBytes);
      } else if (compression === 8) {
        // Deflate compression
        try {
          if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(fileDataBytes);
            writer.close();
            const response = new Response(ds.readable);
            const decompressedBuf = await response.arrayBuffer();
            content = textDecoder.decode(decompressedBuf);
          } else {
            content = textDecoder.decode(fileDataBytes);
          }
        } catch (e) {
          content = textDecoder.decode(fileDataBytes);
        }
      }
      files[fileName] = content;
    }

    offset = dataEnd;
  }

  // Find SKILL.md or main markdown file
  let mainSkillMd = '';
  let detectedName = fallbackName || 'imported-skill';

  for (const [path, content] of Object.entries(files)) {
    const lower = path.toLowerCase();
    if (lower.endsWith('skill.md') || lower.endsWith('readme.md')) {
      mainSkillMd = content;
      const parts = path.split('/');
      if (parts.length > 1 && parts[parts.length - 2]) {
        detectedName = parts[parts.length - 2];
      }
      break;
    }
  }

  if (!mainSkillMd && Object.keys(files).length > 0) {
    const firstMd = Object.keys(files).find(k => k.toLowerCase().endsWith('.md'));
    if (firstMd) mainSkillMd = files[firstMd];
  }

  const parsed = parseSkillMarkdown(mainSkillMd || `# ${detectedName}\n\nImported Skill Package`, detectedName);

  return {
    name: parsed.name,
    description: parsed.description,
    bodyContent: parsed.bodyContent,
    icon: parsed.icon,
    files
  };
}

/**
 * Imports a skill from an uploaded .zip File.
 */
export async function importSkillFromZipFile(file: File): Promise<SkillMetadata> {
  const buffer = await file.arrayBuffer();
  const rawFileName = file.name.replace(/\.zip$/i, '');
  const unpacked = await unpackSkillFromZip(buffer, rawFileName);

  const newSkill: SkillMetadata = {
    name: unpacked.name,
    description: unpacked.description,
    path: `.agents/skills/${unpacked.name}/SKILL.md`,
    icon: unpacked.icon || '📦',
    enabled: true,
    bodyContent: unpacked.bodyContent,
    files: unpacked.files,
    metadata: { importedAt: new Date().toISOString(), source: file.name }
  };

  addOfficialSkill(newSkill);
  return newSkill;
}

/**
 * Imports a skill from an online URL or GitHub repository raw link.
 */
export async function importSkillFromUrl(url: string): Promise<SkillMetadata> {
  let targetUrl = url.trim();
  // Handle GitHub repo URLs by transforming to raw SKILL.md
  if (targetUrl.includes('github.com') && !targetUrl.includes('raw.githubusercontent.com') && !targetUrl.endsWith('.zip')) {
    targetUrl = targetUrl
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/')
      .replace('/tree/', '/');
    if (!targetUrl.endsWith('SKILL.md') && !targetUrl.endsWith('.md')) {
      targetUrl = `${targetUrl.replace(/\/$/, '')}/main/SKILL.md`;
    }
  }

  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch skill from URL: HTTP ${response.status}`);
  }

  if (targetUrl.endsWith('.zip')) {
    const buffer = await response.arrayBuffer();
    const unpacked = await unpackSkillFromZip(buffer, 'url-imported-skill');
    const skill: SkillMetadata = {
      name: unpacked.name,
      description: unpacked.description,
      path: `.agents/skills/${unpacked.name}/SKILL.md`,
      icon: unpacked.icon || '🌐',
      enabled: true,
      bodyContent: unpacked.bodyContent,
      files: unpacked.files,
      metadata: { importedAt: new Date().toISOString(), sourceUrl: url }
    };
    addOfficialSkill(skill);
    return skill;
  } else {
    const text = await response.text();
    const urlParts = targetUrl.split('/');
    const fallbackName = urlParts[urlParts.length - 2] || 'remote-skill';
    const parsed = parseSkillMarkdown(text, fallbackName);
    const skill: SkillMetadata = {
      name: parsed.name,
      description: parsed.description,
      path: `.agents/skills/${parsed.name}/SKILL.md`,
      icon: parsed.icon || '🌐',
      enabled: true,
      bodyContent: parsed.bodyContent,
      metadata: { importedAt: new Date().toISOString(), sourceUrl: url }
    };
    addOfficialSkill(skill);
    return skill;
  }
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
