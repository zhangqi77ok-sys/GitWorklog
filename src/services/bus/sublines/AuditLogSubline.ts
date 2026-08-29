export interface AuditLogEntry {
  id: string;
  timestamp: string;
  engineId: string;
  relayType: 'direct' | 'newapi' | 'sub2api';
  model: string;
  durationMs: number;
  tokensCount: number;
  tokensPerSec: number;
  statusCode: number;
  status: 'success' | 'error' | 'cancelled';
  errorMessage?: string;
  promptSnippet?: string;
}

const STORAGE_KEY = 'codemind_audit_logs_v1';

export class AuditLogSubline {
  readonly id = 'subline-audit';
  readonly name = '系统日志与全链路审计子线';

  private logs: AuditLogEntry[] = [];

  constructor() {
    this.loadLogs();
  }

  private loadLogs(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.logs = JSON.parse(raw);
      }
    } catch {
      this.logs = [];
    }
  }

  private saveLogs(): void {
    try {
      // 保持最近 200 条日志
      if (this.logs.length > 200) {
        this.logs = this.logs.slice(0, 200);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch {}
  }

  getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  recordLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      ...entry,
    };
    this.logs.unshift(fullEntry);
    this.saveLogs();
    return fullEntry;
  }

  clearLogs(): void {
    this.logs = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  exportLogsJson(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}
