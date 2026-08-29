import { ModelMeta } from '../../../types';
import { IProviderSubline, SublineHealthResult, SublineModelSyncResult, BusStreamRequest, BusStreamCallbacks } from '../types';

export interface OllamaSublineConfig {
  type: 'ollama';
  baseUrl: string;
  models: string[];
  modelMetas: ModelMeta[];
}

export class OllamaSubline implements IProviderSubline<OllamaSublineConfig> {
  readonly id = 'subline-ollama';
  readonly name = 'Ollama 本地大模型';
  readonly protocol = 'ollama';
  readonly icon = 'ollama';

  private config: OllamaSublineConfig;

  constructor(initialConfig?: Partial<OllamaSublineConfig>) {
    this.config = {
      type: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      models: ['qwen2.5-coder:7b', 'deepseek-r1:8b', 'llama3.2:3b'],
      modelMetas: [],
      ...initialConfig,
    };
  }

  getConfig(): OllamaSublineConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<OllamaSublineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  async probeHealth(): Promise<SublineHealthResult> {
    const startTime = performance.now();
    const cleanUrl = this.config.baseUrl.replace(/\/+$/, '');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${cleanUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);
      if (res.ok) {
        return {
          ok: true,
          latencyMs,
          statusCode: 200,
          endpointUrl: cleanUrl,
          message: `Ollama 本地服务运行正常 (延迟: ${latencyMs}ms)`,
        };
      }
    } catch {}

    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      latencyMs,
      endpointUrl: cleanUrl,
      message: '无法连接本地 Ollama 服务 (11434)。请确保在终端运行了 ollama serve',
    };
  }

  async fetchOfficialModels(): Promise<SublineModelSyncResult> {
    const cleanUrl = this.config.baseUrl.replace(/\/+$/, '');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${cleanUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          const modelIds = data.models.map((m: any) => m.name || m.model).filter(Boolean);
          const metas: ModelMeta[] = modelIds.map((mId: string) => ({
            id: mId,
            name: `${mId} (Ollama)`,
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
            source: 'local_server',
          };
        }
      }
    } catch (e: any) {
      return {
        ok: false,
        models: [],
        modelMetas: [],
        count: 0,
        source: 'local_server',
        error: `无法从 Ollama (${cleanUrl}/api/tags) 获取模型: ${e.message || '服务未启动'}`,
      };
    }

    return {
      ok: false,
      models: [],
      modelMetas: [],
      count: 0,
      source: 'local_server',
      error: 'Ollama 服务返回了无效数据',
    };
  }

  async executeStream(
    request: BusStreamRequest,
    callbacks: BusStreamCallbacks
  ): Promise<void> {
    const startTime = performance.now();
    const cleanUrl = this.config.baseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/v1/chat/completions`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        stream: true,
      }),
      signal: request.abortSignal,
    });

    if (!res.ok) throw new Error(`Ollama 返回 HTTP ${res.status}`);
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
