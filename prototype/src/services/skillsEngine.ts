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
    name: 'spec-driven-development',
    description: '严格遵循 SDD 规格驱动开发范式：先定义数据模型、API 契约与详细方案，获得确认后再编写代码',
    metadata: { author: 'superpowers', version: '2.1.0', category: 'architecture' },
    path: '.agents/skills/spec-driven-development/SKILL.md',
    icon: '📝',
    enabled: true,
    bodyContent: `# Spec-Driven Development (SDD) Specification

## 核心法则
1. 严禁跳过规格直接编码。必须先输出完整的 Specification 与接口定义。
2. 架构契约先行 (Contract-First)：先定义 Models, DTOs, API 契约与状态机。
3. 方案必须经过影响范围分析、边界条件与异常流推演。`
  },
  {
    name: 'test-driven-development',
    description: '严格遵循 TDD 红-绿-重构 (Red-Green-Refactor) 循环：先写失败测试，编写最小代码通过，再进行架构重构',
    metadata: { author: 'superpowers', version: '2.1.0', category: 'testing' },
    path: '.agents/skills/test-driven-development/SKILL.md',
    icon: '🧪',
    enabled: true,
    bodyContent: `# Test-Driven Development (TDD) Specification

## 核心流程
1. Red：在修改生产代码前，先编写稳定的单元测试或回归测试，验证预期失败。
2. Green：编写恰好能让测试通过的最小代码，确保 100% 绿灯。
3. Refactor：在测试套件保护下清理代码、消除重复，重构中保持测试全程通过。`
  },
  {
    name: 'brainstorming',
    description: '结构化方案头脑风暴：在复杂决策前进行多维发散推演、权衡取舍 (Trade-offs) 与收敛决策',
    metadata: { author: 'superpowers', version: '2.0.0', category: 'ideation' },
    path: '.agents/skills/brainstorming/SKILL.md',
    icon: '💡',
    enabled: true,
    bodyContent: `# Structured Brainstorming & Architecture Ideation

## 执行规范
1. 发散阶段：列出至少 3 种不同维度的备选架构方案（极简、可扩展、高性能）。
2. 权衡分析：评估各方案的复杂度、学习成本、维护成本与潜在隐患。
3. 决策收敛：依据奥卡姆剃刀与当前项目约束，给出最推荐方案并明确理由。`
  },
  {
    name: 'steelman-review',
    description: '钢人原则与双向抗压推演：为各备选方案构建最强版本，深度挖掘隐性假设并进行反脆弱压力测试',
    metadata: { author: 'Steelman Skill', version: '1.5.0', category: 'dialectic' },
    path: '.agents/skills/steelman-review/SKILL.md',
    icon: '🛡️',
    enabled: true,
    bodyContent: `# Steelman Skill & Dialectic Pressure Testing

## 核心准则
1. 构建最强版本 (Steelmanning)：在否定任何方案前，先为其构建最合理、最有说服力的最强论点。
2. 双向抗压 (Dual Steelmanning)：为所有备选方案建立最强论据，全面暴露盲区。
3. 极限抗压测试：模拟极限边界、高并发、断网与故障恢复场景。`
  },
  {
    name: 'thermo-nuclear-review',
    description: '严苛代码架构审查与 Code Judo：降维简化、杜绝特殊特判与面条代码、硬性规模门禁审查',
    metadata: { author: 'Code Quality Guard', version: '2.0.0', category: 'review' },
    path: '.agents/skills/thermo-nuclear-review/SKILL.md',
    icon: '🔬',
    enabled: true,
    bodyContent: `# Thermo-Nuclear Code Quality Review

## 审查门禁
1. Code Judo 降维简化：主动探寻更优领域建模以大幅减少代码量和冗余层。
2. 零容忍打补丁特判：必须在类型系统或状态机源头完成建模。
3. 硬性指标：函数 <= 50 行、文件 <= 300 行、圈复杂度 <= 10、嵌套深度 <= 3。`
  },
  {
    name: 'systematic-debugging',
    description: '科学假设与最小复现调试：基于证据提出科学假说，建立精准断言，杜绝盲目试错与静默降级',
    metadata: { author: 'superpowers', version: '2.0.0', category: 'debugging' },
    path: '.agents/skills/systematic-debugging/SKILL.md',
    icon: '🐞',
    enabled: true,
    bodyContent: `# Systematic Scientific Debugging

## 调试准则
1. 禁止盲目猜测：结论必须基于现有日志、堆栈跟踪或代码断点证据。
2. 最小复现：编写单测或独立脚本稳定复现 Bug。
3. 杜绝静默降级：禁止吞异常或用虚假默认值掩盖真实根因。`
  },
  {
    name: 'writing-skills',
    description: 'Agent 技能自举与编写规范：按照 agentskills.io 标准构建高质量、自愈型 SKILL.md 技能包',
    metadata: { author: 'superpowers', version: '1.2.0', category: 'meta' },
    path: '.agents/skills/writing-skills/SKILL.md',
    icon: '⚡',
    enabled: true,
    bodyContent: `# Writing Agent Skills Standard

## 编写规范
1. 遵循 Progressive Disclosure 渐进式三层披露模型（Frontmatter -> Body -> Scripts）。
2. 明确 Trigger 触发条件与 Non-Goals 负向边界。
3. 嵌入确定性的验证命令与质量门禁 checklist。`
  },
  {
    name: 'swarm-orchestration',
    description: 'Swarm 多智能体并发协同网络：Lead Agent 动态任务拆解，专业 Subagents 角色分工与消息传递',
    metadata: { author: 'Swarm Team', version: '2.0.0', category: 'concurrency' },
    path: '.agents/skills/swarm-orchestration/SKILL.md',
    icon: '🐝',
    enabled: true,
    bodyContent: `# Swarm Multi-Agent Concurrency & Orchestration

## 协同拓扑
1. Lead Agent：负责全局规划、任务分解与拓扑调度。
2. Worker Subagents：架构师、前端工程师、测试官、安全审查员并发执行。
3. 消息机制：结构化 JSON 事件总线与成果归集看板。`
  },
  {
    name: 'worktree-isolation',
    description: 'Git Worktree 物理隔离沙箱：在独立分支与工作树中进行高危探索与破坏性重构，隔离主分支',
    metadata: { author: 'Git Sandbox', version: '1.0.0', category: 'safety' },
    path: '.agents/skills/worktree-isolation/SKILL.md',
    icon: '🌳',
    enabled: true,
    bodyContent: `# Git Worktree Isolation Sandbox

## 隔离规则
1. 高危操作、大型重构或破坏性变更必须在独立 git worktree 中执行。
2. 验证全部通过后方可合并至主工作区，避免未提交污染。`
  },
  {
    name: 'credential-hygiene',
    description: '凭据安全与零泄漏守卫：检测敏感密钥、Token，强制 Fail-Closed 机制，阻止硬编码落盘',
    metadata: { author: 'Security Team', version: '1.0.0', category: 'security' },
    path: '.agents/skills/credential-hygiene/SKILL.md',
    icon: '🔐',
    enabled: true,
    bodyContent: `# Credential Hygiene & Zero Leakage Standard

## 安全红线
1. 严禁在源码、配置或提示词中硬编码 API Key、私钥或密码。
2. 运行时凭据必须使用系统密钥环或环境变量注入。
3. 缺少凭据时明确报错并阻断，严禁静默 fallback 到测试 Key。`
  },
  {
    name: 'ui-ux-design-first',
    description: 'UI/UX 设计先行与人机工程学：严格执行 60-30-10 配色法则、16:9 人体工程学布局与全状态覆盖',
    metadata: { author: 'UI/UX Team', version: '2.0.0', category: 'frontend' },
    path: '.agents/skills/ui-ux-design-first/SKILL.md',
    icon: '🎨',
    enabled: true,
    bodyContent: `# UI/UX Design-First Specification

## 设计法则
1. 编码前必须先输出 UI/UX 设计方案并获得用户确认。
2. 遵循暖米白 (#FAF8F5) 与陶土暖橙 (#D96B27) 视觉规范。
3. 交互全状态覆盖：Default, Hover, Active, Focus, Disabled, Loading 骨架屏。`
  },
  {
    name: 'build-installer',
    description: 'Windows 生产级安装包流水线：前端构建、单测门禁、PyInstaller 编译与单文件 exe/zip 打包',
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
    name: 'react-ts-architecture',
    description: 'React 18+ 状态下沉、Custom Hooks 解耦、Memoization 与严格 TypeScript 类型规范',
    metadata: { author: 'Frontend Team', version: '1.0.0', category: 'frontend' },
    path: '.agents/skills/react-ts-architecture/SKILL.md',
    icon: '⚛️',
    enabled: true,
    bodyContent: `# React & TypeScript Architecture Standard

## 铁律规范
1. 严禁使用 any 类型，所有 Props 与 State 必须有严格 TypeScript Interface
2. 弹窗与高频浮层状态必须下沉至子组件内部，严禁全局状态滥用
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
