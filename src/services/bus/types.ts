import { ModelMeta } from '../../types';

export interface SublineHealthResult {
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  message: string;
  endpointUrl: string;
  extraInfo?: Record<string, any>;
}

export interface SublineModelSyncResult {
  ok: boolean;
  models: string[];
  modelMetas: ModelMeta[];
  count: number;
  source: 'official_api' | 'local_server' | 'cloud_endpoint';
  error?: string;
}

export interface BusStreamRequest {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  maxTokens: number;
  enableThinking: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
  requestId: string;
  abortSignal?: AbortSignal;
}

export interface BusStreamCallbacks {
  onChunk: (chunk: string) => void;
  onThinkingChunk?: (thoughtChunk: string) => void;
  onComplete: (metadata: {
    durationMs: number;
    tokensCount: number;
    tokensPerSec: number;
  }) => void;
  onError: (error: string, statusCode?: number) => void;
}

export interface IProviderSubline<TConfig = any> {
  readonly id: string;
  readonly name: string;
  readonly protocol: string;
  readonly icon: string;

  getConfig(): TConfig;
  updateConfig(config: Partial<TConfig>): void;
  probeHealth(): Promise<SublineHealthResult>;
  fetchOfficialModels(): Promise<SublineModelSyncResult>;
  executeStream(
    request: BusStreamRequest,
    callbacks: BusStreamCallbacks
  ): Promise<void>;
}
