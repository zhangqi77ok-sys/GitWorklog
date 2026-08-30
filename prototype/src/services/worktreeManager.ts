/**
 * WP-E 模块六：git worktree 影子工作区生命周期管理。
 * 每个 Subagent 分配物理隔离目录（宿主 /api/git/worktree/*，Token 鉴权 + 路径沙箱）。
 */
export interface ShadowWorktree {
  id: string;
  shadowPath: string;
  createdAt: number;
}

class WorktreeManager {
  private shadows = new Map<string, ShadowWorktree>();

  public async createShadow(projectPath: string, id: string): Promise<ShadowWorktree> {
    const res = await fetch('/api/git/worktree/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, id })
    });
    const data = await res.json();
    if (!res.ok || data.success !== true) {
      throw new Error(data.error || `worktree create failed (HTTP ${res.status})`);
    }
    const shadow: ShadowWorktree = { id, shadowPath: data.shadowPath, createdAt: Date.now() };
    this.shadows.set(id, shadow);
    return shadow;
  }

  public async removeShadow(projectPath: string, id: string): Promise<void> {
    const res = await fetch('/api/git/worktree/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      throw new Error(data.error || `worktree remove failed (HTTP ${res.status})`);
    }
    this.shadows.delete(id);
  }

  public getShadowPath(id: string): string | undefined {
    return this.shadows.get(id)?.shadowPath;
  }

  public list(): ShadowWorktree[] {
    return Array.from(this.shadows.values());
  }

  public reset(): void {
    this.shadows.clear();
  }
}

/** Singleton: shadow workspace registry for the active swarm run. */
export const worktreeManager = new WorktreeManager();
