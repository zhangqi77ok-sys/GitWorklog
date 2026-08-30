/**
 * WP-E 模块六：Master 纠偏的纯规则引擎 —— 角色 × 路径前缀越界判定。
 * 越界动作返回结构化干预指令（不抛异常，引导 Subagent 自愈）。
 */
export interface RoleBoundary {
  role: string;
  allowedPrefixes: string[];
}

export const DEFAULT_ROLE_BOUNDARIES: RoleBoundary[] = [
  { role: 'frontend', allowedPrefixes: ['src/', 'prototype/src/', 'ui/', 'app/', 'web/'] },
  { role: 'backend', allowedPrefixes: ['server/', 'backend/', 'api/', 'src-desktop/', 'src-tauri/', 'tests/'] },
  { role: 'architect', allowedPrefixes: ['docs/', 'design/', 'specs/', '*.md'] },
  { role: 'planner', allowedPrefixes: ['docs/', 'design/', '*.md'] },
  { role: 'qa', allowedPrefixes: ['tests/', 'test/', 'e2e/', 'specs/'] },
  { role: 'reviewer', allowedPrefixes: ['docs/', '*.md'] },
  { role: 'dba', allowedPrefixes: ['db/', 'migrations/', 'database/'] },
  { role: 'product_manager', allowedPrefixes: ['docs/', '*.md'] },
  { role: 'ui_designer', allowedPrefixes: ['src/', 'prototype/src/', 'ui/'] },
  { role: 'coder', allowedPrefixes: ['src/', 'prototype/src/', 'server/', 'backend/', 'src-desktop/', 'tests/'] }
];

export interface ActionViolation {
  role: string;
  actionType: string;
  path: string;
  allowed: boolean;
  reason?: string;
  intervention?: string;
}

const WRITE_ACTIONS = new Set(['write_file', 'write', 'edit', 'delete', 'remove', 'rename', 'patch']);

/**
 * Evaluate a subagent action against its role boundary.
 * - write-like actions must fall inside the role's allowed prefixes;
 * - read/run actions are not boundary-restricted (info flows freely);
 * - unknown roles default to allowed (fail-open for custom roles).
 */
export function evaluateSubagentAction(
  role: string,
  actionType: string,
  path: string,
  boundaries: RoleBoundary[] = DEFAULT_ROLE_BOUNDARIES
): ActionViolation {
  if (!WRITE_ACTIONS.has(actionType)) {
    return { role, actionType, path, allowed: true };
  }
  const boundary = boundaries.find(b => b.role === role);
  if (!boundary) {
    return { role, actionType, path, allowed: true };
  }
  const normPath = path.replace(/\\/g, '/');
  const allowed = boundary.allowedPrefixes.some(prefix => {
    const p = prefix.replace(/\\/g, '/');
    if (p.endsWith('*')) {
      return normPath.endsWith(p.slice(0, -1)) || normPath.includes(p.slice(0, -1));
    }
    return normPath === p || normPath.startsWith(p);
  });
  if (allowed) {
    return { role, actionType, path, allowed: true };
  }
  const intervention = `【Master 纠偏】: 越权操作已拦截 — ${role} Agent 仅允许修改 ${boundary.allowedPrefixes.join('、')}，请立即终止当前修改并回归职责范围！`;
  return {
    role,
    actionType,
    path,
    allowed: false,
    reason: `越权: ${role} 尝试修改 ${path}`,
    intervention
  };
}
