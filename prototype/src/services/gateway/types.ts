// Gateway v2 domain types (Spec: docs/technical_reviews/model-gateway-v2-contract.md §3)

export type GatewayPlatform =
  | 'codex' | 'claude' | 'grok' | 'gemini'
  | 'openai' | 'deepseek' | 'openai-compatible' | 'local';

export type AccountAuthType =
  | 'api_key'        // standard platform API Key
  | 'oauth'          // full OAuth (access + refresh token)
  | 'refresh_token'  // RT manual authorization (refresh + access token)
  | 'setup_token';   // Claude Code inference-only token

export type AccountStatus =
  | 'active' | 'disabled' | 'error' | 'expired' | 'quota_exhausted';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM?: number;
  cacheWritePerM?: number;
}

export interface UpstreamCredential {
  authType: AccountAuthType;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;      // ms epoch
  setupToken?: string;
  orgId?: string;
  orgName?: string;
  cookie?: string;
}

export interface AccountQuota {
  refreshedAt: number;
  limit: number;
  used: number;
  remaining: number;
  windowHours: number;
  source: 'upstream' | 'estimated' | 'unknown';
}

export interface GatewayAccount {
  id: string;
  platform: GatewayPlatform;
  label: string;
  authType: AccountAuthType;
  credential: UpstreamCredential;
  baseUrl: string;
  enabled: boolean;
  status: AccountStatus;
  quota: AccountQuota;
  concurrency: { active: number; max: number };
  health: { lastProbeAt?: number; lastError?: string; consecutiveErrors: number };
  models: string[];
  stickySessionTtlMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface DownstreamKey {
  id: string;
  key: string;             // sk-tcode-<prefix>-<secret>
  name: string;
  enabled: boolean;
  groups: string[];
  modelAllowlist: string[] | null;  // null = all
  dailyTokenBudget?: number;
  usedTokens: TokenUsage;
  createdAt: number;
}

export interface UsageRecord {
  id: string;
  accountId: string;
  downstreamKeyId: string;
  model: string;
  sessionKey: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  startedAt: number;
  finishedAt: number;
  status: 'ok' | 'error' | 'cancelled';
}

export interface RouteRequest {
  model: string;
  platform: GatewayPlatform;
  sessionKey?: string;
  preferredAccountId?: string;
  excludeAccountIds?: string[];
}

export interface RouteDecision {
  account: GatewayAccount;
  reason: 'sticky' | 'preferred' | 'round_robin' | 'failover' | 'mixed';
  stickyKey?: string;
}

export interface SchedulerState {
  lastUsedAt: Record<string, number>;
  stickySessions: Record<string, { accountId: string; expiresAt: number }>;
}
