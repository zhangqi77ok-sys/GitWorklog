import { ModelMeta } from '../../../types';
import { IProviderSubline, SublineHealthResult, SublineModelSyncResult, BusStreamRequest, BusStreamCallbacks } from '../types';
import { RelayConfig, IRelayAdapter } from '../relays/types';
import { DirectRelayAdapter } from '../relays/DirectRelay';
import { NewApiRelayAdapter } from '../relays/NewApiRelay';
import { Sub2ApiRelayAdapter } from '../relays/Sub2ApiRelay';

export interface ClaudeSublineConfig {
  type: 'claude';
  relay: RelayConfig;
  models: string[];
  modelMetas: ModelMeta[];
}

export class ClaudeSubline implements IProviderSubline<ClaudeSublineConfig> {
  readonly id = 'subline-claude';
  readonly name = 'Claude (Claude Code 编程引擎)';
  readonly protocol = 'anthropic';
  readonly icon = 'claude';

  private config: ClaudeSublineConfig;

  constructor(initialConfig?: Partial<ClaudeSublineConfig>) {
    this.config = {
      type: 'claude',
      relay: {
        type: 'direct',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: '',
      },
      models: [
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
      ],
      modelMetas: [
        {
          id: 'claude-3-7-sonnet-20250219',
          name: 'Claude 3.7 Sonnet (原生混合推理)',
          contextWindow: 200000,
          maxOutputTokens: 64000,
          supportsThinking: true,
        },
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet (编码旗舰)',
          contextWindow: 200000,
          maxOutputTokens: 8192,
        },
        {
          id: 'claude-3-5-haiku-20241022',
          name: 'Claude 3.5 Haiku (超高速轻量)',
          contextWindow: 200000,
          maxOutputTokens: 8192,
        },
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

  getConfig(): ClaudeSublineConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<ClaudeSublineConfig>): void {
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
            name: `${mId} (Claude)`,
            contextWindow: 200000,
            supportsThinking: mId.includes('3-7') || mId.includes('thinking'),
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
        error: `Claude 端点响应 HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (e: any) {
      return {
        ok: false,
        models: [],
        modelMetas: [],
        count: 0,
        source: 'cloud_endpoint',
        error: `Claude 模型同步失败: ${e.message || '连接超时'}`,
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
      throw new Error(`Claude 返回 HTTP ${res.status}: ${errText}`);
    }

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
