import type { ActionResult, PermissionPolicy } from '../types/contracts';

export type AgentActionType = 'write_file' | 'run_command';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  target: string;
  code: string;
  isHighRisk: boolean;
}

export type ActionExecutionStatus = ActionResult['status'];

type ActionResultDetails = Omit<ActionResult, 'actionId' | 'type' | 'target' | 'status'>;

const COMMAND_FENCE_LANGUAGE = 'run_command';

const HIGH_RISK_COMMAND = /\b(git\s+push|git\s+reset\s+--hard|git\s+clean|rm\s+-rf|remove-item|del\s+\/f|drop\s+(?:table|database|schema)|format-volume|format\s+[a-z]:|mkfs)\b/i;
const HIGH_RISK_FILE = /(?:^|[\\/])(?:\.env(?:\.|$)|package\.json|package-lock\.json|\.git)(?:[\\/]|$)/i;

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
    return {
      id: `action-${index}-write_file-${actionContentHash(`${normalizedLanguage}\u0000${code}`)}`,
      type: 'write_file',
      target,
      code,
      isHighRisk: HIGH_RISK_FILE.test(target)
    };
  }

  if (normalizedLanguage.toLowerCase() !== COMMAND_FENCE_LANGUAGE || !code.trim()) return null;
  return {
    id: `action-${index}-run_command-${actionContentHash(`${normalizedLanguage}\u0000${code}`)}`,
    type: 'run_command',
    target: code.trim().split('\n')[0].slice(0, 80),
    code,
    isHighRisk: HIGH_RISK_COMMAND.test(code)
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

/** High-risk actions are never covered by a prior low-risk session authorization. */
export function shouldRequireActionApproval(
  policy: PermissionPolicy,
  action: AgentAction,
  allowLowRiskInSession: boolean
): boolean {
  if (policy === 'strict_approval') return true;
  if (action.isHighRisk) return true;
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
