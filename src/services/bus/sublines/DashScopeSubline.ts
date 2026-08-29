import { ModelMeta } from '../../../types';
import { IProviderSubline, SublineHealthResult, SublineModelSyncResult, BusStreamRequest, BusStreamCallbacks } from '../types';

export interface DashScopeSublineConfig {
  type: 'dashscope';
  baseUrl: string;
  apiKey: string;
  models: string[];
  modelMetas: ModelMeta[];
}

export class DashScopeSubline implements IProviderSubline<DashScopeSublineConfig> {
  readonly id = 'subline-dashscope';
  readonly name = '阿里百炼 (DashScope / Qwen)';
  readonly protocol = 'dashscope';
  readonly icon = 'alicloud';

  private config: DashScopeSublineConfig;

  constructor(initialConfig?: Partial<DashScopeSublineConfig>) {
    this.config = {
      type: 'dashscope',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: '',
      models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-coder-plus', 'deepseek-r1', 'deepseek-v3'],
      modelMetas: [
        {
          id: 'qwen-plus',
          name: '通义千问 Plus (均衡大模型)',
          contextWindow: 128000,
          maxOutputTokens: 8192,
        },
        {
          id: 'qwen-max',
          name: '通义千问 Max (旗舰满血模型)',
          contextWindow: 128000,
          maxOutputTokens: 8192,
        },
        {
          id: 'qwen-coder-plus',
          name: '通义千问 Coder Plus (代码强化)',
          contextWindow: 128000,
          maxOutputTokens: 8192,
        },
        {
          id: 'deepseek-r1',
          name: 'DeepSeek R1 (百炼推理版)',
          contextWindow: 64000,
          maxOutputTokens: 8192,
          supportsThinking: true,
        },
      ],
      ...initialConfig,
    };
  }

  getConfig(): DashScopeSublineConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<DashScopeSublineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  async probeHealth(): Promise<SublineHealthResult> {
    const startTime = performance.now();
    if (!this.config.apiKey?.trim()) {
      return {
        ok: false,
        latencyMs: 0,
        endpointUrl: this.config.baseUrl,
        message: '请先在配置中填入 DashScope API Key',
      };
    }

    try {
      const cleanUrl = this.config.baseUrl.replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${cleanUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        return {
          ok: true,
          latencyMs,
          statusCode: 200,
          endpointUrl: cleanUrl,
          message: `阿里百炼云端服务就绪 (延迟: ${latencyMs}ms)`,
        };
      }
    } catch {}

    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      latencyMs,
      endpointUrl: this.config.baseUrl,
      message: '阿里百炼连接失败，请检查 API Key 与网络',
    };
  }

  async fetchOfficialModels(): Promise<SublineModelSyncResult> {
    if (!this.config.apiKey?.trim()) {
      return {
        ok: false,
        models: [],
        modelMetas: [],
        count: 0,
        source: 'cloud_endpoint',
        error: '请先填入阿里百炼 API Key',
      };
    }

    const cleanUrl = this.config.baseUrl.replace(/\/+$/, '');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${cleanUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          const modelIds = data.data.map((item: any) => item.id).filter(Boolean);
          const metas: ModelMeta[] = modelIds.map((mId: string) => ({
            id: mId,
            name: `${mId} (百炼)`,
            contextWindow: 128000,
            supportsThinking: mId.includes('r1') || mId.includes('reasoner'),
          }));
          this.config.models = modelIds;
          this.config.modelMetas = metas;
          return {
            ok: true,
            models: modelIds,
            modelMetas: metas,
            count: modelIds.length,
            source: 'cloud_endpoint',
          };
        }
      }
    } catch (e: any) {
      return {
        ok: false,
        models: [],
        modelMetas: [],
        count: 0,
        source: 'cloud_endpoint',
        error: `百炼模型同步失败: ${e.message}`,
      };
    }

    return {
      ok: false,
      models: [],
      modelMetas: [],
      count: 0,
      source: 'cloud_endpoint',
      error: '未能从百炼接口拉取到模型列表',
    };
  }

  async executeStream(
    request: BusStreamRequest,
    callbacks: BusStreamCallbacks
  ): Promise<void> {
    const startTime = performance.now();
    const cleanUrl = this.config.baseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/chat/completions`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
      }),
      signal: request.abortSignal,
    });

    if (!res.ok) throw new Error(`阿里百炼返回 HTTP ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('流式读取不可用');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let tokensCount = 0;

    while (true) {
      if (request.abortSignal?.aborted) {
        reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta;
            if (delta?.reasoning_content && callbacks.onThinkingChunk) {
              callbacks.onThinkingChunk(delta.reasoning_content);
            }
            if (delta?.content) {
              tokensCount++;
              callbacks.onChunk(delta.content);
            }
          } catch {}
        }
      }
    }

    const durationMs = Math.round(performance.now() - startTime);
    const tokensPerSec = durationMs > 0 ? Math.round((tokensCount / durationMs) * 1000) : tokensCount;
    callbacks.onComplete({ durationMs, tokensCount, tokensPerSec });
  }
}
