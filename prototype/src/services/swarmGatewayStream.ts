/**
 * Task B3a/C1: Swarm 生产版流式对话通道。
 *
 * 与主 Agent Loop 的调度口径一致（优先级）：New-API 渠道直连 -> Gateway v2 多账号 -> v1 Provider 目录。
 * SSE 流式消费：content/reasoning 增量、[DONE]/finish_reason 终结。
 */
import type { SwarmRoleStream } from '../types/contracts';
import { resolveCanonicalChannelEndpoint } from '../types/contracts';
import {
  buildModelCatalogEntry as buildModelCatalogEntryFn,
  resolveModelRoute as resolveModelRouteFn,
  buildGatewayRequestBody as buildGatewayRequestBodyFn,
  parseGatewayEvent as parseGatewayEventFn,
} from './modelGateway';
import type { GatewayMessage } from './gateway/transform';
import type { ModelAdapter, ProviderRecord } from './modelGateway';
import type { GatewayPlatform } from './gateway/types';
import type { ChannelItem } from '../types/contractsTypes';

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

/** ── 生产版 streamChat：复用宿主网关（渠道直连 -> Gateway v2 -> v1 Provider）+ SSE 流式解析 ── */

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

/** 生产版流式对话实现：与主 Agent Loop 的调度口径一致（渠道直连优先，Gateway v2 次之，v1 Provider 兜底）。 */
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
      const baseUrl = channel.baseUrl.trim();
      const targetModel = channel.modelMapping?.[model.id] || model.id;
      const fullEndpoint = resolveCanonicalChannelEndpoint(baseUrl, channel.type);
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
      let detail = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) detail = `HTTP ${response.status}: ${errJson.error.message}`;
        else if (errJson?.msg) detail = `HTTP ${response.status}: ${errJson.msg}`;
        else if (errJson?.message) detail = `HTTP ${response.status}: ${errJson.message}`;
      } catch (_) {}
      throw new Error(detail);
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
    const cleanCheck = full.trim();
    const isServerBusyMessage = cleanCheck.length > 0 && cleanCheck.length < 150 && /server is busy|server is overloaded|服务器繁忙|服务繁忙|系统繁忙|try again later/i.test(cleanCheck);
    if (isServerBusyMessage) {
      throw new Error(`上游模型服务商当前负载过高提示: "${cleanCheck}"。请稍后重试。`);
    }
    return full;
  };
}
