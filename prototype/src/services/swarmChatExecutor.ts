/**
 * Task B2/C1: Swarm 真并发多角色执行器（Master 动态组队）。
 *
 * 协议（结构化）：
 *   1. Master 拆解：一次 LLM 调用返回 JSON { planning, roles[] }，Master 按任务
 *      从角色目录动态挑选 2~4 个 Subagent（不预先固定）；
 *   2. 多角色并发：只对选中的角色各发起独立流式调用（Promise.allSettled），逐字回调；
 *   3. Master 终审：汇总实际选中角色的产出做质量仲裁与交付。
 * 解析/校验失败（非 JSON、未知角色、数量越界）→ 显式抛错，fail-closed，不静默回退。
 * 依赖注入 streamChat（生产接宿主网关，测试用 mock），单角色失败不阻塞其余角色。
 */
import type { SwarmChatState } from '../types/contracts';
import type { SwarmRoleStream } from '../types/contracts';
import type { StreamChatFn } from './swarmGatewayStream';

/** Subagent 角色目录：Master 按任务动态挑选 2~4 个执行。 */
export const SWARM_ROLE_CATALOG: readonly SwarmRoleStream[] = [
  { id: 'architect', name: '系统架构师', icon: '📐', duty: '领域建模、接口契约与依赖分析', content: '', status: 'running' },
  { id: 'dev', name: '核心开发工程师', icon: '💻', duty: '具体算法、业务逻辑与核心代码', content: '', status: 'running' },
  { id: 'tester', name: '质量测试专家', icon: '🧪', duty: '红绿测试用例与边界验证', content: '', status: 'running' },
  { id: 'security', name: '代码审计与安全员', icon: '🛡️', duty: '代码坏味道与安全合规检查', content: '', status: 'running' },
  { id: 'frontend', name: '前端工程师', icon: '🎨', duty: 'React/TS 界面与交互实现', content: '', status: 'running' },
  { id: 'backend', name: '后端工程师', icon: '⚙️', duty: '服务端/API/数据访问实现', content: '', status: 'running' },
  { id: 'dba', name: '数据库专家', icon: '💾', duty: '表结构、迁移与查询优化', content: '', status: 'running' },
  { id: 'docs', name: '技术文档写手', icon: '📝', duty: '文档、交接与使用说明', content: '', status: 'running' },
];

export interface SwarmChatInput {
  userGoal: string;
  contextSnapshotMarkdown: string;
  modelId: string;
  signal?: AbortSignal;
  streamChat: StreamChatFn;
}

export interface SwarmChatCallbacks {
  onMasterPlanning: (planning: string) => void;
  /** Master 拆解流式增量（逐字）。 */
  onMasterPlanningDelta?: (delta: string) => void;
  /** Master 拆解完成后，将实际选中的角色（初始 running 态）投影到前端。 */
  onRolesSelected: (roles: SwarmRoleStream[]) => void;
  onRoleStatus: (roleId: string, status: 'running' | 'passed' | 'error', error?: string) => void;
  onRoleDelta: (roleId: string, delta: string) => void;
  onMasterSummary: (summary: string) => void;
  /** Master 终审流式增量（逐字）。 */
  onMasterSummaryDelta?: (delta: string) => void;
}

const MASTER_SYSTEM = `你是 Tcode 桌面 IDE 的 Swarm Master 协同调度中枢。
你的职责：
1. 拆解任务：分析用户目标与工程上下文，产出清晰的多角色分工规划；
2. 动态组队：从角色目录中按任务实际需要挑选 2~4 个 Subagent（不要贪多，够用即可）；
3. 终审交付：对全部 Subagent 产出做质量仲裁，输出最终交付总结。`;

/** Master 拆解提示词：要求严格 JSON 输出，携带角色目录供选择。 */
function buildPlanningPrompt(input: SwarmChatInput): string {
  const catalogLines = SWARM_ROLE_CATALOG.map(r => `- ${r.id}: ${r.name}（${r.duty}）`).join('\n');
  return `【用户目标】: ${input.userGoal}

【工程上下文】:
${input.contextSnapshotMarkdown || '（无额外上下文）'}

【可选角色目录】:
${catalogLines}

请输出严格 JSON（不要输出任何其它内容或 Markdown 围栏）:
{
  "planning": "任务拆解与分工规划（Markdown 文本）",
  "roles": ["architect", "dev", "..."]
}
规则：
- roles 从上述目录中按任务需要挑选 2~4 个，元素必须严格等于目录中的 id；
- 不要选择与任务无关的角色；不确定时优先选架构 + 实现类角色。`;
}

