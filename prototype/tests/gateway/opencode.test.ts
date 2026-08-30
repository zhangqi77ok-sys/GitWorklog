import { describe, it, expect } from 'vitest';
import { DEFAULT_BASE_URLS } from '../../src/services/gateway/accounts';
import { adapterFor, buildUpstreamRequest } from '../../src/services/gateway/adapters';
import { platformForProvider, DEFAULT_PLATFORM_MODELS } from '../../src/services/gateway/gatewayRuntime';
import { RequestTransformer } from '../../src/services/gateway/transform';
import type { GatewayAccount } from '../../src/services/gateway/types';

const opencodeAccount: GatewayAccount = {
  id: 'acct-opencode-1',
  platform: 'opencode',
  label: 'opencode-zen',
  authType: 'api_key',
  credential: { authType: 'api_key', apiKey: 'sk-opencode-test' },
  baseUrl: DEFAULT_BASE_URLS.opencode,
  enabled: true,
  status: 'active',
  quota: { refreshedAt: 0, limit: 100, used: 0, remaining: 100, windowHours: 24, source: 'unknown' },
  concurrency: { active: 0, max: 4 },
  health: { consecutiveErrors: 0 },
  models: [],
  stickySessionTtlMs: 3_600_000,
  createdAt: 0,
  updatedAt: 0
};

describe('OpenCode platform contract', () => {
  it('platformForProvider maps opencode provider ids to the opencode platform', () => {
    expect(platformForProvider('provider-opencode', 'mimo-v2.5-free')).toBe('opencode');
    expect(platformForProvider('opencode', 'deepseek-v4-flash')).toBe('opencode');
  });

  it('DEFAULT_BASE_URLS.opencode points to OpenCode Go v1', () => {
    expect(DEFAULT_BASE_URLS.opencode).toBe('https://opencode.ai/zen/go/v1');
  });

  it('adapterFor(opencode) uses the OpenAI-compatible chat adapter', () => {
    expect(adapterFor('opencode')).toBe('openai-compatible-chat');
  });

  it('buildUpstreamRequest targets {base}/chat/completions with Bearer auth', () => {
    const spec = buildUpstreamRequest(opencodeAccount, {});
    expect(spec.url).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect(spec.headers.Authorization).toBe('Bearer sk-opencode-test');
  });

  it('RequestTransformer emits a streaming chat_completions body for opencode', () => {
    const t = new RequestTransformer({ platform: 'opencode', codexOAuth: false, contextLimit: 128_000, defaultMaxOutputTokens: 8192 });
    const body = t.transform({
      model: 'mimo-v2.5-free',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true
    }) as Record<string, any>;
    expect(body.stream).toBe(true);
    expect(body.messages).toBeDefined();
    expect(body.input).toBeUndefined();
    expect(body.model).toBe('mimo-v2.5-free');
  });

  it('DEFAULT_PLATFORM_MODELS includes OpenCode Zen models', () => {
    expect(DEFAULT_PLATFORM_MODELS.opencode).toContain('mimo-v2.5-free');
  });
});
