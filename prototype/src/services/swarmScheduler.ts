import {
  TaskGraph,
  SwarmTask,
  Artifact,
  AgentRole,
  AgentDefinition,
  SwarmRun
} from '../types/agentRuntimeTypes';
import { agentEventStore } from './agentEventStore';

export class TaskGraphValidator {
  /**
   * Enforces that the TaskGraph is an acyclic Directed Acyclic Graph (DAG)
   */
  public static validateAcyclic(tasks: SwarmTask[]): { isValid: boolean; error?: string } {
    const taskMap = new Map<string, SwarmTask>();
    tasks.forEach(t => taskMap.set(t.id, t));

    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      inStack.add(taskId);

      const task = taskMap.get(taskId);
      if (task) {
        for (const depId of task.dependsOn) {
          if (!visited.has(depId)) {
            if (dfs(depId)) return true;
          } else if (inStack.has(depId)) {
            return true; // Cycle detected
          }
        }
      }

      inStack.delete(taskId);
      return false;
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        if (dfs(task.id)) {
          return { isValid: false, error: `Detected cyclical dependency in task: ${task.id}` };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Calculates tasks that are ready to execute based on completed dependencies
   */
  public static getReadyTasks(tasks: SwarmTask[]): SwarmTask[] {
    return tasks.filter(task => {
      if (task.status !== 'pending') return false;
      // All dependencies must be in 'passed' state
      const allDepsPassed = task.dependsOn.every(depId => {
        const dep = tasks.find(t => t.id === depId);
        return dep?.status === 'passed';
      });
      return allDepsPassed;
    });
  }
}

export class ArtifactStore {
  private artifacts: Map<string, Artifact> = new Map();

  public saveArtifact(artifact: Artifact): Artifact {
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  public getArtifact(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  public getArtifactsForTask(taskId: string): Artifact[] {
    return Array.from(this.artifacts.values()).filter(a => a.taskId === taskId);
  }

  public getArtifactsForRun(runId: string): Artifact[] {
    return Array.from(this.artifacts.values()).filter(a => a.runId === runId);
  }

  public clear(): void {
    this.artifacts.clear();
  }
}

export const globalArtifactStore = new ArtifactStore();
