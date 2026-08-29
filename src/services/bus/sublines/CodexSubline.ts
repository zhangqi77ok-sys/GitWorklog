import { ModelMeta } from '../../../types';
import { IProviderSubline, SublineHealthResult, SublineModelSyncResult, BusStreamRequest, BusStreamCallbacks } from '../types';
import { RelayConfig, IRelayAdapter } from '../relays/types';
import { DirectRelayAdapter } from '../relays/DirectRelay';
import { NewApiRelayAdapter } from '../relays/NewApiRelay';
import { Sub2ApiRelayAdapter } from '../relays/Sub2ApiRelay';

export interface CodexSublineConfig {
  type: 'codex';
  relay: RelayConfig;
  models: string[];
  modelMetas: ModelMeta[];
}

export class CodexSubline implements IProviderSubline<CodexSublineConfig> {
  readonly id = 'subline-codex';
  readonly name = 'OpenAI Codex (代码编程模型)';
  readonly protocol = 'openai';
  readonly icon = 'openai';

  private config: CodexSublineConfig;

  constructor(initialConfig?: Partial<CodexSublineConfig>) {
    this.config = {
      type: 'codex',
      relay: {
        type: 'direct',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
      },
      models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini', 'codex-davinci-002'],
      modelMetas: [
        { id: 'gpt-4o', name: 'GPT-4o (全能代码多模态)', contextWindow: 128000, maxOutputTokens: 16384 },
        { id: 'o3-mini', name: 'o3-mini (深度代码推理)', contextWindow: 200000, maxOutputTokens: 65536, supportsThinking: true },
        { id: 'o1', name: 'o1 (旗舰满血推理)', contextWindow: 200000, maxOutputTokens: 65536, supportsThinking: true },
      ],
      ...initialConfig,
    };
  }

  private getRelayAdapter(): IRelayAdapter {
    switch (this.config.relay.type) {
      case 'newapi':
        return new NewApiRelayAdapter();
      case 'sub2api':
        return new Sub2ApiRelayAdapter();
      default:
        return new DirectRelayAdapter();
    }
  }

  getConfig(): CodexSublineConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<CodexSublineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  async probeHealth(): Promise<SublineHealthResult> {
    const adapter = this.getRelayAdapter();
    const probe = await adapter.probeRelay(this.config.relay);
    return {
      ok: probe.ok,
      latencyMs: probe.latencyMs,
      statusCode: probe.statusCode,
      endpointUrl: this.config.relay.baseUrl,
      message: `${adapter.name}: ${probe.message}`,
    };
  }

  async fetchOfficialModels(): Promise<SublineModelSyncResult> {
    const adapter = this.getRelayAdapter();
    const modelsUrl = adapter.formatEndpoint(this.config.relay.baseUrl, 'models');
    const headers = adapter.formatHeaders(this.config.relay.apiKey, this.config.relay.channelId);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(modelsUrl, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          const ids = data.data.map((m: any) => m.id).filter(Boolean);
          const metas: ModelMeta[] = ids.map((mId: string) => ({
            id: mId,
            name: `${mId} (Codex)`,
            contextWindow: mId.includes('o1') || mId.includes('o3') ? 200000 : 128000,
            supportsThinking: mId.includes('o1') || mId.includes('o3') || mId.includes('reasoner'),
          }));
          this.config.models = ids;
          this.config.modelMetas = metas;
          return {
            ok: true,
            models: ids,
            modelMetas: metas,
            count: ids.length,
            source: 'cloud_endpoint',
          };
        }
      }
      return {
        ok: false,
        models: [],
        modelMetas: [],
        count: 0,
        source: 'cloud_endpoint',
        error: `端点响应 HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (e: any) {
      return {
        ok: false,
        models: [],
        modelMetas: [],
        count: 0,
        source: 'cloud_endpoint',
        error: `模型同步失败: ${e.message || '网络连接超时'}`,
      };
    }
  }

  async executeStream(
    request: BusStreamRequest,
    callbacks: BusStreamCallbacks
  ): Promise<void> {
    const startTime = performance.now();
    const adapter = this.getRelayAdapter();
    const endpoint = adapter.formatEndpoint(this.config.relay.baseUrl, 'chat/completions');
    const headers = adapter.formatHeaders(this.config.relay.apiKey, this.config.relay.channelId);

    const body: any = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    };

    if (request.enableThinking) {
      body.stream_options = { include_usage: true };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: request.abortSignal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Codex 返回 HTTP ${res.status}: ${errText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('流式响应体不可读');

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
            if (delta) {
              if (delta.reasoning_content && callbacks.onThinkingChunk) {
                callbacks.onThinkingChunk(delta.reasoning_content);
              }
              if (delta.content) {
                tokensCount++;
                callbacks.onChunk(delta.content);
              }
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
