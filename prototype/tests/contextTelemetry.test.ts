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

  it('resets usage percentage to 0% on Context Epoch #2 while preserving historical reference', () => {
    const oldMsg1 = message('旧会话内容1'.repeat(200));
    const oldMsg2 = message('旧会话内容2'.repeat(200));
    const messages = [oldMsg1, oldMsg2];

    const epoch2 = {
      epochIndex: 2,
      archivedMessageIds: [oldMsg1.id, oldMsg2.id],
      summaryTokens: 850
    };

    // When in Epoch #2 with no new turn messages yet
    const budgetFresh = getContextBudget(messages, 128000, 16000, 4000, epoch2);
    expect(budgetFresh.epochIndex).toBe(2);
    expect(budgetFresh.usagePercent).toBe(0); // Starts fresh from 0%
    expect(budgetFresh.epochTurnTokens).toBe(0);

    // After 1 new turn arrives in Epoch #2
    const newTurnMsg = message('新周期第一轮指令与分析'.repeat(50));
    const budgetWithTurn = getContextBudget([...messages, newTurnMsg], 128000, 16000, 4000, epoch2);
    expect(budgetWithTurn.epochIndex).toBe(2);
    expect(budgetWithTurn.epochTurnTokens).toBeGreaterThan(0);
    expect(budgetWithTurn.usagePercent).toBeGreaterThanOrEqual(0);
  });
});

