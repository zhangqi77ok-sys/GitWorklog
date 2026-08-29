import { describe, expect, it } from 'vitest';
import { getContextTelemetry, getContextBudget, compressModelContext } from '../src/services/contextTelemetry';
import { ChatMessage } from '../src/types/contracts';

const message = (content: string): ChatMessage => ({
  id: `message-${content.length}-${Math.random()}`,
  role: 'assistant',
  content,
  timestamp: Date.now()
});

describe('Context telemetry & budget contract', () => {
  it('correctly calculates availableInputTokens and caps percentage at 100%', () => {
    const budget = getContextBudget([message('a'.repeat(3500))], 128000, 16000, 4000);
    expect(budget.modelContextLimit).toBe(128000);
    expect(budget.availableInputTokens).toBe(108000);
    expect(budget.usagePercent).toBeGreaterThan(0);
    expect(budget.usagePercent).toBeLessThanOrEqual(100);
    expect(budget.canProceed).toBe(true);
  });

  it('triggers smart compression when raw history exceeds 80% threshold', () => {
    const messages = [
      message(`<think>${'reasoning '.repeat(1600)}</think>`),
      message(`\`\`\`write_file:src/example.ts\n${'const value = 1;\n'.repeat(120)}\`\`\``),
      message('保留最近一轮消息')
    ];

    const budget = getContextBudget(messages, 8000, 1000, 500);
    expect(budget.isCompressed).toBe(true);
    expect(budget.savedTokens).toBeGreaterThan(0);
    expect(budget.effectiveInputTokens).toBeLessThan(budget.rawHistoryTokens);
  });
});
