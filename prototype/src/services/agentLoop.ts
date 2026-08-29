import type { ActionResult, PermissionPolicy } from '../types/contracts';

export type AgentActionType = 'write_file' | 'run_command';
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

function getFenceAction(language: string, code: string, index: number): AgentAction | null {
  const normalizedLanguage = language.trim();
  const isWrite = /^(write_file:|file:|create_file:)/i.test(normalizedLanguage);

  if (isWrite) {
    const target = normalizedLanguage.replace(/^(write_file:|file:|create_file:)/i, '').trim();
    if (!target || !code.trim()) return null;
    const isHighRisk = HIGH_RISK_FILE.test(target);
    const riskReason = getRiskReason('write_file', target, code);
    return {
      id: `action-${index}-write_file-${actionContentHash(`${normalizedLanguage}\u0000${code}`)}`,
      type: 'write_file',
      target,
      code,
      isHighRisk,
      riskReason,
      tier: getActionTier('write_file', target, isHighRisk)
    };
  }

  if (normalizedLanguage.toLowerCase() !== COMMAND_FENCE_LANGUAGE || !code.trim()) return null;
  const firstLine = code.trim().split('\n')[0].slice(0, 80);
  const isHighRisk = HIGH_RISK_COMMAND.test(code);
  const riskReason = getRiskReason('run_command', firstLine, code);
  return {
    id: `action-${index}-run_command-${actionContentHash(`${normalizedLanguage}\u0000${code}`)}`,
    type: 'run_command',
    target: firstLine,
    code,
    isHighRisk,
    riskReason,
    tier: getActionTier('run_command', firstLine, isHighRisk)
  };
}

/** Parses only completed supported fenced blocks into the single Agent Loop action model. */
export function parseAgentActions(content: string): AgentAction[] {
  const actions: AgentAction[] = [];
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

/**
 * Scoped trust decision:
 * 1. Blocking high-risk actions ALWAYS require approval regardless of permissions/trust.
 * 2. If a scoped trust pattern matches (e.g. write_file x src/**), bypass modal.
 * 3. In strict_approval, require approval unless scoped-trusted.
 * 4. In autonomous_agent, low-risk actions run automatically.
 */
export function shouldRequireActionApproval(
  policy: PermissionPolicy,
  action: AgentAction,
  scopedTrusts: ActionScopeTrust[] = [],
  allowLowRiskInSession: boolean = false
): boolean {
  // High-risk actions can NEVER be bypassed by any general "allow always" or session flag
  if (action.isHighRisk) return true;

  // Check if covered by scoped trust
  const isScopedTrusted = scopedTrusts.some(trust =>
    (trust.actionType === '*' || trust.actionType === action.type) &&
    matchesGlob(action.target, trust.pathGlob)
  );
  if (isScopedTrusted) return false;

  // Session-level allow low risk
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

/** Produces bounded, factual feedback for the next model iteration. */
export function formatExecutionFeedback(actions: AgentAction[], results: ActionResult[]): string {
  const lines = ['[Tcode Agent 执行引擎反馈]', ''];

  for (const action of actions) {
    const result = getActionResultForId(action.id, results);
    if (!result) continue;

    if (result.status === 'success') {
      if (action.type === 'write_file') {
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

  lines.push('', '请根据以上执行结果决定下一步操作。如果所有任务已完成，请总结变更。');
  return lines.join('\n');
}
