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
   * 7. 真实探测当前工程所在目录的 Git 分支与详细信息
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

  /**
   * 获取完整的真实 Git 仓库状态、本地分支、远程分支与未提交变更
   */
  public async getFullGitStatus(cwd?: string): Promise<{
    currentBranch: string;
    isGit: boolean;
    localBranches: string[];
    remoteBranches: string[];
    tags: string[];
    uncommittedFiles: string[];
    rawStatus: string;
  }> {
    try {
      const currBranch = await this.getGitBranch(cwd);
      if (!currBranch) {
        return {
          currentBranch: "main",
          isGit: false,
          localBranches: ["main"],
          remoteBranches: [],
          tags: [],
          uncommittedFiles: [],
          rawStatus: "非 Git 版本控制工程",
        };
      }

      // 获取所有本地分支 (对齐 open-source 工具规范，支持 worktree '+' 与当前分支 '*' 标记)
      let localBranches: string[] = [];
      try {
        const branchOut = await this.executeCommand("git branch --no-color", cwd);
        localBranches = branchOut
          .split("\n")
          .map((b) => b.replace(/^[\*\+\s]+/, "").trim())
          .filter((b) => b && !b.startsWith("("));
      } catch (e) {
        localBranches = [currBranch];
      }

      // 获取所有远程分支
      let remoteBranches: string[] = [];
      try {
        const remoteOut = await this.executeCommand("git branch -r --no-color", cwd);
        remoteBranches = remoteOut
          .split("\n")
          .map((b) => b.replace(/^[\*\+\s]+/, "").trim())
          .filter((b) => b && !b.includes("->") && !b.startsWith("("));
      } catch (e) {}

      // 获取所有标签 (Tags)
      let tags: string[] = [];
      try {
        const tagOut = await this.executeCommand("git tag -l", cwd);
        tags = tagOut.split("\n").map((t) => t.trim()).filter(Boolean);
      } catch (e) {}

      // 获取未提交变更
      let uncommittedFiles: string[] = [];
      let rawStatus = "";
      try {
        rawStatus = await this.executeCommand("git status --short", cwd);
        uncommittedFiles = rawStatus
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
      } catch (e) {}

      return {
        currentBranch: currBranch,
        isGit: true,
        localBranches: localBranches.length > 0 ? localBranches : [currBranch],
        remoteBranches,
        tags,
        uncommittedFiles,
        rawStatus,
      };
    } catch (err) {
      return {
        currentBranch: "main",
        isGit: false,
        localBranches: ["main"],
        remoteBranches: [],
        tags: [],
        uncommittedFiles: [],
        rawStatus: "检测 Git 仓库异常",
      };
    }
  }

  /**
   * 切换 Git 分支 (git checkout <branch>)
   */
  public async checkoutBranch(branchName: string, cwd?: string): Promise<string> {
    return this.executeCommand(`git checkout ${branchName}`, cwd);
  }

  /**
   * 新建并切换 Git 分支 (git checkout -b <branch>)
   */
  public async createAndCheckoutBranch(branchName: string, cwd?: string): Promise<string> {
    return this.executeCommand(`git checkout -b ${branchName}`, cwd);
  }

  /**
   * 删除 Git 分支 (git branch -d / -D <branch>)
   */
  public async deleteBranch(branchName: string, force = false, cwd?: string): Promise<string> {
    const flag = force ? "-D" : "-d";
    return this.executeCommand(`git branch ${flag} ${branchName}`, cwd);
  }

  /**
   * 合并分支到当前分支 (git merge <branch>)
   */
  public async mergeBranch(branchName: string, cwd?: string): Promise<string> {
    return this.executeCommand(`git merge ${branchName}`, cwd);
  }

  /**
   * 执行 Git Pull (拉取远程更新)
   */
  public async gitPull(cwd?: string): Promise<string> {
    return this.executeCommand("git pull", cwd);
  }

  /**
   * 执行 Git Push (推送本地提交)
   */
  public async gitPush(cwd?: string): Promise<string> {
    return this.executeCommand("git push", cwd);
  }

  /**
   * 执行 Git Fetch (获取远程最新索引)
   */
  public async gitFetch(cwd?: string): Promise<string> {
    return this.executeCommand("git fetch", cwd);
  }

  /**
   * 8. 生产级互联网实时搜索检索
   */
  public async webSearch(query: string): Promise<Array<{ title: string; snippet: string; url: string; source: string }>> {
    const res = await this.safeInvoke<string>("native_web_search", { query });
    if (res.success && res.data) {
      try {
        const parsed = JSON.parse(res.data);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        return [];
      }
    }
    return [];
  }
}

export const nativeService = new NativeService();