/** 解析 Master 拆解输出：提取 JSON 并校验角色合法性（fail-closed）。 */
export function parseDecomposition(raw: string): { planning: string; roleIds: string[] } {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Master 拆解未返回有效 JSON');
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Master 拆解 JSON 解析失败');
  }
  const obj = parsed as { planning?: unknown; roles?: unknown };
  if (typeof obj.planning !== 'string' || !Array.isArray(obj.roles)) {
    throw new Error('Master 拆解缺少 planning 或 roles 字段');
  }
  const roleIds = obj.roles.filter((r): r is string => typeof r === 'string');
  const catalogIds = new Set(SWARM_ROLE_CATALOG.map(r => r.id));
  const unknown = roleIds.filter(id => !catalogIds.has(id));
  if (unknown.length > 0) {
    throw new Error(`Master 拆解包含未知角色: ${unknown.join(', ')}`);
  }
  const unique = [...new Set(roleIds)];
  if (unique.length < 2 || unique.length > 4) {
    throw new Error(`Master 拆解角色数量需为 2~4 个，当前 ${unique.length} 个`);
  }
  return { planning: obj.planning.trim(), roleIds: unique };
}

/** 角色系统提示词：定义该角色的专业职责与输出规范。 */
function buildRoleSystemPrompt(role: SwarmRoleStream): string {
  return `你是 Tcode 研发团队中的 Subagent「${role.name}」(${role.icon})。
职责: ${role.duty || ''}
请严格围绕你的专业角色给出高质量输出；不要扮演其他角色。`;
}

/** 角色任务提示词：携带用户目标与全局上下文。 */
function buildRolePrompt(input: SwarmChatInput, role: SwarmRoleStream): string {
  return `【用户目标】: ${input.userGoal}

【工程上下文】:
${input.contextSnapshotMarkdown || '（无额外上下文）'}

作为「${role.name}」，请给出你的专业分析与产出。`;
}

/** Master 终审提示词：汇总实际选中角色的产出做质量仲裁与交付。 */
function buildSummaryPrompt(input: SwarmChatInput, roles: SwarmRoleStream[]): string {
  const roleBlocks = roles
    .map(r => `### ${r.icon} [${r.name}]${r.status === 'error' ? `（执行失败: ${r.error || '未知错误'}）` : ''}\n${r.content}`)
    .join('\n\n');
  return `【用户目标】: ${input.userGoal}

【各 Subagent 产出】:
${roleBlocks}

请作为 Master 终审：仲裁各角色产出质量，指出分歧与风险，并输出最终交付总结。`;
}

/** 运行一次 Master 动态组队的真并发 Swarm 协同，返回结构化最终状态。 */
export async function runSwarmChat(
  input: SwarmChatInput,
  callbacks: SwarmChatCallbacks,
): Promise<SwarmChatState> {
  // ── Phase 1: Master 拆解 + 动态组队 ──
  const raw = await input.streamChat({
    system: MASTER_SYSTEM,
    user: buildPlanningPrompt(input),
    modelId: input.modelId,
    signal: input.signal,
    onDelta: (delta) => callbacks.onMasterPlanningDelta?.(delta),
  });
  const { planning, roleIds } = parseDecomposition(raw);
  callbacks.onMasterPlanning(planning);

  const selectedRoles: SwarmRoleStream[] = roleIds.map(id => {
    const def = SWARM_ROLE_CATALOG.find(r => r.id === id)!;
    return { ...def, content: '', status: 'running' as const };
  });
  callbacks.onRolesSelected(selectedRoles);

  // ── Phase 2: 只对选中角色真并发（失败角色不阻塞其余） ──
  await Promise.allSettled(
    selectedRoles.map(async role => {
      try {
        const full = await input.streamChat({
          system: buildRoleSystemPrompt(role),
          user: buildRolePrompt(input, role),
          modelId: input.modelId,
          signal: input.signal,
          onDelta: (delta) => {
            role.content += delta;
            callbacks.onRoleDelta(role.id, delta);
          },
        });
        role.content = full;
        role.status = 'passed';
        callbacks.onRoleStatus(role.id, 'passed');
      } catch (err) {
        role.status = 'error';
        role.error = err instanceof Error ? err.message : String(err);
        callbacks.onRoleStatus(role.id, 'error', role.error);
      }
    }),
  );

  // ── Phase 3: Master 终审（一次性返回总结） ──
  const masterSummary = await input.streamChat({
    system: MASTER_SYSTEM,
    user: buildSummaryPrompt(input, selectedRoles),
    modelId: input.modelId,
    signal: input.signal,
    onDelta: (delta) => callbacks.onMasterSummaryDelta?.(delta),
  });
  callbacks.onMasterSummary(masterSummary);

  return { phase: 'done' as const, masterPlanning: planning, roles: selectedRoles, masterSummary };
}
