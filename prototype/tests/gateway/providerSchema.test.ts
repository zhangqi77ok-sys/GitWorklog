import { describe, it, expect } from 'vitest';
import { PROVIDER_SCHEMAS, getProviderSchema } from '../../src/services/gateway/providerSchema';
import { DEFAULT_BASE_URLS } from '../../src/services/gateway/accounts';
import type { GatewayPlatform } from '../../src/services/gateway/types';

const ALL_PLATFORMS: GatewayPlatform[] = [
  'codex', 'claude', 'grok', 'gemini', 'openai', 'deepseek', 'opencode', 'openai-compatible', 'local'
];

describe('Dynamic per-provider config schema', () => {
  it('covers every GatewayPlatform and keeps defaultBaseUrl in sync', () => {
    for (const platform of ALL_PLATFORMS) {
      const schema = PROVIDER_SCHEMAS[platform];
      expect(schema, `schema for ${platform}`).toBeDefined();
      expect(schema.platform).toBe(platform);
      expect(schema.defaultBaseUrl).toBe(DEFAULT_BASE_URLS[platform]);
    }
  });

  it('opencode supports ONLY api_key and exposes no OAuth/RT/Setup fields', () => {
    const schema = getProviderSchema('opencode');
    expect(schema.authTypes.map(t => t.id)).toEqual(['api_key']);
    const fieldKeys = schema.authTypes.flatMap(t => t.fields.map(f => f.key));
    expect(fieldKeys).toEqual(['apiKey']);
  });

  it('codex supports api_key + oauth + refresh_token', () => {
    const ids = getProviderSchema('codex').authTypes.map(t => t.id);
    expect(ids).toEqual(['api_key', 'oauth', 'refresh_token']);
  });

  it('claude supports setup_token and its oauth auth includes orgId field', () => {
    const schema = getProviderSchema('claude');
    expect(schema.authTypes.map(t => t.id)).toEqual(['api_key', 'oauth', 'setup_token']);
    const oauth = schema.authTypes.find(t => t.id === 'oauth')!;
    expect(oauth.fields.map(f => f.key)).toContain('orgId');
  });

  it('grok supports api_key + oauth + refresh_token', () => {
    expect(getProviderSchema('grok').authTypes.map(t => t.id)).toEqual(['api_key', 'oauth', 'refresh_token']);
  });

  it('deepseek / openai-compatible support only api_key', () => {
    expect(getProviderSchema('deepseek').authTypes.map(t => t.id)).toEqual(['api_key']);
    expect(getProviderSchema('openai-compatible').authTypes.map(t => t.id)).toEqual(['api_key']);
  });

  it('local requires no credentials (authTypes empty)', () => {
    expect(getProviderSchema('local').authTypes).toEqual([]);
    expect(getProviderSchema('local').isLocal).toBe(true);
  });

  it('every auth type carries at least one credential field', () => {
    for (const platform of ALL_PLATFORMS) {
      for (const auth of PROVIDER_SCHEMAS[platform].authTypes) {
        expect(auth.fields.length, `${platform}:${auth.id} fields`).toBeGreaterThan(0);
      }
    }
  });
});
