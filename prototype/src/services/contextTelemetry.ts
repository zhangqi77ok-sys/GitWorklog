import { ChatMessage } from '../types/contracts';

export type ContextStatus =
  | 'normal'
  | 'suggest_compress'
  | 'auto_compress'
  | 'force_compress'
  | 'blocked';

export interface ContextTelemetry {
  usedTokens: number;
  contextLimit: number;
  usagePercent: number;
  status: ContextStatus;
  conversationTokens: number;
  toolsTokens: number;
  systemTokens: number;
  canProceed: boolean;
}

/**
 * Standard unified context token estimator for LLM payload:
 * Calculates real token consumption using standard ~3.5 chars/token against current model contextLimit.
 */
export function getContextTelemetry(
  messages: ChatMessage[],
  contextLimit: number = 128000
): ContextTelemetry {
  const limit = Math.max(8000, contextLimit || 128000);
  
  let rawChars = 0;
  let toolChars = 0;
  const systemTokens = 1200; // Fixed system prompt and capability instruction overhead

  for (const m of messages) {
    const len = (m.content || '').length;
    rawChars += len;
    if (m.actionResults && m.actionResults.length > 0) {
      toolChars += m.actionResults.reduce((acc, r) => acc + (r.output?.length || 0) + (r.error?.length || 0), 0);
    }
  }

  const conversationTokens = Math.ceil(rawChars / 3.5);
  const toolsTokens = Math.ceil(toolChars / 3.5);
  const usedTokens = conversationTokens + toolsTokens + systemTokens;
  const usagePercent = Math.min(100, Math.max(1, Math.round((usedTokens / limit) * 100)));

  let status: ContextStatus = 'normal';
  if (usagePercent >= 95) {
    status = 'force_compress';
  } else if (usagePercent >= 85) {
    status = 'auto_compress';
  } else if (usagePercent >= 75) {
    status = 'suggest_compress';
  }

  const canProceed = usagePercent < 100;

  return {
    usedTokens,
    contextLimit: limit,
    usagePercent,
    status,
    conversationTokens,
    toolsTokens,
    systemTokens,
    canProceed
  };
}

/**
 * Non-destructive smart message compressor for LLM payload:
 * Produces lightweight modelContext while preserving original user intent, acceptance items, and evidence.
 */
export function compressModelContext(
  messages: ChatMessage[],
  contextLimit: number = 128000
): { compressed: ChatMessage[]; beforePercent: number; afterPercent: number; savedTokens: number } {
  const beforeTelemetry = getContextTelemetry(messages, contextLimit);

  const compressed: ChatMessage[] = messages.map((m, idx) => {
    // Keep last 2 messages intact
    if (idx >= messages.length - 2) return m;

    let clean = m.content || '';
    // Strip heavy <thinking> processes from historical turns
    clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    // Compress giant write_file blocks in historical messages
    clean = clean.replace(/```write_file:([^\n]+)\n([\s\S]{300,})```/gi, (_match, file) => {
      return `\`\`\`write_file:${file}\n// [历史执行已落盘代码，已智能压缩以节约上下文]\n\`\`\``;
    });

    return {
      ...m,
      content: clean.trim()
    };
  });

  const afterTelemetry = getContextTelemetry(compressed, contextLimit);
  const savedTokens = Math.max(0, beforeTelemetry.usedTokens - afterTelemetry.usedTokens);

  return {
    compressed,
    beforePercent: beforeTelemetry.usagePercent,
    afterPercent: afterTelemetry.usagePercent,
    savedTokens
  };
}
