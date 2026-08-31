/**
 * Task B2: Swarm 真并发多角色执行器。
 *
 * 三段式编排（结构化协议）：
 *   1. Master 拆解：一次 LLM 调用产出全局规划；
 *   2. 多角色并发：固定 4 角色（架构/开发/测试/安全）各自独立流式调用 LLM，逐字回调；
 *   3. Master 终审：汇总全部角色产物做质量仲裁并交付。
 * 依赖注入 streamChat（生产接宿主网关，测试用 mock），单角色失败不阻塞其余角色。
 */
import type { SwarmChatState, SwarmRoleStream } from '../types/contracts';
import {
  buildModelCatalogEntry as buildModelCatalogEntryFn,
  resolveModelRoute as resolveModelRouteFn,
  buildGatewayRequestBody as buildGatewayRequestBodyFn,
  parseGatewayEvent as parseGatewayEventFn,
} from './modelGateway';
import type { GatewayMessage } from './gateway/transform';
import type { ChannelItem } from '../types/contractsTypes';
import type { ModelAdapter, ProviderRecord } from './modelGateway';
import type { GatewayPlatform } from './gateway/types';

/** 固定四角色目录（v1 不做动态角色选取，KISS）。 */
export const SWARM_ROLES: readonly SwarmRoleStream[] = [
  { id: 'architect', name: '系统架构师', icon: '📐', duty: '领域建模、接口契约与依赖分析', content: '', status: 'running' },
  { id: 'dev', name: '核心开发工程师', icon: '💻', duty: '具体算法、业务逻辑与核心代码', content: '', status: 'running' },
  { id: 'qa', name: '质量测试专家', icon: '🧪', duty: '红绿测试用例与边界验证', content: '', status: 'running' },
  { id: 'security', name: '代码审计与安全员', icon: '🛡️', duty: '代码坏味道审查与安全合规检查', content: '', status: 'running' },
];

export interface StreamChatRequest {
  system: string;
  user: string;
  modelId: string;
  signal?: AbortSignal;
  /** 增量文本回调（用于角色流式渲染）。 */
  onDelta: (delta: string) => void;
}

/** 可注入的流式对话调用；返回完整文本。 */
export type StreamChatFn = (req: StreamChatRequest) => Promise<string>;

export interface SwarmChatInput {
  userGoal: string;
  contextSnapshotMarkdown: string;
  modelId: string;
  signal?: AbortSignal;
  streamChat: StreamChatFn;
}

export interface SwarmChatCallbacks {
  onMasterPlanning: (planning: string) => void;
  onRoleStatus: (roleId: string, status: 'running' | 'passed' | 'error', error?: string) => void;
  onRoleDelta: (roleId: string, delta: string) => void;
  onMasterSummary: (summary: string) => void;
}

const MASTER_SYSTEM = `你是 Tcode 桌面 IDE 的 Swarm Master 协同调度中枢。
你负责全局任务拆解与终审交付：先给出清晰可执行的多角色分工规划；
终审时对架构、开发、测试、安全四个角色的产出做质量仲裁，并给出最终交付总结。
输出使用简洁 Markdown。`;

