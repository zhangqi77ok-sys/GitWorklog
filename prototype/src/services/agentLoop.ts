import type { ActionResult, PermissionPolicy, TargetAcceptanceItem, EvidenceItem, PermissionPolicyConfig, PathPermissionRule, CommandPermissionRule } from '../types/contracts';
import { DEFAULT_PERMISSION_CONFIG, parseAgentMessage } from '../types/contracts';

export type AgentActionType = 'write_file' | 'run_command' | 'read_file';
export type ActionExecutionTier = 'silent' | 'notify_after' | 'blocking_approval';

export interface ActionScopeTrust {
  actionType: AgentActionType | '*';
  pathGlob: string;
}

export interface AgentAction {
  id: string;
  type: AgentActionType;
  target: string;
  code: string;
  isHighRisk: boolean;
  riskReason?: string;
  tier: ActionExecutionTier;
}

export type ActionExecutionStatus = ActionResult['status'];

type ActionResultDetails = Omit<ActionResult, 'actionId' | 'type' | 'target' | 'status'>;

const COMMAND_FENCE_LANGUAGE = 'run_command';

const HIGH_RISK_COMMAND = /\b(git\s+push|git\s+reset\s+--hard|git\s+clean|rm\s+-rf|remove-item|del\s+\/f|drop\s+(?:table|database|schema)|format-volume|format\s+[a-z]:|mkfs)\b/i;
const HIGH_RISK_FILE = /(?:^|[\\/])(?:\.env(?:\.|$)|package\.json|package-lock\.json|\.git)(?:[\\/]|$)/i;

function getRiskReason(type: AgentActionType, target: string, code: string): string | undefined {
  if (type === 'write_file') {
    if (/package\.json/i.test(target)) return '会修改工程依赖清单，可能引发版本漂移';
    if (/\.env/i.test(target)) return '涉及环境变量与私密凭据文件';
    if (/\.git/i.test(target)) return '涉及版本控制核心元数据';
    return undefined;
  }
  if (/git\s+push/i.test(code)) return '将把本地提交推送到远端仓库，推送后无法用本地快照撤回';
  if (/git\s+reset\s+--hard|git\s+clean/i.test(code)) return '会强制丢弃工作区所有未提交的修改';
  if (/rm\s+-rf|remove-item|del\s+\/f/i.test(code)) return '包含不可逆的递归强制删除指令';
  if (/drop\s+(?:table|database|schema)/i.test(code)) return '包含破坏性数据库删表/删库 DDL 操作';
  return undefined;
}

function getActionTier(type: AgentActionType, target: string, isHighRisk: boolean): ActionExecutionTier {
  if (isHighRisk) return 'blocking_approval';
  if (type === 'run_command' && /^(npm\s+test|vitest|pytest|git\s+status|git\s+diff|ls|dir|cat|type)\b/i.test(target)) {
    return 'silent';
  }
  return 'notify_after';
}

function actionContentHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash * 33) ^ value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function extractTargetFromSuffixOrCode(suffix: string, code: string): string {
  const cleanSuffix = suffix.trim();
  if (cleanSuffix.startsWith('{') && cleanSuffix.endsWith('}')) {
    try {
      const obj = JSON.parse(cleanSuffix);
      const val = obj.path || obj.PATH || obj.filePath || obj.file_path || obj.target || obj.TARGET;
      if (val && typeof val === 'string') return val.trim();
    } catch {
      const m = /["']?(?:path|PATH|filePath|file_path)["']?\s*:\s*["']([^"']+)["']/i.exec(cleanSuffix);
      if (m) return m[1].trim();
    }
  } else if (cleanSuffix) {
    return cleanSuffix;
  }

  const cleanCode = code.trim();
  if (cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
    try {
      const obj = JSON.parse(cleanCode);
      const val = obj.path || obj.PATH || obj.filePath || obj.file_path || obj.target || obj.TARGET;
      if (val && typeof val === 'string') return val.trim();
    } catch {
      const m = /["']?(?:path|PATH|filePath|file_path)["']?\s*:\s*["']([^"']+)["']/i.exec(cleanCode);
      if (m) return m[1].trim();
    }
  } else if (cleanCode) {
    return cleanCode.split('\n')[0].trim();
  }

  return '';
}

function getFenceAction(language: string, code: string, index: number): AgentAction | null {
  const normalizedLanguage = language.trim();

  // 1. READ_FILE Action (e.g. ```read_file:path```, ```READ_FILE:{"PATH":"..."}```, ```read_file```)
  if (/^(read_file|read|view_file|cat|get_file|READ_FILE)[:\s]?/i.test(normalizedLanguage)) {
    const colonIdx = normalizedLanguage.indexOf(':');
    const suffix = colonIdx !== -1 ? normalizedLanguage.slice(colonIdx + 1) : '';
    const target = extractTargetFromSuffixOrCode(suffix, code);
    if (!target) return null;

    return {
      id: `action-${index}-read_file-${actionContentHash(`${target}\u0000${index}`)}`,
      type: 'read_file',
      target,
      code: target,
      isHighRisk: false,
      tier: 'silent'
    };
  }

  // 2. WRITE_FILE Action (e.g. ```write_file:path```, ```WRITE_FILE:{"PATH":"..."}```)
  const isWrite = /^(write_file|file|create_file|WRITE_FILE)[:\s]?/i.test(normalizedLanguage);
  if (isWrite) {
    const colonIdx = normalizedLanguage.indexOf(':');
    const suffix = colonIdx !== -1 ? normalizedLanguage.slice(colonIdx + 1) : '';
    let target = extractTargetFromSuffixOrCode(suffix, '');
    if (!target && code.trim()) {
      target = normalizedLanguage.replace(/^(write_file|file|create_file|WRITE_FILE)[:\s]?/i, '').trim();
    }
    if (!target || !code.trim()) return null;
    const isHighRisk = HIGH_RISK_FILE.test(target);
    const riskReason = getRiskReason('write_file', target, code);
    return {
      id: `action-${index}-write_file-${actionContentHash(`${target}\u0000${code}`)}`,
      type: 'write_file',
      target,
      code,
      isHighRisk,
      riskReason,
      tier: getActionTier('write_file', target, isHighRisk)
    };
  }

  // 3. RUN_COMMAND Action (only explicit run_command/exec_command fences are executed as actions)
  const isCommand = normalizedLanguage.toLowerCase() === COMMAND_FENCE_LANGUAGE || normalizedLanguage.toLowerCase() === 'exec_command';
  if (isCommand && code.trim()) {
    const firstLine = code.trim().split('\n')[0].slice(0, 80);
    const isHighRisk = HIGH_RISK_COMMAND.test(code);
    const riskReason = getRiskReason('run_command', firstLine, code);
    return {
      id: `action-${index}-run_command-${actionContentHash(`${firstLine}\u0000${code}`)}`,
      type: 'run_command',
      target: firstLine,
      code: code.trim(),
      isHighRisk,
      riskReason,
      tier: getActionTier('run_command', firstLine, isHighRisk)
    };
  }

  return null;
}

/** Checks whether code/command syntax appears complete (balanced quotes/brackets and no dangling operators). */
export function checkActionSyntaxComplete(code: string): boolean {
  if (!code || !code.trim()) return false;
  const text = code.trim();

  // 1. Check balanced double and single quotes (ignoring escaped ones)
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prev = i > 0 ? text[i - 1] : '';
    if (char === '"' && prev !== '\\' && !inSingle) inDouble = !inDouble;
    if (char === '\'' && prev !== '\\' && !inDouble) inSingle = !inSingle;
  }
  if (inDouble || inSingle) return false;

  // 2. Check dangling line continuations or incomplete pipe / operators
  if (/(\||&&|\band\b|\bor\b|\\|,|\+|\*|\/)\s*$/i.test(text)) return false;

  // 3. For code blocks, check balanced braces/parentheses
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  for (const c of text) {
    if (c === '(') paren++;
    else if (c === ')') paren--;
    else if (c === '{') brace++;
    else if (c === '}') brace--;
    else if (c === '[') bracket++;
    else if (c === ']') bracket--;
  }
  if (paren !== 0 || brace < 0 || bracket !== 0) return false;

  // 4. Check unfinished TypeScript / JS / Python keyword expressions (e.g. "export const a = (num")
  if (/\b(export|import|const|let|var|function|def|class)\s+[a-zA-Z0-9_$]+\s*=\s*\([a-zA-Z0-9_$,\s]*$/i.test(text)) {
    return false;
  }

  return true;
}

/** Detects whether content contains a dangling incomplete action block truncated mid-stream. */
export function hasIncompleteActionBlock(content: string): boolean {
  if (!content) return false;
  const lines = content.split('\n');
  let activeLanguage: string | null = null;
  let codeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('```')) {
      if (activeLanguage !== null) codeLines.push(line);
      continue;
    }
    if (activeLanguage === null) {
      activeLanguage = trimmed.slice(3).trim();
      codeLines = [];
      continue;
    }
    activeLanguage = null;
    codeLines = [];
  }

  if (activeLanguage !== null) {
    const isActionLang = activeLanguage.startsWith('write_file:') ||
                         activeLanguage.startsWith('file:') ||
                         activeLanguage.startsWith('create_file:') ||
                         ['run_command', 'bash', 'sh', 'powershell', 'cmd', 'python', 'py'].includes(activeLanguage.toLowerCase());
    if (isActionLang) {
      return true;
    }
  }

  return false;
}

/** 自动补齐悬挂未闭合的反引号代码块 */
export function autoRepairIncompleteFences(content: string): string {
  if (!content) return '';
  const lines = content.split('\n');
  let activeLanguage: string | null = null;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```')) {
      if (activeLanguage === null) activeLanguage = trimmed.slice(3).trim();
      else activeLanguage = null;
    }
  }
  if (activeLanguage !== null) {
    return content + '\n```\n';
  }
  return content;
}

/** Parses supported fenced blocks AND XML tool_call blocks into normalized Agent Actions. */
export function parseAgentActions(content: string): AgentAction[] {
  const actions: AgentAction[] = [];

  // 1. Parse markdown fenced blocks (```write_file:path ... ``` and ```run_command ... ```)
  const lines = content.split('\n');
  let activeLanguage: string | null = null;
  let codeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('```')) {
      if (activeLanguage !== null) codeLines.push(line);
      continue;
    }

    if (activeLanguage === null) {
      activeLanguage = trimmed.slice(3).trim();
      codeLines = [];
      continue;
    }

    const action = getFenceAction(activeLanguage, codeLines.join('\n'), actions.length);
    if (action) actions.push(action);
    activeLanguage = null;
    codeLines = [];
  }

  // 2. Parse XML tool_call blocks (<tool_call><read_file> / <write_file> / <run_command>)
  const toolCallRegex = /<tool_call>\s*<([a-zA-Z0-9_-]+)>([\s\S]*?)<\/\1>\s*<\/tool_call>/gi;
  let match: RegExpExecArray | null;

  while ((match = toolCallRegex.exec(content)) !== null) {
    const toolName = match[1].toLowerCase();
    const toolBody = match[2];

    // Extract args (supports <arg_key>key</arg_key><arg_value>val</arg_value> or direct <path>...</path>)
    let target = '';
    let code = '';

    const pathMatch = /<(?:arg_key>path<\/arg_key>\s*<arg_value>|path>)([\s\S]*?)<\/(?:arg_value|path)>/i.exec(toolBody);
    if (pathMatch) target = pathMatch[1].trim();

    const cmdMatch = /<(?:arg_key>command<\/arg_key>\s*<arg_value>|command>)([\s\S]*?)<\/(?:arg_value|command)>/i.exec(toolBody);
    if (cmdMatch) {
      code = cmdMatch[1].trim();
      target = code.split('\n')[0].slice(0, 80);
    }

    const contentMatch = /<(?:arg_key>content<\/arg_key>\s*<arg_value>|content>)([\s\S]*?)<\/(?:arg_value|content)>/i.exec(toolBody);
    if (contentMatch) code = contentMatch[1];

    if (toolName === 'write_file' || toolName === 'create_file') {
      if (target && code) {
        const isHighRisk = HIGH_RISK_FILE.test(target);
        actions.push({
          id: `action-${actions.length}-write_file-${actionContentHash(target + code)}`,
          type: 'write_file',
          target,
          code,
          isHighRisk,
          riskReason: getRiskReason('write_file', target, code),
          tier: getActionTier('write_file', target, isHighRisk)
        });
      }
    } else if (toolName === 'run_command' || toolName === 'exec_command' || toolName === 'bash') {
      if (code) {
        const isHighRisk = HIGH_RISK_COMMAND.test(code);
        actions.push({
          id: `action-${actions.length}-run_command-${actionContentHash(code)}`,
          type: 'run_command',
          target,
          code,
          isHighRisk,
          riskReason: getRiskReason('run_command', target, code),
          tier: getActionTier('run_command', target, isHighRisk)
        });
      }
    } else if (toolName === 'read_file' && target) {
      // Convert read_file into a safe non-blocking inspect command
      actions.push({
        id: `action-${actions.length}-read_file-${actionContentHash(target)}`,
        type: 'run_command',
        target: `查看文件内容: ${target}`,
        code: typeof process !== 'undefined' && process.platform === 'win32' ? `Get-Content "${target}" -TotalCount 200` : `cat "${target}"`,
        isHighRisk: false,
        tier: 'silent'
      });
    }
  }

  // 3. Parse DSML and Structured Tool Calls from parseAgentMessage
  const parsedMsg = parseAgentMessage(content);
  for (const tc of parsedMsg.toolCalls) {
    const tName = tc.name.toLowerCase();
    const params = tc.parameters || {};

    if (tName === 'run_command' || tName === 'exec_command' || tName === 'bash' || tName === 'cmd') {
      const code = (params.command || params.cmd || params.code || '').trim();
      if (code) {
        const firstLine = code.split('\n')[0].slice(0, 80);
        const isHighRisk = HIGH_RISK_COMMAND.test(code);
        // Avoid duplicate
        if (!actions.some(a => a.type === 'run_command' && a.code === code)) {
          actions.push({
            id: `action-${actions.length}-run_command-${actionContentHash(code)}`,
            type: 'run_command',
            target: firstLine,
            code,
            isHighRisk,
            riskReason: getRiskReason('run_command', firstLine, code),
            tier: getActionTier('run_command', firstLine, isHighRisk)
          });
        }
      }
    } else if (tName === 'write_file' || tName === 'create_file') {
      const target = (params.path || params.file || params.target || '').trim();
      const code = params.content || params.code || '';
      if (target && code) {
        const isHighRisk = HIGH_RISK_FILE.test(target);
        if (!actions.some(a => a.type === 'write_file' && a.target === target && a.code === code)) {
          actions.push({
            id: `action-${actions.length}-write_file-${actionContentHash(target + code)}`,
            type: 'write_file',
            target,
            code,
            isHighRisk,
            riskReason: getRiskReason('write_file', target, code),
            tier: getActionTier('write_file', target, isHighRisk)
          });
        }
      }
    } else if (tName === 'read_file') {
      const target = (params.path || params.file || params.target || '').trim();
      if (target && !actions.some(a => a.target === `查看文件内容: ${target}`)) {
        actions.push({
          id: `action-${actions.length}-read_file-${actionContentHash(target)}`,
          type: 'run_command',
          target: `查看文件内容: ${target}`,
          code: typeof process !== 'undefined' && process.platform === 'win32' ? `Get-Content "${target}" -TotalCount 200` : `cat "${target}"`,
          isHighRisk: false,
          tier: 'silent'
        });
      }
    }
  }

  // 4. Bare Command Heuristic Fallback (When model outputs a clear terminal command without code fences)
  if (actions.length === 0 && content && !hasIncompleteActionBlock(content) && !content.includes('```')) {
    const lines = content.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith('/*') || line.startsWith('`')) continue;
      
      const isBareCmd = /^(Get-ChildItem|Get-Content|Set-Location|Select-String|dir\s+-|ls\s+-|pytest|vitest)\s+[^\n]+$/i.test(line);
      if (isBareCmd) {
        const firstLine = line.slice(0, 80);
        const isHighRisk = HIGH_RISK_COMMAND.test(line);
        actions.push({
          id: `action-${actions.length}-bare_command-${actionContentHash(line)}`,
          type: 'run_command',
          target: firstLine,
          code: line,
          isHighRisk,
          riskReason: getRiskReason('run_command', firstLine, line),
          tier: getActionTier('run_command', firstLine, isHighRisk)
        });
        break; // Extract top-level primary command in fallback mode
      }

      // Check if it is a bare path (e.g. D:\weihu\new-api or /path/to/dir)
      const isBarePath = /^[a-zA-Z]:[\\/][^:*?"<>|\r\n]+$/.test(line) || /^(\.\/|\.\.\/|\/)[a-zA-Z0-9_.\-\\/]+$/.test(line);
      if (isBarePath) {
        const p = line.trim();
        const cmd = typeof process !== 'undefined' && process.platform === 'win32'
          ? `Get-ChildItem -Path "${p}" -Force | Select-Object Mode, Name, Length | Format-Table -AutoSize`
          : `ls -la "${p}"`;
        actions.push({
          id: `action-${actions.length}-bare_path-${actionContentHash(p)}`,
          type: 'run_command',
          target: `探索目录: ${p}`,
          code: cmd,
          isHighRisk: false,
          tier: 'silent'
        });
        break;
      }
    }
  }

  // 4. Python/脚本独立探索代码块智能兜底 (当模型输出独立脚本代码块用于探索时)
  if (actions.length === 0 && (content.includes('```python') || content.includes('```py'))) {
    const pyMatch = /```(?:python|py)\s*\n([\s\S]*?)(?:```|$)/i.exec(content);
    if (pyMatch && pyMatch[1].trim()) {
      const rawPy = pyMatch[1].trim();
      if (rawPy.includes('import io') || rawPy.includes('import sys') || rawPy.includes('import os') || rawPy.includes('print(') || rawPy.includes('open(')) {
        const firstLine = rawPy.split('\n')[0].slice(0, 80);
        const escaped = rawPy.replace(/"/g, '\\"');
        actions.push({
          id: `action-0-python_script-${actionContentHash(rawPy)}`,
          type: 'run_command',
          target: `[Python探索脚本] ${firstLine}`,
          code: `python -c "${escaped}"`,
          isHighRisk: false,
          tier: 'silent'
        });
      }
    }
  }

  // 5. 自然语言意图路径智能合成兜底 (NLP Path & Intent Synthesizer)
  if (actions.length === 0 && content) {
    const nlpActions = extractNaturalLanguageExplorationActions(content);
    if (nlpActions.length > 0) {
      return nlpActions;
    }
  }

  return actions;
}

