import type { AccountQuota, GatewayAccount, GatewayPlatform, UpstreamCredential } from './types';

export interface AccountInput {
  platform: GatewayPlatform;
  label: string;
  authType: UpstreamCredential['authType'];
  credential: UpstreamCredential;
  baseUrl?: string;
  models?: string[];
  concurrencyMax?: number;
  stickySessionTtlMs?: number;
}

export const OPENCODE_PACKAGE_URLS = {
  go: 'https://opencode.ai/zen/go/v1',
  zen: 'https://opencode.ai/zen/v1'
} as const;

export const DEFAULT_BASE_URLS: Record<GatewayPlatform, string> = {
  codex: 'https://chatgpt.com/backend-api/codex',
  claude: 'https://api.anthropic.com/v1',
  grok: 'https://api.x.ai/v1',
  gemini: 'https://generativelanguage.googleapis.com',
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  opencode: OPENCODE_PACKAGE_URLS.go,
  'openai-compatible': OPENCODE_PACKAGE_URLS.go,
  local: 'http://127.0.0.1:11434/v1'
};

export function isLocalAccount(account: Pick<GatewayAccount, 'baseUrl' | 'platform'>): boolean {
  if (account.platform === 'local') return true;
  return /^(https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/)/i.test(account.baseUrl.trim());
}

/**
 * Fail-closed credential validation: a cloud account must carry usable
 * credentials for its auth type before it may be routed to.
 */
export function assertAccountCredential(account: GatewayAccount): void {
  if (!account.baseUrl.trim()) throw new Error(`Account ${account.id} Base URL is required`);
  if (isLocalAccount(account)) return;
  const c = account.credential;
  if (!c || !c.authType) throw new Error(`Account ${account.id} credential type is required`);
  switch (account.authType) {
    case 'api_key':
    case 'setup_token':
      if (!(c.apiKey || c.setupToken || c.accessToken)?.trim()) {
        throw new Error(`Account ${account.id} API Key is required`);
      }
      break;
    case 'refresh_token':
      if (!c.refreshToken?.trim()) throw new Error(`Account ${account.id} refresh token is required`);
      if (!c.accessToken?.trim()) throw new Error(`Account ${account.id} access token is required`);
      break;
    case 'oauth':
      if (!c.accessToken?.trim()) throw new Error(`Account ${account.id} access token is required`);
      if (!c.refreshToken?.trim()) throw new Error(`Account ${account.id} refresh token is required`);
      break;
    default:
      throw new Error(`Account ${account.id} unsupported auth type`);
  }
}

function createAccountId(platform: GatewayPlatform, index: number): string {
  return `acct-${platform}-${index + 1}`;
}

export class AccountRegistry {
  private accounts: GatewayAccount[];

  public constructor(accounts: GatewayAccount[] = []) {
    this.accounts = [...accounts];
  }

  public add(input: AccountInput): GatewayAccount {
    const index = this.accounts.filter(a => a.platform === input.platform).length;
    const now = Date.now();
    const account: GatewayAccount = {
      id: createAccountId(input.platform, index),
      platform: input.platform,
      label: input.label,
      authType: input.authType,
      credential: { ...input.credential, authType: input.authType },
      baseUrl: (input.baseUrl || DEFAULT_BASE_URLS[input.platform]).trim().replace(/\/+$/, ''),
      enabled: true,
      status: 'active',
      quota: { refreshedAt: 0, limit: 0, used: 0, remaining: 0, windowHours: 24, source: 'unknown' },
      concurrency: { active: 0, max: input.concurrencyMax ?? 4 },
      health: { consecutiveErrors: 0 },
      models: [...(input.models ?? [])],
      stickySessionTtlMs: input.stickySessionTtlMs ?? 3_600_000,
      createdAt: now,
      updatedAt: now
    };
    this.accounts.push(account);
    return { ...account };
  }

  public remove(id: string): void {
    this.accounts = this.accounts.filter(a => a.id !== id);
  }

  public update(id: string, patch: Partial<Pick<GatewayAccount, 'label'|'enabled'|'baseUrl'|'credential'|'models'|'concurrency'|'status'>>): void {
    const account = this.accounts.find(a => a.id === id);
    if (!account) return;
    Object.assign(account, patch, { updatedAt: Date.now() });
  }

  public get(id: string): GatewayAccount | undefined {
    const account = this.accounts.find(a => a.id === id);
    return account ? { ...account } : undefined;
  }

  public byPlatform(platform: GatewayPlatform): GatewayAccount[] {
    return this.accounts.filter(a => a.platform === platform).map(a => ({ ...a }));
  }

  public all(): GatewayAccount[] {
    return this.accounts.map(a => ({ ...a }));
  }

  public markConcurrency(id: string, delta: number): void {
    const account = this.accounts.find(a => a.id === id);
    if (account) {
      account.concurrency.active = Math.max(0, account.concurrency.active + delta);
      account.updatedAt = Date.now();
    }
  }

  public markError(id: string, message: string): void {
    const account = this.accounts.find(a => a.id === id);
    if (!account) return;
    account.health.consecutiveErrors += 1;
    account.health.lastError = message;
    account.health.lastProbeAt = Date.now();
    if (account.health.consecutiveErrors >= 3) account.status = 'error';
    account.updatedAt = Date.now();
  }

  public markSuccess(id: string): void {
    const account = this.accounts.find(a => a.id === id);
    if (!account) return;
    account.health.consecutiveErrors = 0;
    account.health.lastError = undefined;
    account.health.lastProbeAt = Date.now();
    if (account.status === 'error') account.status = 'active';
    account.updatedAt = Date.now();
  }

  public refreshQuota(id: string, quota: AccountQuota): void {
    const account = this.accounts.find(a => a.id === id);
    if (!account) return;
    account.quota = { ...quota };
    if (quota.remaining <= 0 && quota.limit > 0) account.status = 'quota_exhausted';
    else if (account.status === 'quota_exhausted') account.status = 'active';
    account.updatedAt = Date.now();
  }
}

