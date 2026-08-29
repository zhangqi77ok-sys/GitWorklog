import { ModelMeta } from '../../../types';
import { IProviderSubline, SublineHealthResult, SublineModelSyncResult, BusStreamRequest, BusStreamCallbacks } from '../types';

export interface OpenCodeSublineConfig {
  type: 'opencode';
  mode: 'local_serve' | 'cloud_api';
  baseUrl: string;
  localPort: number;
  apiKey: string;
  models: string[];
  modelMetas: ModelMeta[];
}

export class OpenCodeSubline implements IProviderSubline<OpenCodeSublineConfig> {
  readonly id = 'subline-opencode';
  readonly name = 'OpenCode (本地/远程编程引擎)';
  readonly protocol = 'opencode';
  readonly icon = 'opencode';

  private config: OpenCodeSublineConfig;

  constructor(initialConfig?: Partial<OpenCodeSublineConfig>) {
    this.config = {
      type: 'opencode',
      mode: 'local_serve',
      baseUrl: 'http://127.0.0.1:4096/v1',
      localPort: 4096,
      apiKey: 'opencode-local',
      models: [],
      modelMetas: [],
      ...initialConfig,
    };
  }

  getConfig(): OpenCodeSublineConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<OpenCodeSublineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  async probeHealth(): Promise<SublineHealthResult> {
    const startTime = performance.now();
    const cleanUrl = this.config.baseUrl.replace(/\/+$/, '');
    const probeUrls = [
      cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`,
      `${cleanUrl}/health`,
      `${cleanUrl}/provider`,
      `http://127.0.0.1:${this.config.localPort}/v1/models`,
      `http://127.0.0.1:${this.config.localPort}/health`,
    ];

    for (const url of probeUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok || res.status === 200 || res.status === 401 || res.status === 404) {
          const latencyMs = Math.round(performance.now() - startTime);
          return {
            ok: true,
            latencyMs,
            statusCode: res.status,
            endpointUrl: url,
            message: `OpenCode 引擎服务就绪 (端口: ${this.config.localPort}, 延迟: ${latencyMs}ms)`,
          };
        }
      } catch {}
    }

    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      latencyMs,
      endpointUrl: this.config.baseUrl,
      message: `OpenCode 本地服务未运行 (端口: ${this.config.localPort})。请在系统终端运行 'opencode serve' 开启服务`,
    };
  }

  async fetchOfficialModels(): Promise<SublineModelSyncResult> {
    // 1. 严格从 OpenCode 官网权威元数据中枢 (https://models.dev/api.json) 获取
    let officialFetchedMetas: ModelMeta[] = [];
    let officialError = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('https://models.dev/api.json', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.opencode && data.opencode.models) {
          const modelsObj = data.opencode.models;
          for (const mId of Object.keys(modelsObj)) {
            const m = modelsObj[mId];
            if (m.status === 'deprecated') continue;
            officialFetchedMetas.push({
              id: `opencode/${m.id || mId}`,
              name: `${m.name || mId} (OpenCode)`,
              contextWindow: m.limit?.context || 128000,
              maxOutputTokens: m.limit?.output || 8192,
              supportsThinking: Boolean(m.reasoning),
            });
          }
        }
      } else {
        officialError = `models.dev HTTP ${res.status}`;
      }
    } catch (e: any) {
      officialError = e.message || '网络连接超时';
    }

    // 2. 尝试从本地 4096 运行中的 opencode serve 提取动态配置模型
    let localFetchedIds: string[] = [];
    const cleanUrl = this.config.baseUrl.replace(/\/+$/, '');
    const localEndpoints = [
      cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`,
      `http://127.0.0.1:${this.config.localPort}/config/providers`,
      `http://127.0.0.1:${this.config.localPort}/provider`,
    ];

    for (const ep of localEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(ep, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.data)) {
            localFetchedIds = data.data.map((item: any) => item.id || item.name).filter(Boolean);
          } else if (data.providers && Array.isArray(data.providers)) {
            for (const p of data.providers) {
              if (Array.isArray(p.models)) {
                for (const m of p.models) {
                  const id = typeof m === 'string' ? m : m.id || m.name;
                  if (id) localFetchedIds.push(id);
                }
              }
            }
          }
          if (localFetchedIds.length > 0) break;
        }
      } catch {}
    }

    if (officialFetchedMetas.length === 0 && localFetchedIds.length === 0) {
      return {
        ok: false,
        models: [],
        modelMetas: [],
        count: 0,
        source: 'official_api',
        error: `无法从 OpenCode 官方元数据中枢 (models.dev) 或本地 4096 服务拉取模型。原因: ${officialError || '服务未响应'}。`,
      };
    }

    const finalMetas: ModelMeta[] = [...officialFetchedMetas];
    const officialIdSet = new Set(officialFetchedMetas.map((m) => m.id));

    for (const locId of localFetchedIds) {
      if (!officialIdSet.has(locId) && !officialIdSet.has(`opencode/${locId}`)) {
        finalMetas.push({
          id: locId,
          name: `${locId} (OpenCode 本地)`,
          contextWindow: 128000,
          supportsThinking: locId.includes('r1') || locId.includes('reasoner') || locId.includes('thinking'),
        });
      }
    }

    const finalModelIds = finalMetas.map((m) => m.id);
    this.config.models = finalModelIds;
    this.config.modelMetas = finalMetas;

    return {
      ok: true,
      models: finalModelIds,
      modelMetas: finalMetas,
      count: finalMetas.length,
      source: officialFetchedMetas.length > 0 ? 'official_api' : 'local_server',
    };
  }

  async executeStream(
    request: BusStreamRequest,
    callbacks: BusStreamCallbacks
  ): Promise<void> {
    const startTime = performance.now();
    let targetUrl = this.config.baseUrl.trim();
    if (!targetUrl.endsWith('/')) targetUrl += '/';

    const endpoint = `${targetUrl}chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': request.requestId,
      'X-Client-Platform': 'CodeMind-Studio-OpenCode',
    };

    if (this.config.apiKey && this.config.apiKey !== 'opencode-local') {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const body: any = {
      model: request.model.replace(/^opencode\//, ''),
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    };

    if (request.enableThinking) {
      body.stream_options = { include_usage: true };
    }
    if (request.reasoningEffort === 'high') {
      body.reasoning_effort = 'high';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: request.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenCode 服务返回 HTTP ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error('OpenCode 响应流不可读');
    }

    const reader = response.body.getReader();
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
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') continue;

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
