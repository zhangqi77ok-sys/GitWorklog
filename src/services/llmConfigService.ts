import { LLMChannel, GlobalLLMConfig } from "../types";
import { isOpenCodeBaseUrl } from "./opencodeService";
import { gatewayBus } from "./bus/GatewayBus";

const STORAGE_KEY = "codemind_llm_config_v3";

export const DEFAULT_CHANNELS: LLMChannel[] = [
  {
    id: "chan-opencode",
    name: "OpenCode 编程引擎 (本地/远程)",
    type: "opencode",
    baseUrl: "http://127.0.0.1:4096/v1",
    apiKey: "opencode-local",
    relayMode: "direct",
    newApiChannelId: "",
    sub2ApiUrl: "",
    models: [
      "opencode/claude-3-7-sonnet",
      "opencode/deepseek-r1",
      "opencode/gpt-4o",
      "opencode/qwen-2.5-coder-32b",
      "opencode/gemini-2.5-pro",
    ],
    modelMetas: [
      {
        id: "opencode/claude-3-7-sonnet",
        name: "Claude 3.7 Sonnet (OpenCode)",
        contextWindow: 200000,
        maxOutputTokens: 64000,
        supportsThinking: true,
      },
      {
        id: "opencode/deepseek-r1",
        name: "DeepSeek R1 (OpenCode 推理)",
        contextWindow: 128000,
        maxOutputTokens: 8192,
        supportsThinking: true,
      },
      {
        id: "opencode/gpt-4o",
        name: "GPT-4o (OpenCode 多模态)",
        contextWindow: 128000,
        maxOutputTokens: 16384,
      },
      {
        id: "opencode/qwen-2.5-coder-32b",
        name: "Qwen 2.5 Coder 32B (OpenCode)",
        contextWindow: 128000,
        maxOutputTokens: 8192,
      },
      {
        id: "opencode/gemini-2.5-pro",
        name: "Gemini 2.5 Pro (OpenCode)",
        contextWindow: 1000000,
        maxOutputTokens: 65536,
        supportsThinking: true,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 5,
    lastChecked: "就绪",
    balance: "开源免费 / 官方 models.dev",
    icon: "opencode",
  },
  {
    id: "chan-codex",
    name: "OpenAI Codex (代码增强标准)",
    type: "codex",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    relayMode: "direct",
    newApiChannelId: "",
    sub2ApiUrl: "",
    models: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini", "codex-davinci-002"],
    modelMetas: [
      {
        id: "gpt-4o",
        name: "GPT-4o (全能代码多模态)",
        contextWindow: 128000,
        maxOutputTokens: 16384,
      },
      {
        id: "o3-mini",
        name: "o3-mini (深度代码推理)",
        contextWindow: 200000,
        maxOutputTokens: 65536,
        supportsThinking: true,
      },
      {
        id: "o1",
        name: "o1 (旗舰满血推理)",
        contextWindow: 200000,
        maxOutputTokens: 65536,
        supportsThinking: true,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 120,
    lastChecked: "刚刚",
    balance: "$ 10.00",
    icon: "openai",
  },
  {
    id: "chan-claude",
    name: "Claude (Claude Code 编程引擎)",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    relayMode: "direct",
    newApiChannelId: "",
    sub2ApiUrl: "",
    models: [
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    modelMetas: [
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet (原生混合推理)",
        contextWindow: 200000,
        maxOutputTokens: 64000,
        supportsThinking: true,
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet (编码旗舰)",
        contextWindow: 200000,
        maxOutputTokens: 8192,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku (超高速轻量)",
        contextWindow: 200000,
        maxOutputTokens: 8192,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 145,
    lastChecked: "刚刚",
    balance: "$ 20.00",
    icon: "claude",
  },
  {
    id: "chan-bailian",
    name: "阿里百炼 (DashScope / 通义千问)",
    type: "bailian",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: "",
    relayMode: "direct",
    newApiChannelId: "",
    sub2ApiUrl: "",
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
        name: "DeepSeek-R1 (百炼满血推理)",
        contextWindow: 64000,
        maxOutputTokens: 8192,
        supportsThinking: true,
      },
    ],
    compressionThreshold: 0.95,
    status: "active",
    latencyMs: 28,
    lastChecked: "刚刚",
    balance: "国内直连专线",
    icon: "alicloud",
  },
];

export const DEFAULT_CONFIG: GlobalLLMConfig = {
  activeChannelId: "chan-opencode",
  activeModelId: "opencode/claude-3-7-sonnet",
  channels: DEFAULT_CHANNELS,
  temperature: 0.2,
  maxTokens: 8192,
  stream: true,
  timeoutSec: 120,
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
          // 彻底过滤 Antigravity 历史数据
          const cleanChannels = (parsed.channels || []).filter(
            (c: any) => c.id !== "chan-antigravity" && c.id !== "chan-gemini" && !c.name?.includes("Antigravity")
          );

          // 自动合并新预设渠道
          const existingIds = new Set(cleanChannels.map((c: LLMChannel) => c.id));
          const missingDefaults = DEFAULT_CHANNELS.filter((def) => !existingIds.has(def.id));
          const mergedChannels = [...cleanChannels, ...missingDefaults].map((c: LLMChannel) => {
            const clean = { ...c };
            delete (clean as any).geminiAuth;
            return clean;
          });

          let activeChannelId = parsed.activeChannelId;
          if (activeChannelId === "chan-gemini" || activeChannelId === "chan-antigravity" || !activeChannelId) {
            activeChannelId = "chan-opencode";
          }

          let activeModelId = parsed.activeModelId;
          if (!activeModelId || activeModelId.includes("antigravity")) {
            activeModelId = "opencode/claude-3-7-sonnet";
          }

          return { ...DEFAULT_CONFIG, ...parsed, activeChannelId, activeModelId, channels: mergedChannels };
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

  public getActiveModel(): string {
    return this.config.activeModelId;
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
    if (modelId.includes("1m") || modelId.includes("gemini")) return 1000000;
    if (modelId.includes("claude") || modelId.includes("200k")) return 200000;
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
    // 同步切换中央总线的激活子线
    if (channelId.includes("opencode")) gatewayBus.setActiveSubline("subline-opencode");
    else if (channelId.includes("codex")) gatewayBus.setActiveSubline("subline-codex");
    else if (channelId.includes("claude")) gatewayBus.setActiveSubline("subline-claude");
    else if (channelId.includes("bailian")) gatewayBus.setActiveSubline("subline-dashscope");
  }

  public setActiveModel(modelId: string): void {
    this.saveConfig({
      ...this.config,
      activeModelId: modelId,
    });
  }

  public addOrUpdateChannel(channel: LLMChannel): void {
    const channels = [...this.config.channels];
    const index = channels.findIndex((c) => c.id === channel.id);
    if (index >= 0) {
      channels[index] = channel;
    } else {
      channels.push(channel);
    }
    this.saveConfig({
      ...this.config,
      channels,
    });
  }

  public removeChannel(channelId: string): void {
    const updatedChannels = this.config.channels.filter((c) => c.id !== channelId);
    this.saveConfig({
      ...this.config,
      channels: updatedChannels,
    });
  }

  // 真实从 API 端点/官方中枢拉取同步模型列表
  public async syncModelsFromEndpoint(
    channel: LLMChannel
  ): Promise<{ ok: boolean; models: string[]; count: number; error?: string }> {
    // 1. OpenCode 子线
    if (channel.type === "opencode" || channel.id === "chan-opencode" || isOpenCodeBaseUrl(channel.baseUrl)) {
      const subline = gatewayBus.getSubline("subline-opencode");
      if (subline) {
        subline.updateConfig({ baseUrl: channel.baseUrl, apiKey: channel.apiKey });
        const res = await subline.fetchOfficialModels();
        if (res.ok) {
          const updated: LLMChannel = {
            ...channel,
            models: res.models,
            modelMetas: res.modelMetas,
          };
          this.addOrUpdateChannel(updated);
          return { ok: true, models: res.models, count: res.count };
        }
        return { ok: false, models: [], count: 0, error: res.error };
      }
    }

    // 2. Codex 子线
    if (channel.type === "codex" || channel.id === "chan-codex") {
      const subline = gatewayBus.getSubline("subline-codex");
      if (subline) {
        subline.updateConfig({
          relay: {
            type: channel.relayMode || "direct",
            baseUrl: channel.baseUrl,
            apiKey: channel.apiKey,
            channelId: channel.newApiChannelId,
            subscriptionUrl: channel.sub2ApiUrl,
          },
        });
        const res = await subline.fetchOfficialModels();
        if (res.ok) {
          this.addOrUpdateChannel({
            ...channel,
            models: res.models,
            modelMetas: res.modelMetas,
          });
          return { ok: true, models: res.models, count: res.count };
        }
        return { ok: false, models: [], count: 0, error: res.error };
      }
    }

    // 3. Claude 子线
    if (channel.type === "anthropic" || channel.id === "chan-claude") {
      const subline = gatewayBus.getSubline("subline-claude");
      if (subline) {
        subline.updateConfig({
          relay: {
            type: channel.relayMode || "direct",
            baseUrl: channel.baseUrl,
            apiKey: channel.apiKey,
            channelId: channel.newApiChannelId,
            subscriptionUrl: channel.sub2ApiUrl,
          },
        });
        const res = await subline.fetchOfficialModels();
        if (res.ok) {
          this.addOrUpdateChannel({
            ...channel,
            models: res.models,
            modelMetas: res.modelMetas,
          });
          return { ok: true, models: res.models, count: res.count };
        }
        return { ok: false, models: [], count: 0, error: res.error };
      }
    }

    // 4. 阿里百炼子线
    if (channel.type === "bailian" || channel.id === "chan-bailian") {
      const subline = gatewayBus.getSubline("subline-dashscope");
      if (subline) {
        subline.updateConfig({ baseUrl: channel.baseUrl, apiKey: channel.apiKey });
        const res = await subline.fetchOfficialModels();
        if (res.ok) {
          this.addOrUpdateChannel({
            ...channel,
            models: res.models,
            modelMetas: res.modelMetas,
          });
          return { ok: true, models: res.models, count: res.count };
        }
        return { ok: false, models: [], count: 0, error: res.error };
      }
    }

    // 通用 OpenAI 兼容端点拉取
    try {
      const cleanBase = channel.baseUrl.replace(/\/+$/, "");
      const modelsUrl = cleanBase.endsWith("/models") ? cleanBase : `${cleanBase}/models`;
      const res = await fetch(modelsUrl, {
        headers: {
          Authorization: `Bearer ${channel.apiKey}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          const ids = data.data.map((m: any) => m.id).filter(Boolean);
          this.addOrUpdateChannel({ ...channel, models: ids });
          return { ok: true, models: ids, count: ids.length };
        }
      }
      return { ok: false, models: [], count: 0, error: `HTTP ${res.status}: ${res.statusText}` };
    } catch (e: any) {
      return { ok: false, models: [], count: 0, error: e.message || "无法连接到端点" };
    }
  }

  // 真实连通性测试 (Ping)
  public async testChannelConnectivity(
    channel: LLMChannel
  ): Promise<{ ok: boolean; latency: number; error?: string; statusCode?: number }> {
    const startTime = performance.now();

    // 委托对应子线执行健康探测
    let targetSublineId = "subline-opencode";
    if (channel.type === "codex" || channel.id === "chan-codex") targetSublineId = "subline-codex";
    else if (channel.type === "anthropic" || channel.id === "chan-claude") targetSublineId = "subline-claude";
    else if (channel.type === "bailian" || channel.id === "chan-bailian") targetSublineId = "subline-dashscope";

    const subline = gatewayBus.getSubline(targetSublineId);
    if (subline) {
      (subline as any).updateConfig?.({
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        relay: {
          type: channel.relayMode || "direct",
          baseUrl: channel.baseUrl,
          apiKey: channel.apiKey,
          channelId: channel.newApiChannelId,
          subscriptionUrl: channel.sub2ApiUrl,
        },
      });
      const probe = await subline.probeHealth();
      this.addOrUpdateChannel({
        ...channel,
        latencyMs: probe.latencyMs,
        lastChecked: "刚刚",
        status: probe.ok ? "active" : "error",
      });
      return {
        ok: probe.ok,
        latency: probe.latencyMs,
        statusCode: probe.statusCode,
        error: probe.ok ? undefined : probe.message,
      };
    }

    // 通用降级 Ping
    try {
      const cleanBase = channel.baseUrl.replace(/\/+$/, "");
      const res = await fetch(`${cleanBase}/models`, {
        headers: { Authorization: `Bearer ${channel.apiKey}` },
      });
      const latency = Math.round(performance.now() - startTime);
      return { ok: res.ok, latency, statusCode: res.status };
    } catch (e: any) {
      return { ok: false, latency: Math.round(performance.now() - startTime), error: e.message };
    }
  }
}

export const llmConfigService = new LLMConfigService();
