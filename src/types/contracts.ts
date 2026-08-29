// Clean Single-Axis Contracts
export type ProviderType = 'opencode' | 'claude' | 'codex' | 'dashscope' | 'ollama';

export interface TokenStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  kvCacheHitRate: number;
  estimatedCostUsd: number;
}

export interface AskOptionsPayload {
  type: 'ask_options';
  question: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
    recommended?: boolean;
  }>;
  single_select?: boolean;
  allow_custom_input?: boolean;
}

export type PermissionPolicy = 'strict_approval' | 'smart_autonomous' | 'risk_adaptive';
export type WorkMode = 'plan' | 'act';
