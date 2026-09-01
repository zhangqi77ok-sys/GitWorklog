export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  tool_call_id: string;
  name: string;
  output: string;
  is_error: boolean;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
  timestamp: number;
}

export interface Subtask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  dependencies: string[];
  evidence: string[];
}

export interface TaskDAG {
  goal: string;
  subtasks: Subtask[];
  current_index: number;
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  is_builtin: boolean;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ModelConfig {
  provider_id: string;
  model_id: string;
  api_key: string;
  base_url: string;
  temperature?: number;
  max_tokens?: number;
}

export type AgentEvent =
  | { type: 'thought_chunk'; payload: { session_id: string; text: string } }
  | { type: 'content_chunk'; payload: { session_id: string; text: string } }
  | { type: 'tool_call_requested'; payload: { session_id: string; tool_call: ToolCall; risk: any } }
  | { type: 'tool_execution_started'; payload: { session_id: string; tool_call_id: string; name: string } }
  | { type: 'tool_execution_finished'; payload: { session_id: string; tool_call_id: string; result: ToolResult } }
  | { type: 'subtask_updated'; payload: { session_id: string; subtask: Subtask } }
  | { type: 'step_verified'; payload: { session_id: string; passed: boolean; feedback: string } }
  | { type: 'session_finished'; payload: { session_id: string; success: boolean; reason?: string } }
  | { type: 'error'; payload: { session_id: string; message: string } };
