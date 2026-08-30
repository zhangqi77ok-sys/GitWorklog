import { PermissionPolicy, WorkMode } from '../types/contracts';
import { hostFetch } from './hostClient';

export type ThemeMode = 'paper-warm' | 'charcoal-dark' | 'studio-white' | 'system';

export interface GlobalSettings {
  theme: ThemeMode;
  accentColor: string;
  defaultWorkMode: WorkMode;
  defaultPermissionPolicy: PermissionPolicy;
  isAirGapped: boolean;
  dailyTokenLimitUsd: number;
  contextWarnRatio: number;
  autoCompressRatio: number;
  forceCompressRatio: number;
  autoShadowSnapshot: boolean;
  dataDesensitize: boolean;
  astDepth: 'shallow' | 'standard' | 'deep';
  editorFontSize: number;
  terminalFontSize: number;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  theme: 'paper-warm',
  accentColor: '#D96B27',
  defaultWorkMode: 'act',
  defaultPermissionPolicy: 'autonomous_agent',
  isAirGapped: false,
  dailyTokenLimitUsd: 10.0,
  contextWarnRatio: 0.75,
  autoCompressRatio: 0.85,
  forceCompressRatio: 0.95,
  autoShadowSnapshot: true,
  dataDesensitize: true,
  astDepth: 'standard',
  editorFontSize: 12,
  terminalFontSize: 11
};

const STORAGE_KEY_GLOBAL_SETTINGS = 'codemind_unified_global_settings';

export function loadSavedGlobalSettings(): GlobalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GLOBAL_SETTINGS);
    if (raw) {
      return { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {}
  return DEFAULT_GLOBAL_SETTINGS;
}

export function saveGlobalSettingsToStorage(settings: GlobalSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_GLOBAL_SETTINGS, JSON.stringify(settings));
    // Persist to desktop host disk so host-level policies (e.g. Air-Gapped
    // enforcement at /api/terminal/exec) can read the flag fail-closed.
    if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
      hostFetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'tcode_settings', data: settings })
      }).catch(() => {});
    }
    window.dispatchEvent(new CustomEvent('codemind_settings_updated', { detail: settings }));
  } catch (e) {}
}

/**
 * Clear Local Storage with Granular Scopes
 */
export function clearStorageData(scope: 'all' | 'sessions' | 'providers' | 'cache'): void {
  if (scope === 'all') {
    localStorage.clear();
  } else if (scope === 'sessions') {
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('codemind_session') || k.startsWith('codemind_draft_'));
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } else if (scope === 'providers') {
    localStorage.removeItem('codemind_custom_providers');
    localStorage.removeItem('codemind_current_model_id');
    localStorage.removeItem('codemind_current_model_obj');
  } else if (scope === 'cache') {
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('codemind_draft_') || k.includes('cache'));
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}

/**
 * Export Sanitized Configuration JSON (No API Keys or Secrets)
 */
export function exportSanitizedConfig(): string {
  const settings = loadSavedGlobalSettings();
  const rawProviders = localStorage.getItem('codemind_custom_providers');
  const providers = rawProviders ? JSON.parse(rawProviders) : [];

  const sanitizedProviders = providers.map((p: any) => ({
    id: p.id,
    name: p.name,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey ? '********' : '',
    models: p.models?.map((m: any) => ({ id: m.id, name: m.name, contextLimit: m.contextLimit }))
  }));

  const exportPayload = {
    version: '1.5.0',
    exportDate: new Date().toISOString(),
    settings,
    providers: sanitizedProviders
  };

  return JSON.stringify(exportPayload, null, 2);
}
