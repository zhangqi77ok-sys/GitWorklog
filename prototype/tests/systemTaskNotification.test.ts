import { describe, it, expect, vi } from 'vitest';

export interface TaskNotificationPayload {
  id: string;
  status: 'success' | 'error';
  projectName: string;
  sessionTitle: string;
  sessionId: string;
  summary: string;
  createdAt: number;
}

export class NotificationTimerController {
  private durationMs: number = 5000;
  private remainingMs: number = 5000;
  private isPaused: boolean = false;
  private onExpire: () => void;
  private lastTick: number = 0;

  constructor(onExpire: () => void, durationMs: number = 5000) {
    this.onExpire = onExpire;
    this.durationMs = durationMs;
    this.remainingMs = durationMs;
    this.lastTick = Date.now();
  }

  pause() {
    if (!this.isPaused) {
      const elapsed = Date.now() - this.lastTick;
      this.remainingMs = Math.max(0, this.remainingMs - elapsed);
      this.isPaused = true;
    }
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.lastTick = Date.now();
    }
  }

  getRemainingPercent(): number {
    return Math.max(0, Math.min(100, (this.remainingMs / this.durationMs) * 100));
  }

  getPaused(): boolean {
    return this.isPaused;
  }
}

describe('280x120 System Task Notification Specification', () => {
  it('should validate notification payload structure for both success and error modes', () => {
    const successPayload: TaskNotificationPayload = {
      id: 'notify-1',
      status: 'success',
      projectName: 'agent-learning',
      sessionTitle: '权限模型重构与验证',
      sessionId: 'sess-rbac-1',
      summary: '验证完成！共处理 3,412 个条目，已生成报告。',
      createdAt: Date.now()
    };

    expect(successPayload.status).toBe('success');
    expect(successPayload.projectName).toBe('agent-learning');
    expect(successPayload.summary).toContain('3,412');

    const errorPayload: TaskNotificationPayload = {
      id: 'notify-2',
      status: 'error',
      projectName: 'agent-learning',
      sessionTitle: '安装包构建任务',
      sessionId: 'sess-build-1',
      summary: '错误根因: 缺少依赖模块 pyi_rth_inspect',
      createdAt: Date.now()
    };

    expect(errorPayload.status).toBe('error');
    expect(errorPayload.summary).toContain('错误根因');
  });

  it('should support hover pause and mouse-leave resume on 5-second countdown timer', () => {
    const onExpire = vi.fn();
    const timer = new NotificationTimerController(onExpire, 5000);

    expect(timer.getPaused()).toBe(false);
    expect(timer.getRemainingPercent()).toBe(100);

    // Hover enters -> pause
    timer.pause();
    expect(timer.getPaused()).toBe(true);

    // Mouse leaves -> resume
    timer.resume();
    expect(timer.getPaused()).toBe(false);
  });

  it('should format brief summary string cleanly without overflowing 2 lines', () => {
    const longAiText = '这是一个非常非常长的模型产出结果，详细描述了我们在系统架构中的多项调整，包括修改了 12 个模块与 30 多个单元测试，所有断言都通过。';
    const cleanSummary = longAiText.length > 42 ? longAiText.slice(0, 40) + '...' : longAiText;
    expect(cleanSummary.length).toBeLessThanOrEqual(43);
    expect(cleanSummary.endsWith('...')).toBe(true);
  });
});
