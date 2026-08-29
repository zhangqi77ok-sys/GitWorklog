import { IRelayAdapter, RelayConfig, RelayProbeResult, RelayType } from './types';

export class NewApiRelayAdapter implements IRelayAdapter {
  readonly type: RelayType = 'newapi';
  readonly name = 'NewAPI / OneAPI 中转站';

  formatEndpoint(baseUrl: string, path: string): string {
    let cleanBase = baseUrl.replace(/\/+$/, '');
    if (!cleanBase.endsWith('/v1') && !cleanBase.includes('/v1/')) {
      cleanBase += '/v1';
    }
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    return `${cleanBase}/${cleanPath}`;
  }

  formatHeaders(apiKey: string, channelId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    if (channelId?.trim()) {
      headers['New-Api-Channel'] = channelId.trim();
      headers['X-Channel-Id'] = channelId.trim();
    }
    return headers;
  }

  async probeRelay(config: RelayConfig): Promise<RelayProbeResult> {
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const modelsUrl = this.formatEndpoint(config.baseUrl, 'models');
      const res = await fetch(modelsUrl, {
        headers: this.formatHeaders(config.apiKey, config.channelId),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      let balance = '';
      try {
        const userUrl = config.baseUrl.replace(/\/v1\/?$/, '') + '/api/user/self';
        const userRes = await fetch(userUrl, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        if (userRes.ok) {
          const udata = await userRes.json();
          if (udata.data?.quota !== undefined) {
            balance = `$${(udata.data.quota / 500000).toFixed(2)}`;
          }
        }
      } catch {}

      if (res.ok || res.status === 200) {
        return {
          ok: true,
          latencyMs,
          statusCode: 200,
          balance: balance || undefined,
          message: `NewAPI 中转站连通成功 (延迟: ${latencyMs}ms${balance ? ` | 余额: ${balance}` : ''})`,
        };
      }

      return {
        ok: false,
        latencyMs,
        statusCode: res.status,
        message: `NewAPI 返回 HTTP ${res.status}，请检查 API Key 或中转站地址`,
      };
    } catch (e: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        ok: false,
        latencyMs,
        message: `NewAPI 连接超时: ${e.message || '网络不可达'}`,
      };
    }
  }
}