/**
 * 自然语言意图路径智能提取与命令合成器 (NLP Path & Intent Synthesizer)
 * 当大模型没有输出任何 ```run_command 代码块，而是以自然语言描述：
 * "我需要读取 docs/technical_reviews 目录下的内容，特别是 model-gateway-v2-contract.md，同时查看 src-desktop 目录结构"
 * 系统自动提取出文本中提及的路径与文件名，自动合成为安全的探索/读取命令执行。
 */
export function extractNaturalLanguageExplorationActions(content: string): AgentAction[] {
  if (!content || !content.trim() || content.includes('```')) return [];

  const hasExplorationIntent = /读取|查看|探索|列出|检查|分析|定位|扫描|检视|read|inspect|explore|list|check|scan/i.test(content);
  if (!hasExplorationIntent) return [];

  // 匹配文本中的目录路径或具体文件（如 docs/technical_reviews、src-desktop、model-gateway-v2-contract.md 等）
  const pathRegex = /(?:[a-zA-Z0-9_\-.]+[\\/][a-zA-Z0-9_\-./]+|[a-zA-Z0-9_\-.]+\.(?:md|ts|tsx|js|jsx|json|py|rs|go|java|html|css|yaml|yml|toml|txt|sh|ps1)|src-[a-zA-Z0-9_\-]+)/g;
  const matches = content.match(pathRegex) || [];
  const uniquePaths = Array.from(new Set(matches.map(p => p.trim()))).filter(p => !p.startsWith('http') && p.length > 2);

  if (uniquePaths.length === 0) return [];

  const actions: AgentAction[] = [];
  const dirPaths: string[] = [];
  const filePaths: string[] = [];

  for (const p of uniquePaths) {
    if (/\.(md|ts|tsx|js|jsx|json|py|rs|go|java|html|css|yaml|yml|toml|txt|sh|ps1)$/i.test(p)) {
      filePaths.push(p);
    } else {
      dirPaths.push(p);
    }
  }

  const cmds: string[] = [];
  if (dirPaths.length > 0) {
    const formattedDirs = dirPaths.map(d => `"${d}"`).join(', ');
    cmds.push(`Get-ChildItem -Path ${formattedDirs} -Force -ErrorAction SilentlyContinue | Format-Table Mode, Name, Length -AutoSize`);
  }
  for (const f of filePaths) {
    cmds.push(`Get-Content -Path "${f}" -Encoding UTF8 -ErrorAction SilentlyContinue | Select-Object -First 120`);
  }

  if (cmds.length > 0) {
    const combinedCmd = cmds.join(' ; ');
    actions.push({
      id: `action-${actions.length}-nlp_synthesized-${actionContentHash(combinedCmd)}`,
      type: 'run_command',
      target: `[NLP意图合成] 读取/探索 ${uniquePaths.join(', ')}`,
      code: combinedCmd,
      isHighRisk: false,
      tier: 'silent'
    });
  }

  return actions;
}

