import type { DownstreamKey, GatewayAccount, SchedulerState, UsageRecord } from './types';
import { saveToDiskStorageAsync } from '../../types/contracts';

export const GATEWAY_STORAGE_KEY = 'codemind_gateway_v2';

export interface GatewayPersistedState {
  accounts: GatewayAccount[];
  keys: DownstreamKey[];
  usage: UsageRecord[];
  scheduler: SchedulerState;
}

export function saveGatewayState(state: GatewayPersistedState): void {
  const payload = JSON.stringify(state);
  try {
    localStorage.setItem(GATEWAY_STORAGE_KEY, payload);
  } catch {
    // quota exceeded or unavailable; host disk sync below still runs
  }
  saveToDiskStorageAsync(GATEWAY_STORAGE_KEY, state).catch(() => {});
}

export function loadGatewayState(): GatewayPersistedState | null {
  try {
    const raw = localStorage.getItem(GATEWAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GatewayPersistedState;
    if (!Array.isArray(parsed.accounts) || !Array.isArray(parsed.keys) || !Array.isArray(parsed.usage)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGatewayState(): void {
  try {
    localStorage.removeItem(GATEWAY_STORAGE_KEY);
  } catch {
    // ignore
  }
}
