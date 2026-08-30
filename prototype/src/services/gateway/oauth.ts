import type { GatewayPlatform } from './types';

export interface OAuthEndpoint {
  authorizeUrl: string;
  tokenUrl: string;
}

export const OAUTH_ENDPOINTS: Partial<Record<GatewayPlatform, OAuthEndpoint>> = {
  codex: {
    authorizeUrl: 'https://auth.openai.com/authorize',
    tokenUrl: 'https://auth.openai.com/oauth/token'
  },
  claude: {
    authorizeUrl: 'https://claude.ai/oauth/authorize',
    tokenUrl: 'https://platform.claude.com/v1/oauth/token'
  },
  grok: {
    authorizeUrl: 'https://accounts.x.ai/authorize',
    tokenUrl: 'https://api.x.ai/v1/oauth/token'
  }
};

export interface OAuthOptions {
  clientId: string;
  redirectUri?: string;
  scope?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  setup_token?: string;
}

function endpoint(platform: GatewayPlatform): OAuthEndpoint {
  const ep = OAUTH_ENDPOINTS[platform];
  if (!ep) throw new Error(`OAuth is not supported for platform "${platform}"`);
  return ep;
}

export function buildAuthorizeUrl(platform: GatewayPlatform, options: OAuthOptions): string {
  const ep = endpoint(platform);
  const params = new URLSearchParams({
    client_id: options.clientId,
    response_type: 'code'
  });
  if (options.redirectUri) params.set('redirect_uri', options.redirectUri);
  if (options.scope) params.set('scope', options.scope);
  return `${ep.authorizeUrl}?${params.toString()}`;
}

export class OAuthClient {
  public constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  public async exchangeCode(
    platform: GatewayPlatform,
    code: string,
    options: OAuthOptions
  ): Promise<OAuthTokenResponse> {
    const ep = endpoint(platform);
    return this.post(ep.tokenUrl, {
      grant_type: 'authorization_code',
      code,
      client_id: options.clientId,
      ...(options.redirectUri ? { redirect_uri: options.redirectUri } : {})
    });
  }

  public async refreshToken(
    platform: GatewayPlatform,
    refreshToken: string,
    options: Pick<OAuthOptions, 'clientId'>
  ): Promise<OAuthTokenResponse> {
    const ep = endpoint(platform);
    return this.post(ep.tokenUrl, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: options.clientId
    });
  }

  private async post(url: string, body: Record<string, string>): Promise<OAuthTokenResponse> {
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = (await response.json().catch(() => ({}))) as OAuthTokenResponse & { error?: string };
    if (!response.ok) {
      throw new Error(`OAuth ${response.status}: ${data.error || response.statusText}`);
    }
    return data;
  }
}