/**
 * 深度思考链动作兜底挖掘（Thinking Action Mining）
 * 当大模型在 <think> 内部规划并输出了完整代码块，但在 </think> 后的正文中遗漏了代码块时，
 * 自动从思考链中安全提取只读探索动作（如 Get-ChildItem, Get-Content, dir, ls, cat 等）以驱动闭环。
 */
export function extractThinkingFallbackActions(thinkingText: string): AgentAction[] {
  if (!thinkingText || !thinkingText.trim()) return [];
  const actions: AgentAction[] = [];

  // 1. 匹配思考链中的代码块
  const codeBlockRegex = /```(?:run_command|powershell|bash|cmd|sh)?\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(thinkingText)) !== null) {
    const rawCmd = match[1].trim();
    if (!rawCmd) continue;

    // 过滤出安全的探索/只读指令
    const isSafeReadOrExplore = /^(?:\[Console\]::OutputEncoding\s*=\s*\[System\.Text\.Encoding\]::UTF8\s*;\s*)?(?:Get-ChildItem|Get-Content|dir|ls|cat|find|grep|npm\s+test|git\s+status|git\s+diff)/i.test(rawCmd);
    if (isSafeReadOrExplore && !HIGH_RISK_COMMAND.test(rawCmd)) {
      const firstLine = rawCmd.split('\n')[0].slice(0, 80);
      actions.push({
        id: `action-${actions.length}-thinking_fallback-${actionContentHash(rawCmd)}`,
        type: 'run_command',
        target: `[思维链兜底] ${firstLine}`,
        code: rawCmd,
        isHighRisk: false,
        tier: 'silent'
      });
      break; // 优先提取主要探索指令
    }
  }

  return actions;
}

/** Checks whether a path or target matches a glob like src/** or src/components/*. */
export function matchesGlob(path: string, glob: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/');
  const normalizedGlob = glob.replace(/\\/g, '/');
  if (normalizedGlob === '*' || normalizedGlob === '**' || normalizedGlob === normalizedPath) return true;
  if (normalizedGlob.endsWith('/**')) {
    const prefix = normalizedGlob.slice(0, -3);
    return normalizedPath.startsWith(prefix);
  }
  if (normalizedGlob.endsWith('/*')) {
    const prefix = normalizedGlob.slice(0, -2);
    return normalizedPath.startsWith(prefix) && !normalizedPath.slice(prefix.length + 1).includes('/');
  }
  return normalizedPath.includes(normalizedGlob.replace(/\*/g, ''));
}

export interface ActionPermissionEvaluation {
  decision: 'allow' | 'ask' | 'deny';
  reason?: string;
}

export function evaluateActionPermission(
  config: PermissionPolicyConfig | undefined,
  action: AgentAction,
  scopedTrusts: ActionScopeTrust[] = []
): ActionPermissionEvaluation {
  const currentConfig = config || DEFAULT_PERMISSION_CONFIG;

  // 1. Plan Mode check: In Plan mode, writing files or running non-readonly commands is strictly denied
  if (currentConfig.mode === 'plan') {
    if (action.type === 'write_file') {
      return {
        decision: 'deny',
        reason: '当前处于 Plan 模式（只读规划），禁止执行写文件操作。请先切换至 Act 模式或输出执行方案。'
      };
    }
    if (action.type === 'run_command') {
      const isReadOnlyCmd = /^(npm\s+test|vitest|pytest|git\s+status|git\s+diff|ls|dir|cat|type|head|tail|find)\b/i.test(action.target);
      if (!isReadOnlyCmd) {
        return {
          decision: 'deny',
          reason: '当前处于 Plan 模式（只读规划），禁止执行可能修改状态的终端命令。'
        };
      }
    }
  }

  // 2. High-risk regex hard check
  if (action.isHighRisk) {
    return {
      decision: 'ask',
      reason: action.riskReason || '检测到高危系统或文件操作，需人工显式授权确认'
    };
  }

  // 3. Scoped trusts check
  const isScopedTrusted = scopedTrusts.some(trust =>
    (trust.actionType === '*' || trust.actionType === action.type) &&
    matchesGlob(action.target, trust.pathGlob)
  );
  if (isScopedTrusted) {
    return { decision: 'allow' };
  }

  // 4. File rules check
  if (action.type === 'write_file') {
    for (const rule of currentConfig.fileRules || []) {
      if (matchesGlob(action.target, rule.pattern)) {
        return {
          decision: rule.action,
          reason: rule.action === 'deny' ? `触碰文件保护策略 (${rule.pattern})` : undefined
        };
      }
    }
  }

  // 5. Command rules check
  if (action.type === 'run_command') {
    for (const rule of currentConfig.commandRules || []) {
      if (matchesGlob(action.code || action.target, rule.pattern)) {
        return {
          decision: rule.action,
          reason: rule.action === 'deny' ? `触碰命令阻断策略 (${rule.pattern})` : undefined
        };
      }
    }
  }

  // 6. Session low risk tolerance
  if (currentConfig.allowLowRiskInSession) {
    return { decision: 'allow' };
  }

  return { decision: 'allow' };
}

export function shouldRequireActionApproval(
  policy: PermissionPolicy,
  action: AgentAction,
  scopedTrusts: ActionScopeTrust[] = [],
  allowLowRiskInSession: boolean = false
): boolean {
  if (action.isHighRisk) return true;

  const isScopedTrusted = scopedTrusts.some(trust =>
    (trust.actionType === '*' || trust.actionType === action.type) &&
    matchesGlob(action.target, trust.pathGlob)
  );
  if (isScopedTrusted) return false;

  if (allowLowRiskInSession) return false;
  if (policy === 'strict_approval') return true;
  return false;
}

export function createActionResult(
  action: AgentAction,
  status: ActionExecutionStatus,
  details: ActionResultDetails = {}
): ActionResult {
  return { actionId: action.id, type: action.type, target: action.target, status, ...details };
}

export function getActionResultForId(actionId: string, results: ActionResult[]): ActionResult | undefined {
  return results.find(result => result.actionId === actionId);
}

// ────────────────────────────────────────────────────────────
// 🎯 TARGET-DRIVEN AGENT LOOP CONTRACTS & VERIFIER
// ────────────────────────────────────────────────────────────

export type { TargetAcceptanceItem, EvidenceItem } from '../types/contracts';

export type LoopTerminationStatus =
  | 'running'
  | 'completed'          // ✓ 目标已全部验证通过
  | 'needs_decision'      // ⏸ 需要用户在备选方案间决策
  | 'blocked'             // ⚠ 任务被外部条件阻塞（如缺少凭据）
  | 'no_progress'         // ⚠ 连续无进展/死循环熔断
  | 'strikeout'           // ?? ??????? 3 ???????????? + ???
  | 'resource_limit';     // ⚠ 达到时间/费用/安全预算熔断

export interface LoopTerminationResult {
  status: LoopTerminationStatus;
  summary: string;
  items: TargetAcceptanceItem[];
  evidenceList: string[];
  suggestedActions?: Array<{ id: string; label: string }>;
}

export interface ProgressVector {
  stepIndex: number;
  phase: 'understand' | 'plan' | 'inspect' | 'modify' | 'act' | 'verify' | 'fix' | 'done';
  actionFingerprints: string[];
  passedCount: number;
  failedCount: number;
  diffSummary?: string;
}

export interface InternalStepTag {
  turn: number;
  step: number;
  phase: 'understand' | 'inspect' | 'modify' | 'verify' | 'fix' | 'done';
  status: 'running' | 'passed' | 'failed' | 'blocked';
  label: string;
}

/** Normalizes criteria description text for fuzzy deduplication across rounds */
export function normalizeCriteriaKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9]+[.:、\s]*/g, '') // remove numbers e.g. "1. " or "验收项 1："
    .replace(/^(验收项|验收标准|目标|item|criterion|criteria)[\s:：]*/i, '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '') // keep alphanumeric and Chinese
    .trim();
}

/**
 * Merges newly parsed acceptance items from latest LLM response into Run-level criteria:
 * - Deduplicates by id or normalized description
 * - Updates status (never downgrades 'passed' to 'pending')
 * - Merges new structured evidence
 */
export function mergeAcceptanceCriteria(
  existing: TargetAcceptanceItem[],
  incoming: TargetAcceptanceItem[]
): TargetAcceptanceItem[] {
  if (existing.length === 0) return incoming;
  if (incoming.length === 0) return existing;

  const result = existing.map(item => ({ ...item, evidenceDetails: item.evidenceDetails ? [...item.evidenceDetails] : [] }));

  for (const inc of incoming) {
    const incKey = normalizeCriteriaKey(inc.description);
    // Find existing match by ID or normalized text
    let matched = result.find(e => e.id === inc.id);
    if (!matched && incKey) {
      matched = result.find(e => normalizeCriteriaKey(e.description) === incKey);
    }

    if (matched) {
      // P0 iron rule: model text can never verify an item — incoming 'passed'
      // from parsing is downgraded to a claim; only verifyTargetAcceptance
      // (physical evidence) may set 'passed'.
      const incStatus = inc.status === 'passed' ? 'model_claimed' : inc.status;
      if (incStatus === 'model_claimed') {
        if (matched.status === 'pending' || matched.status === 'running') {
          matched.status = 'model_claimed';
        }
      } else if (incStatus === 'failed' && matched.status !== 'passed' && matched.status !== 'model_claimed') {
        matched.status = 'failed';
      } else if (incStatus === 'running' && matched.status === 'pending') {
        matched.status = 'running';
      }

      // Merge evidence
      if (inc.evidence) matched.evidence = inc.evidence;
      if (inc.evidenceDetails && inc.evidenceDetails.length > 0) {
        matched.evidenceDetails = [...(matched.evidenceDetails || []), ...inc.evidenceDetails];
      }
    } else {
      // Brand new criterion found, append with clean ID (downgrade model-claimed passed)
      result.push({
        ...inc,
        id: inc.id || `crit-${result.length + 1}`,
        status: inc.status === 'passed' ? 'model_claimed' : inc.status,
        evidenceDetails: inc.evidenceDetails || []
      });
    }
  }

  return result;
}

/** Parses markdown task/acceptance items from goal breakdown (□ / - [ ] / ✓ / ✕). */
export function parseAcceptanceCriteria(content: string): TargetAcceptanceItem[] {
  const items: TargetAcceptanceItem[] = [];
  const lines = content.split('\n');
  let idCounter = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:[-*●]\s+)?(?:\[([ xX✓✕])\]|[□✓✕])\s+(.+)$/);
    if (match) {
      const mark = (match[1] || trimmed.charAt(0)).toLowerCase();
      const desc = match[2].trim();
      let status: TargetAcceptanceItem['status'] = 'pending';
      if (mark === 'x' || mark === '✓' || trimmed.startsWith('✓')) {
        // P0 iron rule: model self-report is only a claim; physical evidence is required to pass.
        status = 'model_claimed';
      } else if (mark === '✕' || trimmed.startsWith('✕')) {
        status = 'failed';
      }
      items.push({
        id: `crit-${idCounter++}`,
        description: desc,
        status
      });
    }
  }

  return items;
}

/**
 * Checks if a command is specifically an inspection or file-read command.
 * Commands like Get-Content, cat, type, ls, dir, head, tail, Write-Host must NEVER be treated as test runners.
 */
export function isInspectionOrReadCommand(code: string): boolean {
  const clean = code.trim();
  if (/^(?:Get-Content|cat|type|head|tail|more|less|ls|dir|find|grep|Select-String|echo|Write-Host)\b/i.test(clean)) {
    return true;
  }
  if (/\|\s*(?:Select-Object|grep|head|tail|Out-String)/i.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Checks if a command is an actual test runner or type checker suite execution.
 */
export function isActualTestRunnerCommand(code: string): boolean {
  if (isInspectionOrReadCommand(code)) {
    if (!/\b(?:pytest|vitest|jest|cargo\s+test|go\s+test|npm\s+test|pnpm\s+test|yarn\s+test)\b/i.test(code)) {
      return false;
    }
  }

  return /\b(?:pytest|vitest|jest|cargo\s+test|go\s+test|npm\s+test|pnpm\s+test|yarn\s+test|python(?:\.exe)?\s+(?:-m\s+pytest|-m\s+unittest)|dotnet\s+test|mvn\s+test|gradle\s+test|tsc\s+--noEmit|npm\s+run\s+test|npm\s+run\s+typecheck)\b/i.test(code);
}

/** Evaluates progress vector across steps to detect repetition loops or progress stalls. */
export function detectProgressStall(history: ProgressVector[]): boolean {
  if (history.length < 3) return false;
  const recent = history.slice(-3);

  const allSameActions = recent.every((v, _, arr) =>
    v.actionFingerprints.join(',') === arr[0].actionFingerprints.join(',') && v.actionFingerprints.length > 0
  );
  const noPassedIncrease = recent.every((v, _, arr) => v.passedCount === arr[0].passedCount && v.failedCount === arr[0].failedCount);

  return allSameActions && noPassedIncrease;
}

/**
 * Independent Verifier: Evaluates real evidence (test exit code, typecheck, write results)
 * against target acceptance items to determine completion or blockers.
 */
export function verifyTargetAcceptance(
  items: TargetAcceptanceItem[],
  latestActions: AgentAction[],
  latestResults: ActionResult[],
  progressHistory: ProgressVector[],
  strikeout = false
): LoopTerminationResult {
  const updatedItems = items.map(item => ({ ...item }));
  const evidenceList: string[] = [];

  const testResults = latestResults.filter(r => {
    if (r.type !== 'run_command') return false;
    const action = latestActions.find(a => a.id === r.actionId);
    const code = action?.code || r.target;
    return isActualTestRunnerCommand(code);
  });
  const writeResults = latestResults.filter(r => r.type === 'write_file');

  testResults.forEach(tr => {
    // 🛡️ Strict Test Output & Failure Parser: Detect FFFF, FAILURES, FAILED, error even if exit code was 0 in compound shell commands
    const combinedOutput = `${tr.output || ''} ${tr.error || ''}`;
    const hasTestFailurePatterns = /(?:^|\s)(?:FAILED|FAILURES?|ERRORS?|SyntaxError|Traceback|AssertionError|FAIL\s+|[F.]{3,}F)(?:\s|$|:)/i.test(combinedOutput) ||
                                  /tests?\s+failed/i.test(combinedOutput);

    const isReallyPassed = tr.status === 'success' && (tr.exitCode === 0 || tr.exitCode === undefined) && !hasTestFailurePatterns;

    if (isReallyPassed) {
      evidenceList.push(`测试与验证通过: ${tr.target}`);
      updatedItems.forEach(item => {
        if (/测试|单测|验证|类型|type/i.test(item.description)) {
          item.status = 'passed';
          item.evidence = `✓ ${tr.target} (全部测试用例通过)`;
          item.evidenceDetails = item.evidenceDetails || [];
          item.evidenceDetails.push({
            type: 'test',
            summary: '全部测试用例与类型检查通过',
            command: tr.target,
            exitCode: tr.exitCode ?? 0,
            output: tr.output?.slice(0, 500),
            timestamp: Date.now()
          });
        }
      });
    } else {
      const failureReason = hasTestFailurePatterns ? '测试输出包含失败用例 (FAILURES / FFFF)' : (tr.error || `Exit code ${tr.exitCode}`);
      evidenceList.push(`测试失败: ${tr.target} (${failureReason})`);
      updatedItems.forEach(item => {
        if (/测试|单测|验证|类型/i.test(item.description)) {
          item.status = 'failed';
          item.evidence = `✕ ${tr.target} (${failureReason})`;
          item.evidenceDetails = item.evidenceDetails || [];
          item.evidenceDetails.push({
            type: 'test',
            summary: `测试执行失败: ${failureReason}`,
            command: tr.target,
            exitCode: tr.exitCode ?? 1,
            output: (tr.error || tr.output)?.slice(0, 500),
            timestamp: Date.now()
          });
        }
      });
    }
  });

  writeResults.forEach(wr => {
    if (wr.status === 'success') {
      evidenceList.push(`代码落盘成功: ${wr.target} (${wr.fileSize ?? 'OK'})`);
      updatedItems.forEach(item => {
        if (item.description.includes(wr.target)) {
          if (item.status !== 'failed') item.status = 'passed';
          item.evidenceDetails = item.evidenceDetails || [];
          item.evidenceDetails.push({
            type: 'file',
            summary: `已成功落盘写入代码文件: ${wr.target}`,
            filePath: wr.target,
            timestamp: Date.now()
          });
        }
      });
    }
  });

  const passedCount = updatedItems.filter(i => i.status === 'passed').length;
  const totalCount = updatedItems.length;
  const hasFailed = updatedItems.some(i => i.status === 'failed');

  if (totalCount > 0 && passedCount === totalCount && !hasFailed) {
    return {
      status: 'completed',
      summary: `✓ 目标已完成 (${passedCount}/${totalCount} 项验收通过 · 测试通过)`,
      items: updatedItems,
      evidenceList
    };
  }

  if (detectProgressStall(progressHistory)) {
    if (strikeout) {
      return {
        status: 'strikeout',
        summary: '⚠️ 触发三振熔断保护机制：连续 3 次重构未能解决同类报错，已生成影子回滚点',
        items: updatedItems,
        evidenceList,
        suggestedActions: [
          { id: 'revert_to_snapshot', label: '⏪ 回滚到初始快照' },
          { id: 'try_new_approach', label: '🔄 尝试全新方案' },
          { id: 'continue_anyway', label: '▶ 强制继续' }
        ]
      };
    }
    return {
      status: 'no_progress',
      summary: '⚠ 当前没有新的有效进展 (最近的修复没有改变验证结果，建议调整方案)',
      items: updatedItems,
      evidenceList,
      suggestedActions: [
        { id: 'try_new_approach', label: '🔄 换一种架构方案' },
        { id: 'view_root_cause', label: '🔍 查看失败根因诊断' },
        { id: 'continue_anyway', label: '▶ 强制继续尝试' }
      ]
    };
  }

  return {
    status: 'running',
    summary: `进行中 (${passedCount}/${totalCount || 1} 项通过 · 持续闭环验证)`,
    items: updatedItems,
    evidenceList
  };
}

/** Produces bounded, factual feedback for the next model iteration including verifier report. */
export function formatExecutionFeedback(
  actions: AgentAction[],
  results: ActionResult[],
  acceptanceItems?: TargetAcceptanceItem[],
  compilerDiagnosticsFeedback?: string
): string {
  const lines = ['[Tcode Agent 执行引擎与独立验证器反馈]', ''];

  if (compilerDiagnosticsFeedback) {
    lines.push(compilerDiagnosticsFeedback, '');
  }

  if (acceptanceItems && acceptanceItems.length > 0) {
    lines.push('【当前目标验收项达成状态】:');
    acceptanceItems.forEach(item => {
      const mark = item.status === 'passed' ? '✓' : item.status === 'failed' ? '✕' : '□';
      lines.push(`${mark} ${item.description}${item.evidence ? ` (${item.evidence})` : ''}`);
    });
    lines.push('');
  }

  lines.push('【动作执行明细】:');
  for (const action of actions) {
    const result = getActionResultForId(action.id, results);
    if (!result) continue;

    if (result.status === 'success') {
      if (action.type === 'read_file') {
        lines.push(`✅ read_file: ${action.target} — 读取成功 (${result.fileSize ?? '?'} 字节)`);
        if (result.output) {
          lines.push(`\`\`\`\n${result.output.slice(0, 12000)}\n\`\`\``);
        }
      } else if (action.type === 'write_file') {
        lines.push(`✅ write_file:${action.target} — 写入成功 (${result.fileSize ?? '?'} 字节)`);
      } else {
        lines.push(`✅ run_command: ${action.target} — 执行完成 (Exit Code: ${result.exitCode ?? 0})`);
        if (result.output) lines.push(`  stdout: ${result.output.slice(0, 500)}`);
        if (result.error) lines.push(`  stderr: ${result.error.slice(0, 300)}`);
      }
    } else if (result.status === 'rejected') {
      lines.push(`🚫 ${action.type}: ${action.target} — 用户拒绝执行`);
    } else if (result.status === 'failed') {
      const exitCode = action.type === 'run_command' && result.exitCode !== undefined
        ? ` (Exit Code: ${result.exitCode})`
        : '';
      lines.push(`❌ ${action.type}: ${action.target} — 执行失败${exitCode}${result.error ? `: ${result.error.slice(0, 300)}` : ''}`);
    }
  }

  lines.push('', '请根据以上验收状态与验证证据继续执行下一步。若所有验收项均通过(✓)，请总结交付成果。');
  return lines.join('\n');
}

