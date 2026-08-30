import type { DownstreamKey, TokenUsage } from './types';
import { addUsage, EMPTY_USAGE } from './usage';

const KEY_PREFIX = 'sk-tcode';

function randomSecret(length = 24): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function generateDownstreamKey(prefix = 'default'): string {
  return `${KEY_PREFIX}-${prefix}-${randomSecret()}`;
}

export function maskKey(key: string): string {
  if (key.length <= 16) return '****';
  return `${key.slice(0, key.length - 8)}****`;
}

export interface DownstreamKeyInput {
  name: string;
  groups?: string[];
  modelAllowlist?: string[] | null;
  dailyTokenBudget?: number;
}

export type KeyValidation =
  | { ok: true; key: DownstreamKey }
  | { ok: false; reason: 'not_found' | 'disabled' | 'model_not_allowed' | 'budget_exceeded' };

export class DownstreamKeyStore {
  private keys: DownstreamKey[];

  public constructor(keys: DownstreamKey[] = []) {
    this.keys = [...keys];
  }

  public issue(input: DownstreamKeyInput): DownstreamKey {
    const id = `key_${randomSecret(12)}`;
    const key: DownstreamKey = {
      id,
      key: generateDownstreamKey(input.groups?.[0] ?? 'default'),
      name: input.name,
      enabled: true,
      groups: input.groups && input.groups.length > 0 ? [...input.groups] : ['default'],
      modelAllowlist: input.modelAllowlist ?? null,
      dailyTokenBudget: input.dailyTokenBudget,
      usedTokens: { ...EMPTY_USAGE },
      createdAt: Date.now()
    };
    this.keys.push(key);
    return { ...key };
  }

  public revoke(keyId: string): void {
    this.keys = this.keys.filter(k => k.id !== keyId);
  }

  public update(
    keyId: string,
    patch: Partial<Pick<DownstreamKey, 'enabled' | 'name' | 'groups' | 'modelAllowlist' | 'dailyTokenBudget'>>
  ): void {
    const key = this.keys.find(k => k.id === keyId);
    if (key) Object.assign(key, patch);
  }

  public findByKey(raw: string): DownstreamKey | undefined {
    return this.keys.find(k => k.key === raw);
  }

  public list(): DownstreamKey[] {
    return this.keys.map(k => ({ ...k, usedTokens: { ...k.usedTokens } }));
  }

  public recordUsage(keyId: string, usage: TokenUsage): void {
    const key = this.keys.find(k => k.id === keyId);
    if (key) key.usedTokens = addUsage(key.usedTokens, usage);
  }

  public getUsedTokens(keyId: string): TokenUsage {
    const key = this.keys.find(k => k.id === keyId);
    return key ? { ...key.usedTokens } : { ...EMPTY_USAGE };
  }

  public validate(raw: string, model?: string, pendingUsage?: TokenUsage): KeyValidation {
    const key = this.findByKey(raw);
    if (!key) return { ok: false, reason: 'not_found' };
    if (!key.enabled) return { ok: false, reason: 'disabled' };
    if (model && key.modelAllowlist && !key.modelAllowlist.includes(model)) {
      return { ok: false, reason: 'model_not_allowed' };
    }
    if (key.dailyTokenBudget !== undefined && key.dailyTokenBudget > 0) {
      const used = key.usedTokens.inputTokens + key.usedTokens.outputTokens
        + key.usedTokens.cacheReadTokens + key.usedTokens.cacheWriteTokens;
      const pending = pendingUsage
        ? pendingUsage.inputTokens + pendingUsage.outputTokens
          + pendingUsage.cacheReadTokens + pendingUsage.cacheWriteTokens
        : 0;
      if (used + pending > key.dailyTokenBudget) return { ok: false, reason: 'budget_exceeded' };
    }
    return { ok: true, key: { ...key } };
  }
}
