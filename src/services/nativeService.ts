import { invoke } from "@tauri-apps/api/core";

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
   * 1. 调用 Windows 系统原生文件夹选择器 (Win32 Folder Dialog)
   */
  public async pickFolder(): Promise<string | null> {
    if (this.isTauriEnv()) {
      try {
        const selectedPath = await invoke<string | null>("pick_folder_native");
        return selectedPath;
      } catch (e) {
        console.warn("Tauri pick_folder_native error:", e);
      }
    }
    return null;
  }

  /**
   * 2. 真实读取磁盘目录树
   */
  public async listDirectoryTree(path: string, maxDepth = 4): Promise<FileEntry[]> {
    if (this.isTauriEnv()) {
      try {
        return await invoke<FileEntry[]>("list_directory_tree", {
          path,
          maxDepth,
        });
      } catch (e) {
        console.warn("Tauri list_directory_tree error:", e);
      }
    }
    return [];
  }

  /**
   * 3. 真实读取本地磁盘文件
   */
  public async readFile(path: string): Promise<string> {
    if (this.isTauriEnv()) {
      return await invoke<string>("read_file_content", { path });
    }
    throw new Error("当前环境非 Tauri 桌面原生环境");
  }

  /**
   * 4. 真实写入本地磁盘文件
   */
  public async writeFile(path: string, content: string): Promise<boolean> {
    if (this.isTauriEnv()) {
      return await invoke<boolean>("write_file_content", { path, content });
    }
    throw new Error("当前环境非 Tauri 桌面原生环境");
  }

  /**
   * 5. 真实执行本地系统 PowerShell/CMD 命令
   */
  public async executeCommand(command: string, cwd?: string): Promise<string> {
    if (this.isTauriEnv()) {
      return await invoke<string>("execute_system_command", { command, cwd });
    }
    throw new Error("当前环境非 Tauri 桌面原生环境");
  }

  /**
   * 6. 真实探测当前工程所在目录的 Git 分支
   */
  public async getGitBranch(cwd?: string): Promise<string | null> {
    if (this.isTauriEnv()) {
      try {
        const output = await this.executeCommand("git branch --show-current", cwd);
        const branch = output.trim();
        if (branch && !branch.includes("fatal") && !branch.includes("error")) {
          return branch;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

export const nativeService = new NativeService();
