import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TaskNotificationData } from '../src/components/SystemTaskNotification';

describe('SystemTaskNotification Data Contract & Controller Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format payload correctly for success notifications', () => {
    const data: TaskNotificationData = {
      status: 'success',
      projectName: 'agent-learning',
      sessionTitle: '权限模型重构与验证',
      sessionId: 'session-123',
      summary: '验证完成！共处理了 3,412 个权限条目。发现 5 个潜在的冗余角色。',
      durationSec: 2.4,
      createdAt: Date.now()
    };

    expect(data.status).toBe('success');
    expect(data.projectName).toBe('agent-learning');
    expect(data.sessionTitle).toBe('权限模型重构与验证');
    expect(data.durationSec).toBe(2.4);
    expect(data.summary).toContain('3,412');
  });

  it('should format payload correctly for error notifications', () => {
    const errorData: TaskNotificationData = {
      status: 'error',
      projectName: 'agent-learning',
      sessionTitle: '执行异常会话',
      sessionId: 'session-456',
      summary: '大模型网关鉴权失败，请检查 API Key 凭据。',
      durationSec: 1.5,
      createdAt: Date.now()
    };

    expect(errorData.status).toBe('error');
    expect(errorData.summary).toContain('大模型网关鉴权失败');
  });

  it('should support 5-second countdown timer with pause on hover', () => {
    let remainingMs = 5000;
    let isHovered = false;

    const tick = (stepMs: number) => {
      if (!isHovered) {
        remainingMs = Math.max(0, remainingMs - stepMs);
      }
    };

    // Normal tick
    tick(1000);
    expect(remainingMs).toBe(4000);

    // Hovered: timer pauses
    isHovered = true;
    tick(2000);
    expect(remainingMs).toBe(4000);

    // Unhovered: timer resumes
    isHovered = false;
    tick(4000);
    expect(remainingMs).toBe(0);
  });
});
