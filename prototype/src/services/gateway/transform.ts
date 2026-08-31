import type { GatewayPlatform } from './types';

export type GatewayRole = 'system' | 'user' | 'assistant' | 'tool';

export interface GatewayMessage {
  role: GatewayRole;
  content: string;
  toolCallId?: string;
  name?: string;
  images?: Array<{ id: string; name: string; dataUrl: string; sizeBytes?: number }>;
}

export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ToolDef {
  type?: string;
  function: ToolFunction;
}

export type GatewayProtocol = 'responses' | 'chat_completions' | 'anthropic_messages';

export interface TransformOptions {
  platform: GatewayPlatform;
  codexOAuth: boolean;
  contextLimit: number;
  defaultMaxOutputTokens: number;
  protocol: GatewayProtocol;
}

export interface TransformInput {
  model: string;
  messages: GatewayMessage[];
  temperature?: number;
  stream: boolean;
  tools?: ToolDef[];
}

export function estimateTokens(text: string): number {
  return text ? Math.ceil(text.length / 3.2) : 0;
}

/**
 * Budget-aware conversation trimming (T2):
 * always keeps system messages, then fills remaining budget with the most
 * recent non-system messages (oldest dropped first).
 */
export function trimConversation(messages: GatewayMessage[], contextTokensBudget: number): GatewayMessage[] {
  const system = messages.filter(m => m.role === 'system');
  const rest = messages.filter(m => m.role !== 'system');
  if (rest.length === 0) return [...system];
  let budget = Math.max(0, contextTokensBudget - estimateTokens(system.map(m => m.content).join('\n')));
  const kept: GatewayMessage[] = [];
  for (let i = rest.length - 1; i >= 0; i -= 1) {
    const cost = estimateTokens(rest[i].content);
    if (kept.length === 0) {
      kept.unshift(rest[i]);
      budget -= cost;
      continue;
    }
    if (budget - cost < 0) break;
    kept.unshift(rest[i]);
    budget -= cost;
  }
  return [...system, ...kept];
}

/**
 * Normalizes tool call ids to the `fc_` prefix with a 64-char cap (T3).
 */
export function normalizeToolCallId(id?: string): string {
  let out = id ? (id.startsWith('fc_') ? id : `fc_${id}`) : `fc_tool_${Date.now()}`;
  if (out.length > 64) out = out.slice(0, 64);
  return out;
}

/**
 * Merges streamed tool-call argument fragments keyed by call id (T3).
 */
export function mergeToolCallFragments(
  fragments: Array<{ id: string; name?: string; arguments?: string }>
): Map<string, string> {
  const merged = new Map<string, string>();
  for (const fragment of fragments) {
    const current = merged.get(fragment.id) ?? '';
    merged.set(fragment.id, current + (fragment.arguments ?? ''));
  }
  return merged;
}

function normalizeTools(tools: ToolDef[]): Record<string, unknown>[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.function.name,
      ...(tool.function.description ? { description: tool.function.description } : {}),
      ...(tool.function.parameters ? { parameters: tool.function.parameters } : {})
    }
  }));
}

function extractSystem(messages: GatewayMessage[]): string[] {
  return messages.filter(m => m.role === 'system').map(m => m.content).filter(Boolean);
}

function inferProtocol(platform: GatewayPlatform, codexOAuth: boolean): GatewayProtocol {
  if (platform === 'claude') return 'anthropic_messages';
  if (platform === 'codex' || platform === 'openai') return 'responses';
  return 'chat_completions';
}

export class RequestTransformer {
  private opts: TransformOptions;

  public constructor(opts: Partial<TransformOptions> = {}) {
    const resolved: Omit<TransformOptions, 'protocol'> & { protocol?: GatewayProtocol } = {
      platform: 'openai-compatible',
      codexOAuth: false,
      contextLimit: 128_000,
      defaultMaxOutputTokens: 8192,
      protocol: undefined,
      ...opts
    };
    this.opts = {
      ...resolved,
      protocol: resolved.protocol ?? inferProtocol(resolved.platform, resolved.codexOAuth)
    } as TransformOptions;
  }

