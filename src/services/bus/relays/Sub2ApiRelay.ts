import { IRelayAdapter, RelayConfig, RelayProbeResult, RelayType } from './types';

export class Sub2ApiRelayAdapter implements IRelayAdapter {
  readonly type: RelayType = 'sub2api';
  readonly name = 'sub2api 订阅聚合网关';

  formatEndpoint(baseUrl: string, path: string): string {
    let cleanBase = baseUrl.replace(/\/+$/, '');
    if (!cleanBase.endsWith('/v1') && !cleanBase.includes('/v1/')) {
      cleanBase += '/v1';
    }
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    return `${cleanBase}/${cleanPath}`;
  }

  formatHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Relay-Provider': 'sub2api',
    };
  }

  async probeRelay(config: RelayConfig): Promise<RelayProbeResult> {
    const startTime = performance.now();
    const probeUrl = this.formatEndpoint(config.baseUrl, 'models');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(probeUrl, {
        headers: this.formatHeaders(config.apiKey),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        return {
          ok: true,
          latencyMs,
          statusCode: 200,
          message: `sub2api 聚合节点连通成功 (延迟: ${latencyMs}ms)`,
        };
      }
      return {
        ok: false,
        latencyMs,
        statusCode: res.status,
        message: `sub2api 响应 HTTP ${res.status}`,
      };
    } catch (e: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        ok: false,
        latencyMs,
        message: `sub2api 探针超时: ${e.message || '无法建立连接'}`,
      };
    }
  }
}
