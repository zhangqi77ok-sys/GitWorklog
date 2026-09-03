import { create } from 'zustand'

export interface AppConfig {
  baseUrl: string
  apiKey: string
  defaultModel: string
  enableThinking: boolean
  thinkingBudget: number
  atomicWrite: boolean
  autoSnapshot: boolean
  systemPrompt: string
}

interface SettingsState {
  isOpen: boolean
  activeTab: 'providers' | 'sandbox' | 'prompts'
  config: AppConfig
  pingStatus: 'idle' | 'testing' | 'success' | 'error'
  pingLatency: number | null
  pingMessage: string | null

  openSettings: () => void
  closeSettings: () => void
  setActiveTab: (tab: 'providers' | 'sandbox' | 'prompts') => void
  updateConfig: (partial: Partial<AppConfig>) => void
  saveConfig: () => void
  testPing: () => Promise<void>
}

const DEFAULT_CONFIG: AppConfig = {
  baseUrl: 'https://agentrouter.org',
  apiKey: '',
  defaultModel: 'deepseek-v4-flash',
  enableThinking: true,
  thinkingBudget: 4096,
  atomicWrite: true,
  autoSnapshot: true,
  systemPrompt: 'You are Tcode, an elite autonomous AI coding assistant. Reason step-by-step and inspect code before modifying.',
}

function loadConfig(): AppConfig {
  try {
    const saved = localStorage.getItem('tcode_settings_config')
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) }
    }
  } catch {}
  return DEFAULT_CONFIG
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isOpen: false,
  activeTab: 'providers',
  config: loadConfig(),
  pingStatus: 'idle',
  pingLatency: null,
  pingMessage: null,

  openSettings: () => set({ isOpen: true, pingStatus: 'idle', pingLatency: null, pingMessage: null }),
  closeSettings: () => set({ isOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  updateConfig: (partial) => {
    set((state) => ({
      config: { ...state.config, ...partial },
    }))
  },

  saveConfig: () => {
    const { config } = get()
    try {
      localStorage.setItem('tcode_settings_config', JSON.stringify(config))
    } catch {}
    set({ isOpen: false })
  },

  testPing: async () => {
    const { config } = get()
    set({ pingStatus: 'testing', pingLatency: null, pingMessage: null })

    try {
      const res = await fetch('http://127.0.0.1:8765/api/config/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.defaultModel,
        }),
      })

      const data = await res.json()
      if (data.success) {
        set({
          pingStatus: 'success',
          pingLatency: data.latency_ms,
          pingMessage: '连接成功 (HTTP 200 OK)',
        })
      } else {
        set({
          pingStatus: 'error',
          pingLatency: data.latency_ms,
          pingMessage: data.error ? `网关响应: ${data.error}` : `探活失败 (HTTP ${data.status})`,
        })
      }
    } catch (err: any) {
      set({
        pingStatus: 'error',
        pingLatency: null,
        pingMessage: err.message || '网络连接超时',
      })
    }
  },
}))
