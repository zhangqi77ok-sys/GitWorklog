import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  INITIAL_PROVIDERS,
  AVAILABLE_MODELS,
  loadSavedProviders,
  saveProvidersToStorage,
  STORAGE_KEYS,
  resolveInitialModel,
  type ModelProviderItem,
  type AIModelOption
} from '../src/types/contracts';
import { OFFICIAL_OPENCODE_ZEN_MODEL_IDS } from './fixtures/opencodeZenModels';

const storageMap: Record<string, string> = {};

beforeAll(() => {
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in storageMap ? storageMap[k] : null),
    setItem: (k: string, v: string) => { storageMap[k] = String(v); },
    removeItem: (k: string) => { delete storageMap[k]; },
    clear: () => { for (const k of Object.keys(storageMap)) delete storageMap[k]; }
  };
});

beforeEach(() => {
  for (const k of Object.keys(storageMap)) delete storageMap[k];
});

const opencodeProvider = (): ModelProviderItem =>
  INITIAL_PROVIDERS.find(p => p.id === 'provider-opencode') as ModelProviderItem;

const baseModel = (id: string, name: string): AIModelOption => ({
  id,
  name,
  provider: 'DeepSeek',
  providerId: 'provider-opencode',
  uniqueKey: `provider-opencode:${id}`,
  contextLimit: 131072,
  inputPricePerM: 0,
  outputPricePerM: 0
});

describe('OpenCode Zen builtin catalog reality gate', () => {
  it('ships only models that exist in the official OpenCode Zen catalog', () => {
    const builtinIds = opencodeProvider().models.map(m => m.id);
    expect(builtinIds.length).toBeGreaterThan(0);
    for (const id of builtinIds) {
      expect(OFFICIAL_OPENCODE_ZEN_MODEL_IDS, `builtin model ${id} missing from official catalog`).toContain(id);
    }
  });

  it('never ships the nonexistent hy3-free model anywhere', () => {
    expect(opencodeProvider().models.some(m => m.id === 'hy3-free')).toBe(false);
    const fallbackIds = AVAILABLE_MODELS
      .filter(m => m.providerId === 'provider-opencode')
      .map(m => m.id);
    expect(fallbackIds.some(id => id === 'hy3-free')).toBe(false);
  });

  it('keeps the OpenCode provider untested with empty credentials at first launch', () => {
    expect(opencodeProvider().apiKey).toBe('');
    expect(opencodeProvider().status).toBe('untested');
  });
});

describe('resolveInitialModel default selection contract', () => {
  it('never returns a model that is not in the available list', () => {
    storageMap['codemind_current_model_obj'] = JSON.stringify({ id: 'hy3-free', name: '混元 3.0' });
    const all: AIModelOption[] = [baseModel('mimo-v2.5-free', 'OpenCode MiMo v2.5')];
    const picked = resolveInitialModel(all);
    expect(all.some(m => m.id === picked.id)).toBe(true);
  });

  it('does not hard-preference hy3/hunyuan ids over the first available model', () => {
    const all: AIModelOption[] = [
      baseModel('mimo-v2.5-free', 'OpenCode MiMo v2.5'),
      baseModel('hy3-free', '混元 3.0')
    ];
    expect(resolveInitialModel(all).id).toBe('mimo-v2.5-free');
  });

  it('restores a saved model only when it is still present in the available list', () => {
    storageMap['codemind_current_model_obj'] = JSON.stringify({
      id: 'mimo-v2.5-free',
      name: 'OpenCode MiMo v2.5',
      providerId: 'provider-opencode',
      uniqueKey: 'provider-opencode:mimo-v2.5-free'
    });
    const all: AIModelOption[] = [baseModel('mimo-v2.5-free', 'OpenCode MiMo v2.5')];
    expect(resolveInitialModel(all).id).toBe('mimo-v2.5-free');
  });
});

describe('loadSavedProviders upgrade migration', () => {
  it('drops the nonexistent hy3-free model from a saved OpenCode catalog', () => {
    const base = opencodeProvider();
    const historical: ModelProviderItem[] = [{
      ...base,
      models: [
        ...base.models,
        { id: 'hy3-free', name: '混元 3.0', enabled: true, contextLimit: 131072, capabilities: ['code'] }
      ]
    }];
    saveProvidersToStorage(historical);
    const migrated = loadSavedProviders().find(p => p.id === 'provider-opencode') as ModelProviderItem;
    expect(migrated.models.some(m => m.id === 'hy3-free')).toBe(false);
    expect(migrated.models.map(m => m.id)).toEqual(base.models.map(m => m.id));
  });

  it('normalizes an empty-key saved provider to untested', () => {
    const base = opencodeProvider();
    const historical: ModelProviderItem[] = [{ ...base, apiKey: '', status: 'healthy' as const }];
    saveProvidersToStorage(historical);
    const migrated = loadSavedProviders().find(p => p.id === 'provider-opencode') as ModelProviderItem;
    expect(migrated.status).toBe('untested');
  });
});