export interface NativeToolCallInput {
  id: string;
  name?: string;
  arguments?: string | Record<string, unknown>;
}

/** Converts complete or streamed native provider tool calls into AgentAction objects. */
export function parseNativeToolCalls(toolCalls: NativeToolCallInput[]): AgentAction[] {
  const grouped = new Map<string, { name: string; arguments: string }>();
  for (const call of toolCalls) {
    const name = call.name?.trim().toLowerCase();
    if (!name) continue;
    const current = grouped.get(call.id) || { name, arguments: '' };
    current.name = name;
    current.arguments += typeof call.arguments === 'string'
      ? call.arguments
      : call.arguments ? JSON.stringify(call.arguments) : '';
    grouped.set(call.id, current);
  }

  const actions: AgentAction[] = [];
  for (const [id, call] of grouped) {
    let args: Record<string, any>;
    try {
      args = JSON.parse(call.arguments || '{}');
    } catch {
      continue;
    }

    if (call.name === 'write_file' || call.name === 'create_file') {
      const target = String(args.path || args.file_path || '').trim();
      const code = String(args.content ?? args.code ?? '');
      if (!target || !code) continue;
      const isHighRisk = HIGH_RISK_FILE.test(target);
      actions.push({
        id: `native-${id}-write_file-${actionContentHash(target + code)}`,
        type: 'write_file',
        target,
        code,
        isHighRisk,
        riskReason: getRiskReason('write_file', target, code),
        tier: getActionTier('write_file', target, isHighRisk)
      });
      continue;
    }

    if (call.name === 'read_file') {
      const target = String(args.path || args.file_path || '').trim();
      if (!target) continue;
      actions.push({
        id: `native-${id}-read_file-${actionContentHash(target)}`,
        type: 'run_command',
        target: `查看文件内容: ${target}`,
        code: typeof process !== 'undefined' && process.platform === 'win32' ? `Get-Content "${target}" -TotalCount 200` : `cat "${target}"`,
        isHighRisk: false,
        tier: 'silent'
      });
      continue;
    }

    if (call.name === 'run_command' || call.name === 'exec_command' || call.name === 'bash') {
      const code = String(args.command || args.cmd || args.script || '').trim();
      if (!code) continue;
      const isHighRisk = HIGH_RISK_COMMAND.test(code);
      actions.push({
        id: `native-${id}-run_command-${actionContentHash(code)}`,
        type: 'run_command',
        target: code.split('\n')[0].slice(0, 80),
        code,
        isHighRisk,
        riskReason: getRiskReason('run_command', code, code),
        tier: getActionTier('run_command', code, isHighRisk)
      });
    }
  }
  return actions;
}

