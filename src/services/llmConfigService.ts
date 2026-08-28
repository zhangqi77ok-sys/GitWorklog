import { LLMChannel, GlobalLLMConfig, ModelMeta } from "../types";
import {
  geminiAuthService,
  COCKPIT_GOOGLE_CLIENT_ID,
  COCKPIT_GOOGLE_CLIENT_SECRET,
} from "./geminiAuthService";

const STORAGE_KEY = "codemind_llm_config_v2";

export const DEFAULT_CHANNELS: LLMChannel[] = [
  {
    id: "chan-deepseek",
    name: "DeepSeek 官方平台",
    type: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    models: ["deepseek-chat", "deepseek-reasoner"],
    modelMetas: [
      {
        id: "deepseek-reasoner",
        name: "DeepSeek-R1 (推理)",
        contextWindow: 128000,
        maxOutputTokens: 8192,
        supportsThinking: true,
      },
      {
        id: "deepseek-chat",
        name: "DeepSeek-V3",
        contextWindow: 128000,
        maxOutputTokens: 8192,
        supportsThinking: false,
      },
    ],
    compressionThreshold: 0.95,
    modelMapping: {
      "deepseek-v3": "deepseek-chat",
      "deepseek-r1": "deepseek-reasoner",
    },
    status: "active",
    latencyMs: 38,
    lastChecked: "刚刚",
    balance: "¥ 100.00",
    icon: "deepseek",
  },
  {
    id: "chan-anthropic",
    name: "Anthropic 官方 (Claude)",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    models: [
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
    ],
    modelMetas: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet (Thinking)",
        contextWindow: 200000,
        maxOutputTokens: 64000,
        supportsThinking: true,
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsThinking: false,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 145,
    lastChecked: "刚刚",
    balance: "$ 50.00",
    icon: "claude",
  },
  {
    id: "chan-siliconflow",
    name: "SiliconFlow (硅基流动)",
    type: "openai",
    baseUrl: "https://api.siliconflow.cn/v1",
    apiKey: "",
    models: [
      "deepseek-ai/DeepSeek-R1",
      "deepseek-ai/DeepSeek-V3",
      "Qwen/Qwen2.5-Coder-32B-Instruct",
      "Pro/deepseek-ai/DeepSeek-R1",
    ],
    modelMetas: [
      {
        id: "deepseek-ai/DeepSeek-R1",
        name: "DeepSeek-R1 满血",
        contextWindow: 64000,
        maxOutputTokens: 8192,
        supportsThinking: true,
      },
      {
        id: "Qwen/Qwen2.5-Coder-32B-Instruct",
        name: "Qwen 2.5 Coder 32B",
        contextWindow: 128000,
        maxOutputTokens: 8192,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 25,
    lastChecked: "刚刚",
    balance: "1,000,000 Tokens",
    icon: "siliconflow",
  },
  {
    id: "chan-openai",
    name: "OpenAI 官方",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    models: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini", "chatgpt-4o-latest"],
    modelMetas: [
      {
        id: "gpt-4o",
        name: "GPT-4o (旗舰多模态)",
        contextWindow: 128000,
        maxOutputTokens: 16384,
      },
      {
        id: "o3-mini",
        name: "o3-mini (推理)",
        contextWindow: 200000,
        maxOutputTokens: 100000,
        supportsThinking: true,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 210,
    lastChecked: "刚刚",
    balance: "$ 25.00",
    icon: "openai",
  },
  {
    id: "chan-antigravity",
    name: "Google Antigravity 官方 (支持 OAuth / RT)",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: "",
    geminiAuth: {
      mode: "oauth_rt",
      refreshToken: "",
      clientId: COCKPIT_GOOGLE_CLIENT_ID,
      clientSecret: COCKPIT_GOOGLE_CLIENT_SECRET,
      accountEmail: "antigravity_dev@gmail.com",
      accessToken: "",
      lastRefreshedAt: "未刷新",
    },
    models: ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro"],
    modelMetas: [
      {
        id: "gemini-2.5-pro",
        name: "Antigravity 2.5 Pro (DeepMind 核心百万上下文)",
        contextWindow: 1000000,
        maxOutputTokens: 65536,
        supportsThinking: true,
      },
      {
        id: "gemini-2.0-flash",
        name: "Antigravity 2.0 Flash (急速响应)",
        contextWindow: 1000000,
        maxOutputTokens: 8192,
      },
      {
        id: "gemini-1.5-pro",
        name: "Antigravity 1.5 Pro (深度推理)",
        contextWindow: 1000000,
        maxOutputTokens: 8192,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 180,
    lastChecked: "刚刚",
    balance: "OAuth / RT 自动保活",
    icon: "gemini",
  },
  {
    id: "chan-ollama",
    name: "Ollama (本地大模型)",
    type: "ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    apiKey: "ollama",
    models: ["deepseek-r1:7b", "qwen2.5-coder:7b", "llama3.3:latest"],
    modelMetas: [
      {
        id: "deepseek-r1:7b",
        name: "DeepSeek R1 7B 本地",
        contextWindow: 32000,
        maxOutputTokens: 4096,
        supportsThinking: true,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 2,
    lastChecked: "本地运行",
    balance: "本地无限制",
    icon: "ollama",
  },
  {
    id: "chan-bailian",
    name: "阿里百炼 (DashScope / 通义千问)",
    type: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: "",
    models: [
      "qwen-plus-latest",
      "qwen-max-latest",
      "qwen-turbo-latest",
      "qwen2.5-coder-32b-instruct",
      "deepseek-r1",
      "deepseek-v3",
      "qwq-32b",
    ],
    modelMetas: [
      {
        id: "qwen-plus-latest",
        name: "通义千问 Plus (主力)",
        contextWindow: 128000,
        maxOutputTokens: 8192,
      },
      {
        id: "qwen-max-latest",
        name: "通义千问 Max (旗舰)",
        contextWindow: 32000,
        maxOutputTokens: 8192,
      },
      {
        id: "qwen-turbo-latest",
        name: "通义千问 Turbo (1M 百万上下文)",
        contextWindow: 1000000,
        maxOutputTokens: 8192,
      },
      {
        id: "qwen2.5-coder-32b-instruct",
        name: "Qwen 2.5 Coder (代码专家)",
        contextWindow: 128000,
        maxOutputTokens: 8192,
      },
      {
        id: "deepseek-r1",
        name: "DeepSeek-R1 (百炼托管推理)",
        contextWindow: 64000,
        maxOutputTokens: 8192,
        supportsThinking: true,
      },
      {
        id: "qwq-32b",
        name: "QwQ-32B (推理模型)",
        contextWindow: 128000,
        maxOutputTokens: 8192,
        supportsThinking: true,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 18,
    lastChecked: "刚刚",
    balance: "¥ 50.00",
    icon: "bailian",
  },
  {
    id: "chan-newapi",
    name: "New API / One API 聚合中转",
    type: "openai",
    baseUrl: "https://api.openai-proxy.org/v1",
    apiKey: "",
    models: [
      "claude-3-7-sonnet",
      "deepseek-r1",
      "deepseek-v3",
      "gpt-4o",
      "gemini-2.0-flash",
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 65,
    lastChecked: "刚刚",
    balance: "¥ 500.00",
    icon: "newapi",
  },
];

export const DEFAULT_CONFIG: GlobalLLMConfig = {
  activeChannelId: "chan-deepseek",
  activeModelId: "deepseek-reasoner",
  channels: DEFAULT_CHANNELS,
  temperature: 0.7,
  maxTokens: 4096,
  stream: true,
  timeoutSec: 60,
  defaultCompressionThreshold: 0.95,
};

class LLMConfigService {
  private config: GlobalLLMConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  // 加载本地配置
  public loadConfig(): GlobalLLMConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.channels) && parsed.channels.length > 0) {
          // 自动升级旧版 chan-gemini 到 chan-antigravity
          const normalizedChannels = parsed.channels.map((c: LLMChannel) => {
            if (c.id === "chan-gemini" || c.name.includes("Gemini 官方")) {
              const antigravityDef = DEFAULT_CHANNELS.find((d) => d.id === "chan-antigravity")!;
              return {
                ...c,
                id: "chan-antigravity",
                name: "Google Antigravity 官方 (支持 OAuth / RT)",
                type: "gemini" as const,
                models: antigravityDef.models,
                modelMetas: antigravityDef.modelMetas,
                geminiAuth: c.geminiAuth || antigravityDef.geminiAuth,
              };
            }
            return c;
          });

          // 自动合并新预设渠道 (如阿里百炼 / Antigravity)
          const existingIds = new Set(normalizedChannels.map((c: LLMChannel) => c.id));
          const missingDefaults = DEFAULT_CHANNELS.filter((def) => !existingIds.has(def.id));
          const mergedChannels = [...normalizedChannels, ...missingDefaults];
          
          let activeChannelId = parsed.activeChannelId;
          if (activeChannelId === "chan-gemini") activeChannelId = "chan-antigravity";

          return { ...DEFAULT_CONFIG, ...parsed, activeChannelId, channels: mergedChannels };
        }
      }
    } catch (e) {
      console.warn("Failed to read localStorage config, using defaults:", e);
    }
    return DEFAULT_CONFIG;
  }

  // 保存配置至本地
  public saveConfig(newConfig: GlobalLLMConfig): void {
    this.config = newConfig;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      window.dispatchEvent(new CustomEvent("llm-config-updated", { detail: newConfig }));
    } catch (e) {
      console.error("Failed to save config to localStorage:", e);
    }
  }

  public getConfig(): GlobalLLMConfig {
    return this.config;
  }

  public getChannels(): LLMChannel[] {
    return this.config.channels;
  }

  public getActiveChannel(): LLMChannel | undefined {
    return (
      this.config.channels.find((c) => c.id === this.config.activeChannelId) ||
      this.config.channels[0]
    );
  }

  public getActiveModelContextWindow(): number {
    const channel = this.getActiveChannel();
    if (!channel) return 128000;
    const modelId = this.config.activeModelId;
    const meta = channel.modelMetas?.find((m) => m.id === modelId);
    if (meta && meta.contextWindow) return meta.contextWindow;
    if (modelId.includes("gemini") || modelId.includes("1m")) return 1000000;
    if (modelId.includes("claude") || modelId.includes("200k")) return 200000;
    if (modelId.includes("deepseek") || modelId.includes("gpt-4")) return 128000;
    return 128000;
  }

  public setActiveChannel(channelId: string): void {
    const channel = this.config.channels.find((c) => c.id === channelId);
    const activeModelId =
      channel && channel.models.length > 0 ? channel.models[0] : this.config.activeModelId;
    this.saveConfig({
      ...this.config,
      activeChannelId: channelId,
      activeModelId: activeModelId,
    });
  }

  public getActiveModel(): string {
    return this.config.activeModelId;
  }

  public setActiveModel(modelId: string): void {
    this.saveConfig({
      ...this.config,
      activeModelId: modelId,
    });
  }

  public addOrUpdateChannel(channel: LLMChannel): void {
    const existingIndex = this.config.channels.findIndex((c) => c.id === channel.id);
    let updatedChannels: LLMChannel[];
    if (existingIndex >= 0) {
      updatedChannels = [...this.config.channels];
      updatedChannels[existingIndex] = channel;
    } else {
      updatedChannels = [...this.config.channels, channel];
    }
    this.saveConfig({
      ...this.config,
      channels: updatedChannels,
    });
  }

  public deleteChannel(channelId: string): void {
    const updatedChannels = this.config.channels.filter((c) => c.id !== channelId);
    let activeChannelId = this.config.activeChannelId;
    if (activeChannelId === channelId) {
      activeChannelId = updatedChannels.length > 0 ? updatedChannels[0].id : "";
    }
    this.saveConfig({
      ...this.config,
      channels: updatedChannels,
      activeChannelId: activeChannelId,
    });
  }

  public toggleChannel(channelId: string, enabled: boolean): void {
    const updatedChannels = this.config.channels.map((c) =>
      c.id === channelId
        ? { ...c, status: enabled ? ("active" as const) : ("disabled" as const) }
        : c
    );
    this.saveConfig({
      ...this.config,
      channels: updatedChannels,
    });
  }

  /**
   * 真实从 API 端点一键拉取同步模型列表 (Sync Models from Provider API)
   */
  public async syncModelsFromEndpoint(
    channel: LLMChannel
  ): Promise<{ ok: boolean; models: string[]; count: number; error?: string }> {
    try {
      const cleanUrl = channel.baseUrl.replace(/\/+$/, "");
      let fetchUrl = `${cleanUrl}/models`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // 针对 Gemini OAuth / RT
      if (channel.type === "gemini" && channel.geminiAuth && channel.geminiAuth.mode !== "apikey") {
        if (channel.geminiAuth.refreshToken) {
          const authRes = await geminiAuthService.refreshAccessToken(channel.geminiAuth);
          if (authRes.ok && authRes.accessToken) {
            headers["Authorization"] = `Bearer ${authRes.accessToken}`;
          }
        }
      } else if (channel.apiKey) {
        if (channel.type === "anthropic") {
          headers["x-api-key"] = channel.apiKey;
          headers["anthropic-version"] = "2023-06-01";
        } else {
          headers["Authorization"] = `Bearer ${channel.apiKey}`;
        }
      }

      // 针对 Ollama 本地 API 端点
      if (channel.type === "ollama") {
        const rootUrl = cleanUrl.replace(/\/v1$/, "");
        fetchUrl = `${rootUrl}/api/tags`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(fetchUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`端点返回 HTTP ${res.status}`);
      }

      const data = await res.json();
      let fetchedModelIds: string[] = [];

      // 1. OpenAI / New API / SiliconFlow / DeepSeek 格式: { data: [{ id: "..." }] }
      if (Array.isArray(data.data)) {
        fetchedModelIds = data.data.map((item: any) => item.id || item.name).filter(Boolean);
      }
      // 2. Ollama 格式: { models: [{ name: "deepseek-r1:7b" }] }
      else if (Array.isArray(data.models)) {
        fetchedModelIds = data.models.map((item: any) => item.name || item.model).filter(Boolean);
      }
      // 3. 直接数组格式
      else if (Array.isArray(data)) {
        fetchedModelIds = data.map((item: any) => (typeof item === "string" ? item : item.id)).filter(Boolean);
      }

      if (fetchedModelIds.length === 0) {
        throw new Error("端点返回了空模型列表");
      }

      // 合并并去重
      const mergedModels = Array.from(new Set([...channel.models, ...fetchedModelIds]));

      // 构建更新后的 ModelMetas
      const existingMetas = channel.modelMetas || [];
      const updatedMetas: ModelMeta[] = mergedModels.map((mId) => {
        const found = existingMetas.find((meta) => meta.id === mId);
        if (found) return found;

        let ctx = 128000;
        if (mId.includes("1m") || mId.includes("gemini")) ctx = 1000000;
        else if (mId.includes("claude") || mId.includes("200k")) ctx = 200000;
        else if (mId.includes("32k") || mId.includes("7b")) ctx = 32000;

        return {
          id: mId,
          name: mId,
          contextWindow: ctx,
          supportsThinking: mId.includes("reasoner") || mId.includes("r1") || mId.includes("thinking"),
        };
      });

      const updatedChan: LLMChannel = {
        ...channel,
        models: mergedModels,
        modelMetas: updatedMetas,
      };

      this.addOrUpdateChannel(updatedChan);

      return {
        ok: true,
        models: mergedModels,
        count: fetchedModelIds.length,
      };
    } catch (err: any) {
      return {
        ok: false,
        models: [],
        count: 0,
        error: err.message || "同步请求失败，请检查 Base URL 与 API Key 是否有效",
      };
    }
  }

  // 真实连通性测试 (支持常规 API Key 与 Gemini OAuth / RT 自动刷新)
  public async testChannelConnectivity(
    channel: LLMChannel
  ): Promise<{ ok: boolean; latency: number; error?: string; statusCode?: number; email?: string }> {
    const startTime = performance.now();
    try {
      const cleanUrl = channel.baseUrl.replace(/\/+$/, "");
      const probeUrl = `${cleanUrl}/models`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (channel.type === "gemini" && channel.geminiAuth && channel.geminiAuth.mode !== "apikey") {
        if (channel.geminiAuth.refreshToken) {
          const authRes = await geminiAuthService.refreshAccessToken(channel.geminiAuth);
          if (!authRes.ok) {
            return {
              ok: false,
              latency: authRes.latencyMs || 0,
              error: `Google OAuth/RT 刷新失败: ${authRes.error}`,
            };
          }
          headers["Authorization"] = `Bearer ${authRes.accessToken}`;

          const updatedChan: LLMChannel = {
            ...channel,
            geminiAuth: {
              ...channel.geminiAuth,
              accessToken: authRes.accessToken,
              tokenExpiresAt: authRes.expiresAt,
              accountEmail: authRes.email,
              lastRefreshedAt: new Date().toLocaleTimeString(),
            },
          };
          this.addOrUpdateChannel(updatedChan);
        }
      } else if (channel.apiKey) {
        if (channel.type === "anthropic") {
          headers["x-api-key"] = channel.apiKey;
          headers["anthropic-version"] = "2023-06-01";
        } else {
          headers["Authorization"] = `Bearer ${channel.apiKey}`;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(probeUrl, {
        method: "GET",
        headers: headers,
        signal: controller.signal,
      }).catch(async () => {
        return await fetch(cleanUrl, {
          method: "GET",
          headers: headers,
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);

      if (res && (res.status === 200 || res.status === 404 || res.status === 400 || res.status === 401)) {
        const isOk =
          res.status === 200 ||
          (res.status === 401 && !channel.apiKey && !channel.geminiAuth?.refreshToken);

        this.addOrUpdateChannel({
          ...channel,
          latencyMs: latency,
          lastChecked: "刚刚",
          status: isOk ? "active" : "active",
        });

        return {
          ok: isOk,
          latency,
          statusCode: res.status,
          email: channel.geminiAuth?.accountEmail,
          error: res.status === 401 ? "HTTP 401: 未配置有效凭据或凭据已失效" : undefined,
        };
      } else {
        throw new Error(`HTTP ${res?.status || "Network error"}`);
      }
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      return {
        ok: false,
        latency,
        error: err.name === "AbortError" ? "请求超时 (6000ms)" : err.message || "网络连接失败",
      };
    }
  }

  // 导出配置 JSON
  public exportConfigJson(): string {
    return JSON.stringify(this.config, null, 2);
  }

  // 导入配置 JSON
  public importConfigJson(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && Array.isArray(parsed.channels)) {
        this.saveConfig({ ...DEFAULT_CONFIG, ...parsed });
        return true;
      }
    } catch (e) {
      console.error("Invalid JSON config:", e);
    }
    return false;
  }
}

export const llmConfigService = new LLMConfigService();
