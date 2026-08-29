import { defaultSandboxGuard } from './sandboxGuard';
import { defaultSecurityShield } from './securityShield';
import { WorkMode } from '../types/contracts';
import { getRuntimePolicy } from './runtimePolicy';
import { loadSavedGlobalSettings } from './settingsStore';

export interface HostExecOptions {
  cwd?: string;
  sudo?: boolean;
  mode?: WorkMode;
  runId?: string;
}

export interface HostExecResult {
  success: boolean;
  stdout: string;
  stderr?: string;
  error?: string;
  exitCode: number;
  isSandboxIntercepted?: boolean;
  isPolicyDenied?: boolean;
}

export class HostGatewayService {
  /**
   * Universal terminal command execution with SecurityShield sanitize, SandboxGuard & Mode Policy Check
   */
  public async executeCommand(cmd: string, options: HostExecOptions = {}): Promise<HostExecResult> {
    // 🛡️ Air-Gapped Network Isolation Guard
    const settings = loadSavedGlobalSettings();
    if (settings.isAirGapped) {
      const isOutboundNetCommand = /curl\s+|wget\s+|ping\s+|ssh\s+|git\s+push|git\s+fetch|git\s+clone|npm\s+install|pip\s+install/i.test(cmd);
      if (isOutboundNetCommand) {
        return {
          success: false,
          stdout: '',
          stderr: '🚫 [Air-Gapped Isolation]: 纯离线物理隔离模式已开启，已物理阻断外部公网请求与远程包下载。',
          exitCode: 1,
          isPolicyDenied: true
        };
      }
    }
    const trimmed = cmd.trim();
    if (!trimmed) {
      return {
        success: false,
        stdout: '',
        stderr: 'Empty command',
        exitCode: 1
      };
    }

    // 1. Host-Enforced Mode Capability Verification (Plan and Creator strictly forbid business shell execution)
    const mode = options.mode || 'act';
    const policy = getRuntimePolicy(mode);
    if (!policy.capabilities.runCommands) {
      return {
        success: false,
        stdout: '',
        stderr: `🚫 [HostGateway Security]: 当前处于【${policy.label}】模式，宿主策略严格禁止执行终端命令。`,
        exitCode: 1,
        isPolicyDenied: true
      };
    }

    // 2. SandboxGuard command safety classification
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

    // 3. Dispatch to Python Desktop Host Gateway API
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
   * File write through Host Gateway with Mode Capability & boundary check
   */
  public async writeFile(path: string, content: string, options: { mode?: WorkMode } = {}): Promise<{ success: boolean; size?: number; error?: string; isPolicyDenied?: boolean }> {
    const mode = options.mode || 'act';
    const policy = getRuntimePolicy(mode);
    if (!policy.capabilities.writeFiles) {
      return {
        success: false,
        error: `🚫 [HostGateway Security]: 当前处于【${policy.label}】模式，宿主安全策略严禁物理写入或修改业务文件。`,
        isPolicyDenied: true
      };
    }

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