export interface LoopContinueVerdict {
  continue: boolean;
  reason: 'natural_completion' | 'tool_driven' | 'max_turns';
}

/**
 * Golden Invariant 1 & 2: the loop continues ONLY when this round produced
 * tool calls. Zero tool calls = natural completion (chitchat exits in one
 * round). acceptanceItems NEVER drive continuation (anti-fabrication).
 * maxTurns is the hard circuit breaker.
 */
export function shouldContinueLoop(params: {
  actions: AgentAction[];
  acceptanceItems: TargetAcceptanceItem[];
  loopCount: number;
  maxTurns?: number;
}): LoopContinueVerdict {
  const maxTurns = params.maxTurns ?? 8;
  if (params.loopCount >= maxTurns) return { continue: false, reason: 'max_turns' };
  if (!params.actions || params.actions.length === 0) {
    return { continue: false, reason: 'natural_completion' };
  }
  return { continue: true, reason: 'tool_driven' };
}

export function resolveAllowedTools(workflowBlock?: { allowedTools?: string[] }, mode?: string): string[] {
  if (workflowBlock && workflowBlock.allowedTools && workflowBlock.allowedTools.length > 0) {
    return workflowBlock.allowedTools;
  }
  switch (mode) {
    case 'plan':
      return ['read_file', 'grep_search', 'find_by_name'];
    case 'act':
    default:
      return ['read_file', 'write_file', 'run_command', 'grep_search', 'find_by_name'];
  }
}

