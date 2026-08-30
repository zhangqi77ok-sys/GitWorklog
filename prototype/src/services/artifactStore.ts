import {
  Artifact,
  ArtifactType
} from '../types/agentRuntimeTypes';
import { agentEventStore } from './agentEventStore';

const STORAGE_ARTIFACTS_KEY = 'tcode_artifacts_v1';

export class PersistentArtifactStore {
  private artifacts: Map<string, Artifact> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_ARTIFACTS_KEY);
      if (raw) {
        const list: Artifact[] = JSON.parse(raw);
        list.forEach(a => this.artifacts.set(a.id, a));
      }
    } catch {
      // safe fallback
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_ARTIFACTS_KEY, JSON.stringify(Array.from(this.artifacts.values()).slice(-200)));
    } catch {
      // quota handling
    }
  }

  public saveArtifact(artifact: Artifact): Artifact {
    this.artifacts.set(artifact.id, artifact);
    this.persist();

    // Broadcast artifact creation
    agentEventStore.emit({
      sessionId: 'default',
      runId: artifact.runId,
      type: 'artifact.created',
      source: 'agent',
      payload: artifact
    });

    return artifact;
  }

  public createArtifact(params: {
    runId: string;
    taskId: string;
    type: ArtifactType;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Artifact {
    const existing = this.getArtifactsForTask(params.taskId).filter(a => a.type === params.type);
    const version = existing.length + 1;

    const artifact: Artifact = {
      id: `art-${params.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      runId: params.runId,
      taskId: params.taskId,
      type: params.type,
      title: params.title,
      content: params.content,
      metadata: params.metadata,
      version,
      createdAt: Date.now()
    };

    return this.saveArtifact(artifact);
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
    this.persist();
  }
}

export const persistentArtifactStore = new PersistentArtifactStore();
