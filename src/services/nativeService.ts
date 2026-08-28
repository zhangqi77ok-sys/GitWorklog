import { invoke } from "@tauri-apps/api/core";
import { IPCResponse } from "../types/contracts";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  children?: FileEntry[];
}

export class NativeService {
  private isTauriEnv(): boolean {
    return Boolean(
      typeof window !== "undefined" &&
        ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
    );
  }

  /**
   * 带超时守卫与错误信封封装的通用 IPC 调用封装器
   */
  private async safeInvoke<T>(cmd: string, args?: Record<string, any>, timeoutMs: number = 15000): Promise<IPCResponse<T>> {
    const startTime = performance.now();
    if (!this.isTauriEnv()) {
      return {
        success: false,
        error: {
          code: "ERR_NON_TAURI_ENV",
          message: `无法执行原生命令 [${cmd}]：当前运行在非 Tauri 浏览器预览环境`,
          suggestion: "请使用 CodeMind-Studio.exe 原生桌面端体验全量系统调用",
        },
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`IPC Command [${cmd}] timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const data = await Promise.race([invoke<T>(cmd, args), timeoutPromise]);
      return {
        success: true,
        data,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      console.warn(`[NativeService] IPC Command [${cmd}] failed:`, err);
      return {
        success: false,
        error: {
          code: "ERR_IPC_FAILED",
          message: err?.message || String(err),
          suggestion: "请检查本地目录访问权限或文件是否被其他进程占用",
        },
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * 1. 调用 Windows 系统原生文件夹选择器 (Win32 Folder Dialog)
   */
  public async pickFolder(): Promise<string | null> {
    const res = await this.safeInvoke<string | null>("pick_folder_native");
    return res.success && res.data ? res.data : null;
  }

  /**
   * 2. 真实读取磁盘目录树
   */
  public async listDirectoryTree(path: string, maxDepth = 4): Promise<FileEntry[]> {
    const res = await this.safeInvoke<FileEntry[]>("list_directory_tree", { path, maxDepth });
    return res.success && res.data ? res.data : [];
  }

  /**
   * 3. 真实读取本地磁盘文件
   */
  public async readFile(path: string): Promise<string> {
    const res = await this.safeInvoke<string>("read_file_content", { path });
    if (res.success && res.data !== undefined) return res.data;
    throw new Error(res.error?.message || "读取文件失败");
  }

  /**
   * 4. 真实写入本地磁盘文件
   */
  public async writeFile(path: string, content: string): Promise<boolean> {
    const res = await this.safeInvoke<boolean>("write_file_content", { path, content });
    return Boolean(res.success && res.data);
  }

  /**
   * 5. 真实执行本地系统 PowerShell/CMD 命令 (带 CREATE_NO_WINDOW 无黑框保障)
   */
  public async executeCommand(command: string, cwd?: string): Promise<string> {
    const res = await this.safeInvoke<string>("execute_system_command", { command, cwd });
    if (res.success && res.data !== undefined) return res.data;
    throw new Error(res.error?.message || "系统命令执行失败");
  }

  /**
   * 6. 批量合并查询工作区快照 (IPC Batching)
   */
  public async getWorkspaceSnapshot(path?: string): Promise<{
    git_branch: string | null;
    files: string[];
    is_git: boolean;
  } | null> {
    const res = await this.safeInvoke<any>("get_workspace_snapshot", { path });
    return res.success && res.data ? res.data : null;
  }

  /**
   * 7. 真实探测当前工程所在目录的 Git 分支
   */
  public async getGitBranch(cwd?: string): Promise<string | null> {
    const snap = await this.getWorkspaceSnapshot(cwd);
    if (snap?.git_branch) return snap.git_branch;

    try {
      const output = await this.executeCommand("git branch --show-current", cwd);
      const branch = output.trim();
      if (branch && !branch.includes("fatal") && !branch.includes("error")) {
        return branch;
      }
    } catch (e) {
      return null;
    }
    return null;
  }
}

export const nativeService = new NativeService();
