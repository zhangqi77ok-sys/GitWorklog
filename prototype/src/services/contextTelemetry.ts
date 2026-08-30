import { ChatMessage } from '../types/contracts';

export type ContextStatus =
  | 'normal'           // 0% ~ 70% 容量充裕
  | 'near_limit'       // 70% ~ 85% 接近上限
  | 'auto_compressed'  // 85% ~ 95% 自动压缩
  | 'force_compressed' // 95% ~ 100% 强制压缩
  | 'blocked';         // 100% 已达到上限暂停发送

export interface ContextBudget {
  modelContextLimit: number;      // 模型完整上下文窗口 (如 131,072)
  reservedOutputTokens: number;   // 为模型输出预留 (默认 16,384)
  safetyMarginTokens: number;     // 安全余量 (默认 4,096)
  availableInputTokens: number;   // 当前实际可用输入预算 = Limit - Reserved - Margin
  effectiveInputTokens: number;   // 本轮压缩后实际发送的输入
  rawHistoryTokens: number;       // 未压缩原始历史 Token
  isCompressed: boolean;          // 是否经过智能压缩
  savedTokens: number;            // 压缩节约的 Token 数
  usagePercent: number;           // effectiveInputTokens / availableInputTokens * 100
  status: ContextStatus;
  canProceed: boolean;
  breakdown: {
    conversationTokens: number;
    toolsTokens: number;
    systemTokens: number;
    convRatio: number;
    toolRatio: number;
    sysRatio: number;
  };
}

/**
 * Calculates raw token count from message array
 */
export function estimateMessageTokens(messages: ChatMessage[]): { rawChars: number; toolChars: number; totalEstimated: number } {
  let rawChars = 0;
  let toolChars = 0;

  for (const m of messages) {
    rawChars += (m.content || '').length;
    if (m.actionResults && m.actionResults.length > 0) {
      toolChars += m.actionResults.reduce((acc, r) => acc + (r.output?.length || 0) + (r.error?.length || 0), 0);
    }
  }

  const conversationTokens = Math.ceil(rawChars / 3.5);
  const toolsTokens = Math.ceil(toolChars / 3.5);
  const systemTokens = 1200; // Fixed system prompt and capability overhead

  return {
    rawChars,
    toolChars,
    totalEstimated: conversationTokens + toolsTokens + systemTokens
  };
}

/**
 * Non-destructive smart message compressor for LLM payload:
 * Strips historical <think> blocks, collapses historical write_file blocks and repetitive terminal logs
 */
export function compressModelContext(
  messages: ChatMessage[],
  contextLimit: number = 131072
): { compressed: ChatMessage[]; rawTokens: number; effectiveTokens: number; savedTokens: number } {
  const rawEst = estimateMessageTokens(messages);
  const rawTokens = rawEst.totalEstimated;

  const compressed: ChatMessage[] = messages.map((m, idx) => {
    // Keep last 2 messages completely intact (recent context)
    if (idx >= messages.length - 2) return m;

    let clean = m.content || '';
    // Strip heavy <thinking> processes from historical turns
    clean = clean.replace(/<(?:think|thinking)>[\s\S]*?<\/(?:think|thinking)>/gi, '');
    // Compress giant write_file blocks in historical messages
    clean = clean.replace(/```write_file:([^\r\n]+)\r?\n([\s\S]{200,})```/gi, (_match, file) => {
      return `\`\`\`write_file:${file}\n// [历史已落盘代码，已就地压缩以节约上下文预算]\n\`\`\``;
    });
    // Compress giant terminal / test outputs
    clean = clean.replace(/```(?:bash|sh|powershell|output|terminal)\r?\n([\s\S]{300,})```/gi, () => {
      return `\`\`\`output\n[历史终端执行输出，已自动精简摘要]\n\`\`\``;
    });

    return {
      ...m,
      content: clean.trim()
    };
  });

  const effectiveEst = estimateMessageTokens(compressed);
  const effectiveTokens = effectiveEst.totalEstimated;
  const savedTokens = Math.max(0, rawTokens - effectiveTokens);

  return {
    compressed,
    rawTokens,
    effectiveTokens,
    savedTokens
  };
}

export interface ContextBudget {
  modelContextLimit: number;      // 模型完整上下文窗口 (如 131,072)
  reservedOutputTokens: number;   // 为模型输出预留 (默认 16,384)
  safetyMarginTokens: number;     // 安全余量 (默认 4,096)
  availableInputTokens: number;   // 当前实际可用输入预算 = Limit - Reserved - Margin
  effectiveInputTokens: number;   // 本轮压缩后实际发送的输入
  rawHistoryTokens: number;       // 未压缩原始历史 Token
  isCompressed: boolean;          // 是否经过智能压缩
  savedTokens: number;            // 压缩节约的 Token 数
  usagePercent: number;           // effectiveInputTokens / availableInputTokens * 100
  epochIndex: number;             // 当前上下文周期 (Epoch #1, Epoch #2...)
  epochTurnTokens: number;        // 当前周期新增 Token (从 0k 起步)
  epochSummaryTokens: number;     // 当前周期基底摘要 Token
  status: ContextStatus;
  canProceed: boolean;
  breakdown: {
    conversationTokens: number;
    toolsTokens: number;
    systemTokens: number;
    convRatio: number;
    toolRatio: number;
    sysRatio: number;
  };
}

