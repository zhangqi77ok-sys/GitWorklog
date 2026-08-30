import type { AccountAuthType, GatewayPlatform } from './types';
import { DEFAULT_BASE_URLS } from './accounts';
import { OAUTH_ENDPOINTS, buildAuthorizeUrl } from './oauth';

export type CredentialFieldKey =
  | 'apiKey' | 'accessToken' | 'refreshToken' | 'setupToken' | 'orgId' | 'cookie';

export interface ProviderFieldDef {
  key: CredentialFieldKey;
  label: string;
  type: 'text' | 'password' | 'number';
  required?: boolean;
  placeholder?: string;
  help?: string;
}

export interface ProviderAuthTypeDef {
  id: AccountAuthType;
  label: string;
  description?: string;
  fields: ProviderFieldDef[];
}

export interface ProviderSchema {
  platform: GatewayPlatform;
  label: string;
  icon: string;
  hint: string;
  defaultBaseUrl: string;
  /** Per-platform, independent config items (opencode = api_key only; local = none). */
  authTypes: ProviderAuthTypeDef[];
  oauthAuthorizeUrl?: string;
  isLocal?: boolean;
}

const apiKeyField: ProviderFieldDef = { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' };
const accessTokenField: ProviderFieldDef = { key: 'accessToken', label: 'Access Token', type: 'password', required: true, placeholder: 'access token' };
const refreshTokenField: ProviderFieldDef = { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: true, placeholder: 'refresh token' };
const setupTokenField: ProviderFieldDef = { key: 'setupToken', label: 'Setup Token', type: 'password', placeholder: 'setup token' };
const orgIdField: ProviderFieldDef = { key: 'orgId', label: 'Org ID', type: 'text', placeholder: 'org_...' };
const cookieField: ProviderFieldDef = { key: 'cookie', label: 'Cookie', type: 'password', placeholder: 'session cookie' };

const apiKeyAuth: ProviderAuthTypeDef = { id: 'api_key', label: 'API Key', description: '官方 API Key', fields: [apiKeyField] };
const oauthAuth = (extra: ProviderFieldDef[] = []): ProviderAuthTypeDef => ({
  id: 'oauth',
  label: 'OAuth 完整',
  description: 'OAuth 授权，需 Access + Refresh Token',
  fields: [accessTokenField, refreshTokenField, ...extra]
});
const refreshTokenAuth: ProviderAuthTypeDef = {
  id: 'refresh_token',
  label: 'RT 手动',
  description: 'Refresh Token 手动授权',
  fields: [accessTokenField, refreshTokenField]
};
const setupTokenAuth: ProviderAuthTypeDef = {
  id: 'setup_token',
  label: 'Setup Token',
  description: 'Claude Code 推理 Token',
  fields: [setupTokenField]
};

function oauthUrl(platform: GatewayPlatform): string | undefined {
  if (!OAUTH_ENDPOINTS[platform]) return undefined;
  return buildAuthorizeUrl(platform, { clientId: 'tcode-app', redirectUri: 'http://127.0.0.1:8010/oauth/callback' });
}

export const PROVIDER_SCHEMAS: Record<GatewayPlatform, ProviderSchema> = {
  opencode: {
    platform: 'opencode', label: 'OpenCode', icon: '⚡', hint: 'API Key',
    defaultBaseUrl: DEFAULT_BASE_URLS.opencode,
    authTypes: [apiKeyAuth]
  },
  codex: {
    platform: 'codex', label: 'Codex', icon: '⌘', hint: 'OAuth / RT / Key',
    defaultBaseUrl: DEFAULT_BASE_URLS.codex,
    authTypes: [apiKeyAuth, oauthAuth(), refreshTokenAuth],
    oauthAuthorizeUrl: oauthUrl('codex')
  },
  claude: {
    platform: 'claude', label: 'Claude', icon: '◈', hint: 'OAuth / Key / Setup',
    defaultBaseUrl: DEFAULT_BASE_URLS.claude,
    authTypes: [apiKeyAuth, oauthAuth([orgIdField]), setupTokenAuth],
    oauthAuthorizeUrl: oauthUrl('claude')
  },
  grok: {
    platform: 'grok', label: 'Grok', icon: '✕', hint: 'OAuth / RT / Key',
    defaultBaseUrl: DEFAULT_BASE_URLS.grok,
    authTypes: [apiKeyAuth, oauthAuth(), refreshTokenAuth],
    oauthAuthorizeUrl: oauthUrl('grok')
  },
  gemini: {
    platform: 'gemini', label: 'Gemini', icon: '✦', hint: 'OAuth / Key',
    defaultBaseUrl: DEFAULT_BASE_URLS.gemini,
    authTypes: [apiKeyAuth, oauthAuth()]
  },
  openai: {
    platform: 'openai', label: 'OpenAI', icon: '◎', hint: 'OAuth / Key',
    defaultBaseUrl: DEFAULT_BASE_URLS.openai,
    authTypes: [apiKeyAuth, oauthAuth()]
  },
  deepseek: {
    platform: 'deepseek', label: 'DeepSeek', icon: '⌬', hint: 'API Key',
    defaultBaseUrl: DEFAULT_BASE_URLS.deepseek,
    authTypes: [apiKeyAuth]
  },
  'openai-compatible': {
    platform: 'openai-compatible', label: 'OpenAI 兼容', icon: '⇄', hint: 'API Key',
    defaultBaseUrl: DEFAULT_BASE_URLS['openai-compatible'],
    authTypes: [apiKeyAuth]
  },
  local: {
    platform: 'local', label: '本地', icon: '▣', hint: '免 Key',
    defaultBaseUrl: DEFAULT_BASE_URLS.local,
    authTypes: [],
    isLocal: true
  }
};

export function getProviderSchema(platform: GatewayPlatform): ProviderSchema {
  return PROVIDER_SCHEMAS[platform];
}

/** Resolve an auth-type label from any platform schema (used for badges). */
export function authTypeLabel(authType: AccountAuthType): string {
  for (const schema of Object.values(PROVIDER_SCHEMAS)) {
    const found = schema.authTypes.find(t => t.id === authType);
    if (found) return found.label;
  }
  return authType;
}