  public transform(input: TransformInput): Record<string, unknown> {
    const budget = this.opts.contextLimit - this.opts.defaultMaxOutputTokens;
    const messages = trimConversation(input.messages, budget);
    switch (this.opts.protocol) {
      case 'responses':
        return this.buildResponses(input, messages);
      case 'anthropic_messages':
        return this.buildAnthropic(input, messages);
      default:
        return this.buildChatCompletions(input, messages);
    }
  }

  private buildResponses(input: TransformInput, messages: GatewayMessage[]): Record<string, unknown> {
    const rest = messages.filter(m => m.role !== 'system');
    const body: Record<string, unknown> = {
      model: input.model,
      input: rest.map(m => ({ role: m.role === 'tool' ? 'tool' : m.role, content: m.content })),
      stream: this.opts.codexOAuth ? true : input.stream,
      store: false
    };
    if (input.tools && input.tools.length > 0) body.tools = normalizeTools(input.tools);
    // Codex OAuth rejects temperature / max_output_tokens / prompt_cache_retention (T1)
    if (!this.opts.codexOAuth && input.temperature !== undefined) body.temperature = input.temperature;
    return body;
  }

  private buildAnthropic(input: TransformInput, messages: GatewayMessage[]): Record<string, unknown> {
    const system = extractSystem(messages);
    const anthropicMessages: Array<Record<string, unknown>> = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      if (m.role === 'tool') {
        const block = {
          type: 'tool_result',
          tool_use_id: m.toolCallId || 'tool_use_id',
          content: m.content
        };
        const last = anthropicMessages[anthropicMessages.length - 1];
        const isToolUser = Array.isArray(last?.content) &&
          (last?.content as Array<{ type?: string }>).some(c => c.type === 'tool_result');
        if (last && last.role === 'user' && isToolUser) {
          (last.content as Array<unknown>).push(block);
        } else {
          anthropicMessages.push({ role: 'user', content: [block] });
        }
      } else if (m.role === 'assistant' && m.toolCallId && !m.content) {
        anthropicMessages.push({
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: normalizeToolCallId(m.toolCallId),
            name: m.name || 'tool',
            input: {}
          }]
        });
      } else {
        anthropicMessages.push({ role: m.role, content: m.content });
      }
    }
    const body: Record<string, unknown> = {
      model: input.model,
      max_tokens: this.opts.defaultMaxOutputTokens, // required by Anthropic (T5)
      messages: anthropicMessages,
      stream: input.stream
    };
    if (system.length > 0) body.system = system.join('\n');
    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools.map(tool => ({
        name: tool.function.name,
        ...(tool.function.description ? { description: tool.function.description } : {}),
        input_schema: tool.function.parameters ?? { type: 'object', properties: {} }
      }));
    }
    return body;
  }

  private buildChatCompletions(input: TransformInput, messages: GatewayMessage[]): Record<string, unknown> {
    const system = extractSystem(messages);
    const chatMessages: Array<Record<string, unknown>> = [];
    if (system.length > 0) chatMessages.push({ role: 'system', content: system.join('\n') });
    for (const m of messages) {
      if (m.role === 'system') continue;
      if (!m.content && !m.images?.length && m.role !== 'tool') continue; // drop empty messages (T8)

      let formattedContent: unknown = m.content;
      if (m.images && m.images.length > 0) {
        formattedContent = [
          ...(m.content ? [{ type: 'text', text: m.content }] : []),
          ...m.images.map(img => ({
            type: 'image_url',
            image_url: { url: img.dataUrl }
          }))
        ];
      }

      const entry: Record<string, unknown> = { role: m.role, content: formattedContent };
      if (m.role === 'tool' && m.toolCallId) entry.tool_call_id = m.toolCallId;
      chatMessages.push(entry);
    }
    const body: Record<string, unknown> = {
      model: input.model,
      messages: chatMessages,
      stream: input.stream
    };
    if (input.temperature !== undefined) body.temperature = input.temperature;
    // Ensure per-stream usage events so token-level billing works (T4)
    if (input.stream) body.stream_options = { include_usage: true };
    if (input.tools && input.tools.length > 0) body.tools = normalizeTools(input.tools);
    return body;
  }
}