/** Master 拆解阶段提示词：产出分工规划，不要求输出角色标记（角色由执行器实例化）。 */
function buildPlanningPrompt(input: SwarmChatInput): string {
  return `【用户目标】: ${input.userGoal}

【工程上下文】:
${input.contextSnapshotMarkdown || '（无额外上下文）'}

请作为 Master 拆解该目标：明确验收标准、依赖关系，并分配架构/开发/测试/安全四个子角色的任务边界。`;
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

/** Master 终审提示词：汇总四个角色产出做质量仲裁与交付。 */
function buildSummaryPrompt(input: SwarmChatInput, roles: SwarmRoleStream[]): string {
  const roleBlocks = roles
    .map(r => `### ${r.icon} [${r.name}]${r.status === 'error' ? `（执行失败: ${r.error || '未知错误'}）` : ''}\n${r.content}`)
    .join('\n\n');
  return `【用户目标】: ${input.userGoal}

【各 Subagent 产出】:
${roleBlocks}

请作为 Master 终审：仲裁各角色产出质量，指出分歧与风险，并输出最终交付总结。`;
}

/** 运行一次真并发 Swarm 协同，返回结构化最终状态。 */
export async function runSwarmChat(
  input: SwarmChatInput,
  callbacks: SwarmChatCallbacks,
): Promise<SwarmChatState> {
  const roles: SwarmRoleStream[] = SWARM_ROLES.map(r => ({ ...r, content: '', status: 'running' as const }));

  // ── Phase 1: Master 拆解（一次性返回规划） ──
  const masterPlanning = await input.streamChat({
    system: MASTER_SYSTEM,
    user: buildPlanningPrompt(input),
    modelId: input.modelId,
    signal: input.signal,
    onDelta: () => {},
  });
  callbacks.onMasterPlanning(masterPlanning);

  // ── Phase 2: 多角色真并发（失败角色不阻塞其余） ──
  await Promise.allSettled(
    SWARM_ROLES.map(async (roleDef, i) => {
      const role = roles[i];
      try {
        const full = await input.streamChat({
          system: buildRoleSystemPrompt(roleDef),
          user: buildRolePrompt(input, roleDef),
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
    user: buildSummaryPrompt(input, roles),
    modelId: input.modelId,
    signal: input.signal,
    onDelta: () => {},
  });
  callbacks.onMasterSummary(masterSummary);

  return { masterPlanning, roles, masterSummary };
}

/** ── 生产版 streamChat：复用宿主网关（Gateway v2 -> v1 Provider 兜底）+ SSE 流式解析 ── */

export interface GatewayStreamChatDeps {
  streamingModel: {
    id: string; name: string; providerId?: string; uniqueKey?: string;
    adapter?: string; endpointPath?: string; protocol?: string;
    contextLimit?: number; capabilities?: unknown;
  };
  sessionKey: string;
  gatewayRuntime: { facade: { prepare: (opts: {
    model: string; platform: GatewayPlatform; sessionKey: string;
    messages: GatewayMessage[];
    systemPrompt: string; contextLimit: number; defaultMaxOutputTokens: number;
  }) => { url: string; headers: Record<string, string>; body: unknown; adapter: ModelAdapter; accountId: string } | null } };
  hasGatewayAccountsFor: (platform: GatewayPlatform) => boolean;
  platformForProvider: (providerId: string, modelId: string) => GatewayPlatform;
  loadSavedProviders: () => Array<Record<string, any>>;
  loadSavedChannels: () => ChannelItem[];
  buildModelCatalogEntry: typeof buildModelCatalogEntryFn;
  resolveModelRoute: typeof resolveModelRouteFn;
  buildGatewayRequestBody: typeof buildGatewayRequestBodyFn;
  parseGatewayEvent: typeof parseGatewayEventFn;
  resolveApiEndpoint: (endpointUrl: string) => { url: string; headers: Record<string, string> };
  addLog: (level: 'INFO' | 'WARN' | 'ERROR' | 'NET', module: string, message: string) => void;
}

/** 生产版流式对话实现：与主 Agent Loop 的调度口径一致（Gateway v2 优先，v1 Provider 兜底）。 */
export function createGatewayStreamChat(deps: GatewayStreamChatDeps): StreamChatFn {
  const model = deps.streamingModel;
  return async (req: StreamChatRequest): Promise<string> => {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ];

    let url: string;
    let headers: Record<string, string>;
    let body: string;
    let adapter: ModelAdapter = (model.adapter as ModelAdapter) || 'openai-compatible-chat';

    // ── Priority 1: New-API Channels 路由（与主 Agent Loop 一致，最高优先级） ──
    const activeChannels = deps.loadSavedChannels().filter(c => c.status === 'active' || c.status === 'untested');
    const channel = activeChannels.find(c => c.id === model.providerId)
      || activeChannels.find(c => (c.models || []).includes(model.id))
      || (model.uniqueKey ? activeChannels.find(c => model.uniqueKey?.startsWith(c.id + ':')) : undefined)
      || activeChannels[0];

    if (channel) {
      // 渠道直连：key 存于渠道配置（与主循环 ChannelRouter 同口径）
      let baseUrl = channel.baseUrl.trim();
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      const targetModel = channel.modelMapping?.[model.id] || model.id;
      const fullEndpoint = baseUrl.endsWith('/chat/completions') || baseUrl.endsWith('/messages')
        ? baseUrl
        : (channel.type === 14 ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`);
      const resolved = deps.resolveApiEndpoint(fullEndpoint);
      url = resolved.url;
      const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...resolved.headers };
      if (channel.key?.trim()) {
        const firstKey = channel.key.trim().split('\n')[0].trim();
        requestHeaders['Authorization'] = `Bearer ${firstKey}`;
      } else if (channel.type !== 4) {
        throw new Error(`渠道 [${channel.name}] 尚未填写 API Key 凭据。请点击左下角 ⚙️ 首选项 ➔「模型服务商」编辑该渠道，填入您的 API Key 即可开始对话。`);
      }
      if (channel.headerOverride) Object.assign(requestHeaders, channel.headerOverride);
      headers = requestHeaders;
      adapter = (channel.type === 14 ? 'anthropic-messages' : 'openai-compatible-chat') as ModelAdapter;
      body = JSON.stringify({ model: targetModel, messages, stream: true, ...(channel.paramOverride || {}) });
      deps.addLog('INFO', 'ChannelRouter', `[Swarm][渠道调度] ${model.name} → 渠道 [${channel.name}] (Key已注入) · ${fullEndpoint}`);
    } else {
      // ── 路由：Gateway v2 多账号优先，无则走 v1 Provider 目录 ──
      const platform = deps.platformForProvider(model.providerId || '', model.id);
      const prepared = deps.hasGatewayAccountsFor(platform)
        ? deps.gatewayRuntime.facade.prepare({
            model: model.id,
            platform,
            sessionKey: deps.sessionKey,
            messages,
            systemPrompt: req.system,
            contextLimit: model.contextLimit || 128000,
            defaultMaxOutputTokens: 4096,
          })
        : null;

      if (prepared) {
        url = prepared.url;
        headers = prepared.headers;
        body = JSON.stringify(prepared.body);
        adapter = prepared.adapter;
        deps.addLog('INFO', 'GatewayV2', `[Swarm] 调度 ${model.name} -> 账号 ${prepared.accountId} · ${prepared.url}`);
      } else {
        const providers = deps.loadSavedProviders();
        const provider = providers.find(p => p.id === model.providerId)
          || providers.find(p => p.enabled && (p.models || []).some((m: any) => m.id === model.id))
          || providers.find(p => p.enabled && p.apiKey && p.baseUrl)
          || providers[0];
        if (!provider) throw new Error('没有可用的模型服务商渠道');
        const catalogModel = (provider.models || []).find((m: any) => m.id === model.id) || {
          id: model.id,
          name: model.name,
          enabled: true,
          contextLimit: model.contextLimit,
          adapter: model.adapter,
          endpointPath: model.endpointPath,
          protocol: model.protocol,
          capabilities: [],
        };
        const providerRec = provider as ProviderRecord;
        const catalogEntry = deps.buildModelCatalogEntry(providerRec, catalogModel);
        const route = deps.resolveModelRoute(providerRec, catalogEntry);
        const resolved = deps.resolveApiEndpoint(route.endpointUrl);
        url = resolved.url;
        headers = resolved.headers;
        body = JSON.stringify(deps.buildGatewayRequestBody(route, messages as GatewayMessage[]));
        adapter = route.adapter || adapter;
        deps.addLog('INFO', 'SwarmGateway', `[Swarm] v1 渠道 ${model.name} · ${route.endpointUrl}`);
      }
    }

    // ── SSE 流式消费（与主 Loop 同口径：content/reasoning 增量、[DONE]/finish_reason 终结） ──
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
      signal: req.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const reader = response.body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder('utf-8');
    let full = '';
    let buffer = '';
    let sawDone = false;
    let sawFinish = false;
    while (!sawDone && !sawFinish) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const raw = trimmed.slice(6).trim();
        if (raw === '[DONE]') {
          sawDone = true;
          break;
        }
        try {
          const normalized = deps.parseGatewayEvent(adapter, JSON.parse(raw));
          if (normalized.content || normalized.reasoning) {
            const chunk = `${normalized.reasoning || ''}${normalized.content || ''}`;
            full += chunk;
            req.onDelta(chunk);
          }
          if (normalized.finished) sawFinish = true;
        } catch (e) {
          throw new Error(`流事件解析失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    return full;
  };
}