export function filterToolDefs(
  tools: Array<{ name?: string; type?: string }>,
  allowedTools: string[]
): Array<{ name?: string; type?: string }> {
  return (tools || []).filter(t => allowedTools.includes(t.name || '') || allowedTools.includes(t.type || ''));
}

export async function executeSandboxAction(
  action: AgentAction,
  allowedTools: string[],
  executeHost: (a: AgentAction) => Promise<ActionResult>
): Promise<ActionResult> {
  if (!allowedTools.includes(action.type)) {
    return {
      actionId: action.id,
      type: action.type,
      target: action.target,
      status: 'rejected',
      output: `【权限安全保护 403】: 当前工作流阶段受安全策略约束，仅允许使用 [${allowedTools.join(', ')}]，已拦截未经授权的 [${action.type}] 动作。请先完成当前阶段要求！`,
      error: 'PERMISSION_RESTRICTED'
    };
  }
  return executeHost(action);
}

/** Keeps a no-action round honest: explicit unfinished criteria cannot be marked completed. */
export function resolveNoActionLoopStatus(
  verifierStatus: LoopTerminationStatus,
  hasExplicitAcceptanceCriteria: boolean
): LoopTerminationStatus {
  if (verifierStatus === 'completed') return 'completed';
  if (hasExplicitAcceptanceCriteria) {
    return verifierStatus === 'blocked' ? 'blocked' : 'needs_decision';
  }
  return 'completed';
}