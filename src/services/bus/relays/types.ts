export type RelayType = 'direct' | 'newapi' | 'sub2api';

export interface RelayConfig {
  type: RelayType;
  baseUrl: string;
  apiKey: string;
  channelId?: string;       // NewAPI 专用：指定下游渠道 ID
  subscriptionUrl?: string; // sub2api 专用：订阅地址或聚合节点端点
}

export interface RelayProbeResult {
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  balance?: string;
  message: string;
}

export interface IRelayAdapter {
  readonly type: RelayType;
  readonly name: string;
  formatEndpoint(baseUrl: string, path: string): string;
  formatHeaders(apiKey: string, channelId?: string): Record<string, string>;
  probeRelay(config: RelayConfig): Promise<RelayProbeResult>;
}
