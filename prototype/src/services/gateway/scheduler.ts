import type { GatewayAccount, RouteDecision, RouteRequest, SchedulerState } from './types';

export function createSchedulerState(): SchedulerState {
  return { lastUsedAt: {}, stickySessions: {} };
}

export function isAccountAvailable(account: GatewayAccount, now: number = Date.now()): boolean {
  if (!account.enabled) return false;
  if (account.status !== 'active') return false;
  if (account.concurrency.active >= account.concurrency.max) return false;
  if (account.quota.remaining <= 0 && account.quota.limit > 0) return false;
  if (account.health.consecutiveErrors >= 3) return false;
  return true;
}

function canServeModel(account: GatewayAccount, model: string): boolean {
  if (!Array.isArray(account.models) || account.models.length === 0) return true;
  return account.models.includes(model);
}

export function markAccountUsed(state: SchedulerState, accountId: string, now: number = Date.now()): void {
  state.lastUsedAt[accountId] = now;
}

export function bindSticky(
  state: SchedulerState,
  sessionKey: string,
  accountId: string,
  ttlMs: number,
  now: number = Date.now()
): void {
  state.stickySessions[sessionKey] = { accountId, expiresAt: now + ttlMs };
}

function candidatePool(
  pool: GatewayAccount[],
  req: RouteRequest,
  now: number
): GatewayAccount[] {
  const excluded = new Set(req.excludeAccountIds ?? []);
  return pool.filter(account =>
    !excluded.has(account.id) &&
    isAccountAvailable(account, now) &&
    canServeModel(account, req.model)
  );
}

/**
 * Selects the best account for a request.
 * Priority: sticky session → user preference → least-recently-used (round robin).
 * Returns `failover` reason when invoked with excludeAccountIds (retry after upstream error).
 */
export function selectAccount(
  pool: GatewayAccount[],
  req: RouteRequest,
  state: SchedulerState,
  now: number = Date.now()
): RouteDecision {
  const candidates = candidatePool(pool, req, now);
  if (candidates.length === 0) {
    throw new Error(`No available account for model "${req.model}" on platform "${req.platform}"`);
  }

  // 1. Sticky session (TTL-bound) for conversation continuity.
  if (req.sessionKey) {
    const sticky = state.stickySessions[req.sessionKey];
    if (sticky && sticky.expiresAt > now) {
      const match = candidates.find(a => a.id === sticky.accountId);
      if (match) {
        markAccountUsed(state, match.id, now);
        return { account: match, reason: 'sticky', stickyKey: req.sessionKey };
      }
    }
  }

  // 2. User-preferred account.
  if (req.preferredAccountId) {
    const preferred = candidates.find(a => a.id === req.preferredAccountId);
    if (preferred) {
      markAccountUsed(state, preferred.id, now);
      return { account: preferred, reason: 'preferred' };
    }
  }

  // 3. LRU / round-robin.
  const sorted = [...candidates].sort((a, b) =>
    (state.lastUsedAt[a.id] ?? Number.NEGATIVE_INFINITY) -
    (state.lastUsedAt[b.id] ?? Number.NEGATIVE_INFINITY)
  );
  const chosen = sorted[0];
  markAccountUsed(state, chosen.id, now);
  const reason = req.excludeAccountIds && req.excludeAccountIds.length > 0 ? 'failover' : 'round_robin';
  return { account: chosen, reason };
}
