/**
 * WP-E 模块六：Swarm 运行期门面 —— 把影子工作区 + Master 纠偏 + 2PC 合并
 * 组合成一个可被调度器/工作台使用的运行时单位。
 */
import { worktreeManager, type ShadowWorktree } from './worktreeManager';
import { SwarmMaster } from './swarmMaster';
import { createTwoPhaseMerge, type TwoPhaseMergeState } from './twoPhaseMerge';

export interface SwarmRoleSpec {
  id: string;
  role: string;
}

export interface SwarmRunRuntime {
  master: SwarmMaster;
  merge: TwoPhaseMergeState;
  shadows: ShadowWorktree[];
  projectPath?: string;
  startedAt: number;
}

export async function createSwarmRunRuntime(
  projectPath?: string,
  roles: SwarmRoleSpec[] = []
): Promise<SwarmRunRuntime> {
  const master = new SwarmMaster();
  const shadows: ShadowWorktree[] = [];
  if (projectPath) {
    for (const r of roles) {
      try {
        const shadow = await worktreeManager.createShadow(projectPath, `shadow-${r.id}`);
        shadows.push(shadow);
        master.registerSubagent(r.id, r.role, shadow.id);
      } catch {
        // Non-git repo or host unavailable: fall back to no physical isolation.
      }
    }
  }
  return { master, merge: createTwoPhaseMerge(), shadows, projectPath, startedAt: Date.now() };
}

export async function disposeSwarmRunRuntime(runtime: SwarmRunRuntime): Promise<void> {
  const projectPath = runtime.projectPath;
  for (const s of runtime.shadows) {
    try {
      if (projectPath) await worktreeManager.removeShadow(projectPath, s.id);
    } catch {
      // Best-effort cleanup; host may already be gone.
    }
  }
  runtime.shadows = [];
}
