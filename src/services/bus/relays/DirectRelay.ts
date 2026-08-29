import { IRelayAdapter, RelayConfig, RelayProbeResult, RelayType } from './types';

export class DirectRelayAdapter implements IRelayAdapter {
  readonly type: RelayType = 'direct';
  readonly name = '官方直连模式 (Official Direct)';

  formatEndpoint(baseUrl: string, path: string): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return `${cleanBase}/${cleanPath}`;
  }

  formatHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (apiKey && apiKey !== 'opencode-local') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
  }

  async probeRelay(config: RelayConfig): Promise<RelayProbeResult> {
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const testUrl = this.formatEndpoint(config.baseUrl, 'models');
      const res = await fetch(testUrl, {
        headers: this.formatHeaders(config.apiKey),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok || res.status === 200 || res.status === 401) {
        return {
          ok: true,
          latencyMs,
          statusCode: res.status,
          message: `官方端点连通成功 (延迟: ${latencyMs}ms)`,
        };
      }
      return {
        ok: false,
        latencyMs,
        statusCode: res.status,
        message: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (e: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        ok: false,
        latencyMs,
        message: e.message || '网络无法连接',
      };
    }
  }
}
