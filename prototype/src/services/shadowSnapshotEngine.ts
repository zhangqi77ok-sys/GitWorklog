import { createShadowGitSnapshot, ShadowSnapshotMeta } from '../types/contracts';

export class ShadowSnapshotEngine {
  private snapshots: ShadowSnapshotMeta[] = [];

  public captureSnapshot(sessionId: string, stepIndex: number, label: string): ShadowSnapshotMeta {
    const snap = createShadowGitSnapshot(sessionId, stepIndex, label);
    this.snapshots.push(snap);
    return snap;
  }

  public getSnapshots(): ShadowSnapshotMeta[] {
    return this.snapshots;
  }

  public rollbackToSnapshot(snapshotId: string): boolean {
    const found = this.snapshots.find(s => s.snapshotId === snapshotId);
    return !!found;
  }
}

export const defaultShadowSnapshotEngine = new ShadowSnapshotEngine();
