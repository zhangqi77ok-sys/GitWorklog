import type { AccountQuota, GatewayAccount } from './types';
import type { AccountRegistry } from './accounts';

export interface ProbeResult {
  ok: boolean;
  status: GatewayAccount['status'];
  latencyMs: number;
  error?: string;
  quota?: AccountQuota;
  probedAt: number;
}

export interface ProbeDeps {
  fetchImpl?: typeof fetch;
  resolveProxy?: (url: string) => { url: string; headers: Record<string, string> };
  /** When provided, probe results are written back to the registry. */
  registry?: AccountRegistry;
}

function authHeaders(account: GatewayAccount): Record<string, string> {
  const c = account.credential;
  if (account.platform === 'claude') {
    const headers: Record<string, string> = { 'anthropic-version': '2023-06-01' };
    if (account.authType === 'api_key') headers['x-api-key'] = c.apiKey ?? '';
    else headers.Authorization = `Bearer ${c.accessToken ?? ''}`;
    if (c.orgId) headers['anthropic-organization'] = c.orgId;
    return headers;
  }
  const secret = account.authType === 'api_key' ? (c.apiKey ?? '') : (c.accessToken ?? '');
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}

/**
 * Real connectivity probe for an account: GET {base}/models with its credential.
 * Status mapping: 2xx -> active, 401/403 -> expired, 429 -> quota_exhausted,
 * 404 -> active (credential accepted), other/network -> error.
 */
export async function probeAccount(
  account: GatewayAccount,
  deps: ProbeDeps = {}
): Promise<ProbeResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const resolveProxy = deps.resolveProxy ?? ((url: string) => ({ url, headers: {} }));
  const started = Date.now();
  const base = (account.baseUrl || '').replace(/\/+$/, '');
  const target = `${base}/models`;
  const proxied = resolveProxy(target);
  try {
    const res = await fetchImpl(proxied.url, {
      method: 'GET',
      headers: { ...authHeaders(account), ...proxied.headers }
    });
    const latencyMs = Date.now() - started;
    let result: ProbeResult;
    if (res.status === 401 || res.status === 403) {
      result = { ok: false, status: 'expired', latencyMs, error: `HTTP ${res.status} (credential invalid)`, probedAt: started };
    } else if (res.status === 429) {
      result = { ok: false, status: 'quota_exhausted', latencyMs, error: 'HTTP 429 rate/quota limit', probedAt: started };
    } else if (res.status >= 200 && res.status < 300) {
      result = { ok: true, status: 'active', latencyMs, probedAt: started };
    } else if (res.status === 404) {
      // Authenticated but no /models endpoint: credential is valid.
      result = { ok: true, status: 'active', latencyMs, probedAt: started };
    } else {
      result = { ok: false, status: 'error', latencyMs, error: `HTTP ${res.status}`, probedAt: started };
    }
    if (deps.registry) applyProbeResult(deps.registry, account.id, result);
    return result;
  } catch (err) {
    const latencyMs = Date.now() - started;
    const result: ProbeResult = {
      ok: false,
      status: 'error',
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
      probedAt: started
    };
    if (deps.registry) applyProbeResult(deps.registry, account.id, result);
    return result;
  }
}

/** Writes a probe result back to the account registry (status / health / quota). */
export function applyProbeResult(registry: AccountRegistry, accountId: string, result: ProbeResult): void {
  if (result.ok) {
    registry.markSuccess(accountId);
    if (result.status === 'active') registry.update(accountId, { status: 'active' });
    return;
  }
  if (result.status === 'expired') {
    registry.update(accountId, { status: 'expired' });
    return;
  }
  if (result.status === 'quota_exhausted') {
    registry.refreshQuota(accountId, {
      refreshedAt: result.probedAt,
      limit: 1,
      used: 1,
      remaining: 0,
      windowHours: 24,
      source: 'upstream'
    });
    return;
  }
  // error: mark and surface as unavailable for scheduling
  registry.markError(accountId, result.error ?? 'probe failed');
  registry.update(accountId, { status: 'error' });
}

export class AccountProbeScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly registry: AccountRegistry;
  private readonly probeFn: (account: GatewayAccount) => Promise<ProbeResult>;
  private readonly intervalMs: number;
  private readonly onRound?: () => void;

  public constructor(deps: {
    registry: AccountRegistry;
    probe?: (account: GatewayAccount) => Promise<ProbeResult>;
    intervalMs?: number;
    fetchImpl?: typeof fetch;
    resolveProxy?: (url: string) => { url: string; headers: Record<string, string> };
    onRound?: () => void;
  }) {
    this.registry = deps.registry;
    this.probeFn = deps.probe ?? ((account) => probeAccount(account, { fetchImpl: deps.fetchImpl, resolveProxy: deps.resolveProxy, registry: this.registry }));
    this.intervalMs = deps.intervalMs ?? 300_000; // 5 minutes
    this.onRound = deps.onRound;
  }

  public start(): void {
    if (this.timer) return;
    void this.probeAll();
    this.timer = setInterval(() => { void this.probeAll(); }, this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async probeAll(): Promise<void> {
    const accounts = this.registry.all().filter(a => a.enabled);
    const results = await Promise.all(
      accounts.map(async (account) => ({ accountId: account.id, result: await this.probeFn(account) }))
    );
    for (const { accountId, result } of results) {
      applyProbeResult(this.registry, accountId, result);
    }
    this.onRound?.();
  }
}
