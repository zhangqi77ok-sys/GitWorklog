import { AccountRegistry } from './accounts';
import { DownstreamKeyStore } from './keys';
import { UsageLedger } from './usage';
import { createSchedulerState } from './scheduler';
import { GatewayFacade } from './gateway';
import { loadGatewayState, saveGatewayState } from './store';
import { resolveApiEndpoint, type AIModelOption } from '../../types/contracts';
import type { DownstreamKey, GatewayAccount, SchedulerState, UsageRecord } from './types';

export interface GatewayRuntime {
  facade: GatewayFacade;
  registry: AccountRegistry;
  keys: DownstreamKeyStore;
  ledger: UsageLedger;
  scheduler: SchedulerState;
  persist: () => void;
}

const APP_CLIENT_KEY_NAME = 'Tcode 默认客户端';

function resolveProxy(targetUrl: string): { url: string; headers: Record<string, string> } {
  if (typeof window !== 'undefined' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
    // Desktop host: proxy upstream calls through /api/proxy (UA/SSE handled there).
    return resolveApiEndpoint(targetUrl);
  }
  return { url: targetUrl, headers: {} };
}

function createRuntime(): GatewayRuntime {
  const state = loadGatewayState();
  const registry = new AccountRegistry(state?.accounts ?? []);
  const keys = new DownstreamKeyStore(state?.keys ?? []);
  const ledger = new UsageLedger(state?.usage ?? []);
  const scheduler: SchedulerState = state?.scheduler ?? createSchedulerState();

  // Bootstrap the app's own client key once (key distribution demo + app traffic).
  if (keys.list().length === 0) {
    keys.issue({ name: APP_CLIENT_KEY_NAME, groups: ['default'] });
  }

  const facade = new GatewayFacade({ registry, schedulerState: scheduler, keys, ledger, resolveProxy });
  const persist = () => {
    saveGatewayState({ accounts: registry.all(), keys: keys.list(), usage: ledger.list(), scheduler });
  };
  return { facade, registry, keys, ledger, scheduler, persist };
}

export let gatewayRuntime: GatewayRuntime = createRuntime();

export function resetGatewayRuntime(): GatewayRuntime {
  gatewayRuntime = createRuntime();
  return gatewayRuntime;
}

export function persistGatewayRuntime(): void {
  gatewayRuntime.persist();
}

/** Map a v1 model option (providerId) to the gateway platform it should route through. */
export function platformForProvider(providerId?: string, modelId?: string): GatewayAccount['platform'] {
  if (!providerId) return 'openai-compatible';
  if (providerId.includes('opencode')) return 'openai-compatible';
  if (providerId.includes('codex')) return 'codex';
  if (providerId.includes('grok')) return 'grok';
  if (providerId.includes('gemini')) return 'gemini';
  if (providerId.includes('deepseek')) return 'deepseek';
  if (providerId.includes('claude') || providerId.includes('anthropic') || modelId?.includes('claude')) return 'claude';
  if (providerId.includes('openai')) return 'openai';
  if (providerId.includes('ollama') || providerId.includes('lmstudio')) return 'local';
  return 'openai-compatible';
}

/** v1 model id -> gateway model id (same id unless platform needs renaming). */
export function gatewayModelId(platform: GatewayAccount['platform'], modelId: string): string {
  return modelId;
}

export const DEFAULT_PLATFORM_MODELS: Partial<Record<GatewayAccount['platform'], string[]>> = {
  codex: ['gpt-5.1-codex', 'gpt-5-codex', 'gpt-5'],
  claude: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  grok: ['grok-4.6', 'grok-4.5'],
  gemini: ['gemini-3-pro', 'gemini-3-flash'],
  openai: ['gpt-5.1-codex', 'gpt-5', 'gpt-4o'],
  deepseek: ['deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
  'openai-compatible': ['mimo-v2.5-free', 'deepseek-v4-flash'],
  local: []
};

/** Models exposed by enabled gateway accounts, merged into the chat model picker. */
export function getGatewayModelOptions(): AIModelOption[] {
  const options: AIModelOption[] = [];
  for (const platform of Object.keys(DEFAULT_PLATFORM_MODELS) as GatewayAccount['platform'][]) {
    const accounts = gatewayRuntime.registry.byPlatform(platform).filter(a => a.enabled);
    if (accounts.length === 0) continue;
    const modelIds = Array.from(new Set(accounts.flatMap(a => a.models.length > 0 ? a.models : DEFAULT_PLATFORM_MODELS[platform] ?? [])));
    for (const model of modelIds) {
      options.push({
        id: model,
        name: model,
        provider: 'DeepSeek' as AIModelOption['provider'],
        providerId: `provider-${platform}`,
        uniqueKey: `gateway:${platform}:${model}`,
        contextLimit: 128000,
        inputPricePerM: 0,
        outputPricePerM: 0,
        badge: `🧭 网关·${accounts.length}账号`,
        description: `Model Gateway v2 · ${platform} 多账号智能调度 (${accounts.map(a => a.label).join(', ')})`
      });
    }
  }
  return options;
}

export function hasGatewayAccountsFor(platform: GatewayAccount['platform']): boolean {
  return gatewayRuntime.registry.byPlatform(platform).some(a => a.enabled);
}

// Re-export for UI convenience
export type { GatewayAccount, DownstreamKey, UsageRecord };