/**
 * Standard Context Budget Evaluator with Context Epoch Support:
 * - Separates Raw History vs. Available Input Budget vs. Effective Payload.
 * - When an Epoch is active (post-compression), calculates UI % from epoch turn additions (starting from 0%)
 * - LLM actual feed correctly accounts for system + summary tokens + turns.
 */
export function getContextBudget(
  messages: ChatMessage[],
  contextLimit: number = 131072,
  reservedOutput: number = 16384,
  safetyMargin: number = 4096,
  activeEpoch?: {
    epochIndex: number;
    archivedMessageIds: string[];
    summaryTokens: number;
  }
): ContextBudget {
  const limit = Math.max(8000, contextLimit || 131072);
  const availableInputTokens = Math.max(4000, limit - reservedOutput - safetyMargin);

  // If epoch is active, filter messages belonging to current epoch for turn calculation
  const epochMessages = activeEpoch && activeEpoch.archivedMessageIds.length > 0
    ? messages.filter(m => !activeEpoch.archivedMessageIds.includes(m.id))
    : messages;

  const rawEst = estimateMessageTokens(messages);
  const rawHistoryTokens = rawEst.totalEstimated;

  const epochEst = estimateMessageTokens(epochMessages);
  const epochTurnTokens = epochEst.totalEstimated - 1200; // exclude fixed system tokens

  let isCompressed = false;
  let effectiveInputTokens = rawHistoryTokens;
  let savedTokens = 0;

  // If raw history exceeds 80% of available input and not already in fresh epoch
  if (rawHistoryTokens > availableInputTokens * 0.80 && (!activeEpoch || activeEpoch.epochIndex <= 1)) {
    const compResult = compressModelContext(messages, limit);
    effectiveInputTokens = compResult.effectiveTokens;
    savedTokens = compResult.savedTokens;
    isCompressed = true;
  }

  // Calculate percentage: If in Epoch #2+, compute from Epoch additions (starts at 0%)
  const epochSummary = activeEpoch?.summaryTokens || 0;
  const effectiveEpochInput = (activeEpoch && activeEpoch.epochIndex > 1)
    ? epochTurnTokens
    : effectiveInputTokens;

  const usagePercent = Math.min(100, Math.max(0, Math.round((effectiveEpochInput / availableInputTokens) * 100)));

  let status: ContextStatus = 'normal';
  if (usagePercent >= 100) {
    status = 'blocked';
  } else if (usagePercent >= 95) {
    status = 'force_compressed';
  } else if (usagePercent >= 85) {
    status = 'auto_compressed';
  } else if (usagePercent >= 70) {
    status = 'near_limit';
  }

  const canProceed = usagePercent < 100;

  // Calculate Breakdown based on effective payload
  const convTokens = Math.ceil((activeEpoch && activeEpoch.epochIndex > 1 ? epochEst.rawChars : rawEst.rawChars) / 3.5);
  const toolTokens = Math.ceil((activeEpoch && activeEpoch.epochIndex > 1 ? epochEst.toolChars : rawEst.toolChars) / 3.5);
  const sysTokens = 1200;
  const totalEffectiveBase = Math.max(1, convTokens + toolTokens + sysTokens);

  const convRatio = Math.min(100, Math.max(1, Math.round((convTokens / totalEffectiveBase) * 100)));
  const toolRatio = Math.min(100, Math.max(0, Math.round((toolTokens / totalEffectiveBase) * 100)));
  const sysRatio = Math.max(1, Math.max(1, 100 - convRatio - toolRatio));

  return {
    modelContextLimit: limit,
    reservedOutputTokens: reservedOutput,
    safetyMarginTokens: safetyMargin,
    availableInputTokens,
    effectiveInputTokens,
    rawHistoryTokens,
    isCompressed: isCompressed || (Boolean(activeEpoch && activeEpoch.epochIndex > 1)),
    savedTokens,
    usagePercent,
    epochIndex: activeEpoch?.epochIndex || 1,
    epochTurnTokens: Math.max(0, epochTurnTokens),
    epochSummaryTokens: epochSummary,
    status,
    canProceed,
    breakdown: {
      conversationTokens: convTokens,
      toolsTokens: toolTokens,
      systemTokens: sysTokens,
      convRatio,
      toolRatio,
      sysRatio
    }
  };
}

// Backwards-compatible aliases for existing callers
export function getContextTelemetry(messages: ChatMessage[], contextLimit: number = 131072) {
  const budget = getContextBudget(messages, contextLimit);
  return {
    usedTokens: budget.effectiveInputTokens,
    contextLimit: budget.modelContextLimit,
    usagePercent: budget.usagePercent,
    status: budget.status,
    conversationTokens: budget.breakdown.conversationTokens,
    toolsTokens: budget.breakdown.toolsTokens,
    systemTokens: budget.breakdown.systemTokens,
    canProceed: budget.canProceed
  };
}
