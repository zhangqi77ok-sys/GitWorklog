import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  ChannelItem,
  ChannelType,
  CHANNEL_PRESETS,
  INITIAL_NEW_API_CHANNELS,
  loadSavedChannels,
  saveChannelsToStorage,
  getPresetForChannelType
} from '../src/types/contracts';

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

describe('New-API Channel Contracts & Presets (Ref: E:\\pro\\new-api)', () => {
  it('provides official presets for OpenCode, DeepSeek, Anthropic, SiliconFlow, OpenAI, etc.', () => {
    expect(CHANNEL_PRESETS.length).toBeGreaterThanOrEqual(10);

    const opencodePreset = getPresetForChannelType(60);
    expect(opencodePreset.name).toContain('OpenCode');
    expect(opencodePreset.defaultBaseUrl).toBe('https://opencode.ai/zen/go/v1');
    expect(opencodePreset.defaultTestModel).toBe('mimo-v2.5-free');

    const deepseekPreset = getPresetForChannelType(43);
    expect(deepseekPreset.defaultBaseUrl).toBe('https://api.deepseek.com');
    expect(deepseekPreset.defaultTestModel).toBe('deepseek-chat');

    const anthropicPreset = getPresetForChannelType(14);
    expect(anthropicPreset.defaultBaseUrl).toBe('https://api.anthropic.com');

    const siliconflowPreset = getPresetForChannelType(40);
    expect(siliconflowPreset.defaultBaseUrl).toBe('https://api.siliconflow.cn');
  });

  it('returns empty array when storage is empty (zero dummy channels)', () => {
    const loaded = loadSavedChannels();
    expect(loaded).toEqual([]);
    expect(loaded.length).toBe(0);
  });

  it('saves and restores channel items with model mapping and priorities', () => {
    const customChannel: ChannelItem = {
      id: 'chan-test-custom-1',
      name: '公司自建中转 New-API',
      type: 61,
      key: 'sk-newapi-key-123',
      baseUrl: 'https://newapi.company.internal/v1',
      defaultBaseUrl: 'https://newapi.company.internal/v1',
      models: ['gpt-4o', 'claude-3-7-sonnet', 'deepseek-chat'],
      modelMapping: {
        'gpt-4o': 'claude-3-7-sonnet',
        'code-fast': 'deepseek-chat'
      },
      status: 'active',
      responseTime: 110,
      priority: 20,
      weight: 15,
      group: 'vip'
    };

    saveChannelsToStorage([customChannel]);
    const restored = loadSavedChannels();
    expect(restored.length).toBe(1);
    expect(restored[0].id).toBe('chan-test-custom-1');
    expect(restored[0].modelMapping?.['gpt-4o']).toBe('claude-3-7-sonnet');
    expect(restored[0].priority).toBe(20);
    expect(restored[0].weight).toBe(15);
  });

  it('supports multi-key storage format', () => {
    const multiKeyChannel: ChannelItem = {
      id: 'chan-multi-1',
      name: 'DeepSeek 多Key负载均衡',
      type: 43,
      key: 'sk-key-1\nsk-key-2\nsk-key-3',
      baseUrl: 'https://api.deepseek.com',
      defaultBaseUrl: 'https://api.deepseek.com',
      models: ['deepseek-chat'],
      status: 'active',
      responseTime: 65,
      priority: 10,
      weight: 10,
      group: 'default'
    };

    saveChannelsToStorage([multiKeyChannel]);
    const restored = loadSavedChannels();
    expect(restored[0].key.split('\n').length).toBe(3);
  });
});
