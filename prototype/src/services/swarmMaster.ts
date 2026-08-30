/**
 * WP-E 模块六：Swarm Master 总控 —— 订阅 Subagent 动作事件（遥测总线），
 * 对越界动作实时记录纠偏干预指令（sendIntervention）。
 */
import { evaluateSubagentAction, type ActionViolation } from './swarmSteering';

export interface SubagentHandle {
  id: string;
  role: string;
  shadowId: string;
  interventions: string[];
}

export class SwarmMaster {
  private subagents = new Map<string, SubagentHandle>();

  public registerSubagent(id: string, role: string, shadowId: string): void {
    this.subagents.set(id, { id, role, shadowId, interventions: [] });
  }

  public unregisterSubagent(id: string): void {
    this.subagents.delete(id);
  }

  /**
   * Telemetry bus hook: called on every subagent action event.
   * Returns the violation (with intervention) when the action is out of scope,
   * otherwise null so callers can skip the intervention round-trip.
   */
  public onSubagentAction(id: string, action: { type: string; path?: string }): ActionViolation | null {
    const handle = this.subagents.get(id);
    if (!handle) return null;
    const violation = evaluateSubagentAction(handle.role, action.type, action.path || '');
    if (!violation.allowed && violation.intervention) {
      handle.interventions.push(violation.intervention);
    }
    return violation;
  }

  public sendIntervention(id: string, message: string): void {
    const handle = this.subagents.get(id);
    if (handle) handle.interventions.push(message);
  }

  public getInterventions(id: string): string[] {
    return this.subagents.get(id)?.interventions ?? [];
  }

  public hasViolations(): boolean {
    let found = false;
    this.subagents.forEach(h => {
      if (h.interventions.length > 0) found = true;
    });
    return found;
  }
}
