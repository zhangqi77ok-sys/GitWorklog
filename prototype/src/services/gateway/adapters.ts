import type { GatewayAccount, GatewayPlatform } from './types';

export interface UpstreamRequestSpec {
  url: string;
  headers: Record<string, string>;
}

export type GatewayAdapter = 'openai-responses' | 'anthropic-messages' | 'openai-compatible-chat';

const ANTHROPIC_VERSION = '2023-06-01';

export function adapterFor(platform: GatewayPlatform): GatewayAdapter {
  if (platform === 'codex') return 'openai-responses';
  if (platform === 'claude') return 'anthropic-messages';
  return 'openai-compatible-chat';
}

/**
 * Builds the upstream HTTP request (URL + auth headers) for an account.
 * Business/body shaping happens in RequestTransformer; this only decides
 * the transport surface (endpoint path + credential headers).
 */
export function buildUpstreamRequest(
  account: GatewayAccount,
  _body: Record<string, unknown>
): UpstreamRequestSpec {
  const base = account.baseUrl.replace(/\/+$/, '');
  const credential = account.credential;

  switch (account.platform) {
    case 'codex': {
      const headers: Record<string, string> = {};
      if (account.authType === 'api_key') {
        headers.Authorization = `Bearer ${credential.apiKey ?? ''}`;
      } else {
        headers.Authorization = `Bearer ${credential.accessToken ?? ''}`;
      }
      if (credential.cookie) headers.Cookie = credential.cookie;
      return { url: `${base}/responses`, headers };
    }
    case 'claude': {
      const headers: Record<string, string> = {
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      };
      if (account.authType === 'api_key') {
        headers['x-api-key'] = credential.apiKey ?? '';
      } else {
        headers.Authorization = `Bearer ${credential.accessToken ?? ''}`;
      }
      if (credential.orgId) headers['anthropic-organization'] = credential.orgId;
      return { url: `${base}/messages`, headers };
    }
    default: {
      const headers: Record<string, string> = {};
      const secret = account.authType === 'api_key' ? (credential.apiKey ?? '') : (credential.accessToken ?? '');
      if (secret) headers.Authorization = `Bearer ${secret}`;
      return { url: `${base}/chat/completions`, headers };
    }
  }
}
