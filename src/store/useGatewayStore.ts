import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type ProviderPlatform =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'deepseek'
  | 'siliconflow'
  | 'kimi'
  | 'zhipu'
  | 'grok'
  | 'ollama'
  | 'custom';

export type IngressType =
  | 'api_key'
  | 'oauth'
  | 'sub2'
  | 'cap'
  | 'setup_token'
  | 'bedrock'
  | 'vertex'
  | 'proxy';

export interface GatewayChannel {
  id: string;
  name: string;
  platform: ProviderPlatform;
  ingress_type: IngressType;
  base_url: string;
  api_key?: string;
  auth_payload?: any;
  models: string[];
  priority: number;
  weight: number;
  enabled: boolean;
  is_healthy: boolean;
  last_latency_ms?: number;
}

export interface GatewayHealthResult {
  channel_id: string;
  success: boolean;
  http_status: number;
  latency_ms: number;
  models_found: string[];
  message: string;
}

export interface GatewayConfigDatabase {
  active_channel_id: string | null;
  channels: GatewayChannel[];
}

interface GatewayState {
  channels: GatewayChannel[];
  activeChannelId: string | null;
  activeModelId: string;
  probeResults: Record<string, GatewayHealthResult>;
  isProbing: boolean;
  isLoading: boolean;
  error: string | null;

  loadChannels: () => Promise<void>;
  saveChannel: (channel: GatewayChannel) => Promise<GatewayChannel | null>;
  deleteChannel: (channelId: string) => Promise<void>;
  setActiveChannel: (channelId: string) => Promise<void>;
  setActiveModel: (modelId: string) => void;
  testChannel: (channel: GatewayChannel) => Promise<GatewayHealthResult | null>;
  pullModels: (baseUrl: string, apiKey?: string) => Promise<string[]>;
}

const STORAGE_MODEL_KEY = 'tcode_active_model';

function getInitialModel(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_MODEL_KEY) || 'deepseek-v4-flash';
  }
  return 'deepseek-v4-flash';
}

export const useGatewayStore = create<GatewayState>((set, get) => ({
  channels: [],
  activeChannelId: null,
  activeModelId: getInitialModel(),
  probeResults: {},
  isProbing: false,
  isLoading: false,
  error: null,

  loadChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await invoke<GatewayConfigDatabase>('list_gateway_channels');
      const savedModel = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_MODEL_KEY) : null;
      const channelsList = db.channels || [];
      const activeCh = channelsList.find((c) => c.id === db.active_channel_id) || channelsList[0];
      const modelToUse = savedModel || activeCh?.models?.[0] || 'deepseek-v4-flash';

      set({
        channels: channelsList,
        activeChannelId: db.active_channel_id || (channelsList[0]?.id ?? null),
        activeModelId: modelToUse,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: String(err), isLoading: false });
    }
  },

  setActiveModel: (modelId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_MODEL_KEY, modelId);
    }
    set({ activeModelId: modelId });
  },

  saveChannel: async (channel: GatewayChannel) => {
    try {
      const saved = await invoke<GatewayChannel>('save_gateway_channel', { channel });
      const target = saved || channel;
      set((state) => {
        const exists = state.channels.some((c) => c.id === target.id);
        const updated = exists
          ? state.channels.map((c) => (c.id === target.id ? target : c))
          : [...state.channels, target];
        return {
          channels: updated,
          activeChannelId: state.activeChannelId || target.id,
        };
      });
      await get().loadChannels();
      return target;
    } catch (err: any) {
      set({ error: String(err) });
      return null;
    }
  },

  deleteChannel: async (channelId: string) => {
    try {
      await invoke('delete_gateway_channel', { channelId });
      await get().loadChannels();
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  setActiveChannel: async (channelId: string) => {
    try {
      await invoke('set_active_gateway_channel', { channelId });
      const { channels, activeModelId } = get();
      const targetCh = channels.find((c) => c.id === channelId);
      let nextModel = activeModelId;
      if (targetCh && Array.isArray(targetCh.models) && targetCh.models.length > 0) {
        if (!targetCh.models.includes(activeModelId)) {
          nextModel = targetCh.models[0];
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_MODEL_KEY, nextModel);
          }
        }
      }
      set({ activeChannelId: channelId, activeModelId: nextModel });
    } catch (err: any) {
      set({ error: String(err) });
    }
  },

  testChannel: async (channel: GatewayChannel) => {
    set({ isProbing: true });
    try {
      const result = await invoke<GatewayHealthResult>('test_gateway_channel', { channel });
      set((state) => ({
        probeResults: { ...state.probeResults, [channel.id]: result },
        isProbing: false,
      }));
      return result;
    } catch (err: any) {
      set({ isProbing: false, error: String(err) });
      return null;
    }
  },

  pullModels: async (baseUrl: string, apiKey?: string) => {
    try {
      return await invoke<string[]>('pull_gateway_models', { baseUrl, apiKey });
    } catch (err: any) {
      set({ error: String(err) });
      return [];
    }
  },
}));
