import { defaultSandboxGuard } from './sandboxGuard';
import { defaultSecurityShield } from './securityShield';

export interface HostExecOptions {
  cwd?: string;
  sudo?: boolean;
}

export interface HostExecResult {
  success: boolean;
  stdout: string;
  stderr?: string;
  error?: string;
  exitCode: number;
  isSandboxIntercepted?: boolean;
}

export class HostGatewayService {
  /**
   * Universal terminal command execution with SecurityShield sanitize & SandboxGuard classification
   */
  public async executeCommand(cmd: string, options: HostExecOptions = {}): Promise<HostExecResult> {
    const trimmed = cmd.trim();
    if (!trimmed) {
      return {
        success: false,
        stdout: '',
        stderr: 'Empty command',
        exitCode: 1
      };
    }

    // 1. SandboxGuard command safety classification
    const safetyCheck = defaultSandboxGuard.checkCommand(trimmed);
    if (!safetyCheck.isSafe && !options.sudo) {
      return {
        success: false,
        stdout: '',
        stderr: `🚫 [HostGateway Security]: 检测到高危破坏性指令 (${safetyCheck.requiresSudo ? '需Sudo授权' : '已阻断'})，已被宿主安全边界拦截。`,
        exitCode: 1,
        isSandboxIntercepted: true
      };
    }

    // 2. Dispatch to Python Desktop Host Gateway API
    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: trimmed,
          cwd: options.cwd
        })
      });

      const data = await res.json();
      const isSuccess = Boolean(data.success) && (typeof data.exitCode !== 'number' || data.exitCode === 0);

      return {
        success: isSuccess,
        stdout: data.stdout || '',
        stderr: data.stderr || data.error || '',
        error: data.error,
        exitCode: typeof data.exitCode === 'number' ? data.exitCode : (isSuccess ? 0 : 1)
      };
    } catch (err: any) {
      return {
        success: false,
        stdout: '',
        stderr: err.message || '无法连接宿主执行引擎',
        error: err.message,
        exitCode: 1
      };
    }
  }

  /**
   * File write through Host Gateway with error checking
   */
  public async writeFile(path: string, content: string): Promise<{ success: boolean; size?: number; error?: string }> {
    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || '网络连接异常' };
    }
  }

  /**
   * Read file content through Host Gateway
   */
  public async readFile(path: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || '网络连接异常' };
    }
  }

  /**
   * Create shadow git checkpoint
   */
  public async createCheckpoint(projectPath: string, sessionId: string, turnIndex: number, summary: string): Promise<{ success: boolean; ref?: string; error?: string }> {
    try {
      const res = await fetch('/api/git/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, sessionId, turnIndex, summary })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Restore shadow git checkpoint with real disk rollback
   */
  public async revertCheckpoint(projectPath: string, ref: string): Promise<{ success: boolean; restoredFiles?: string[]; error?: string }> {
    try {
      const res = await fetch('/api/git/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, ref })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const hostGateway = new HostGatewayService();
