import { SwarmAgentState, INITIAL_SWARM_AGENTS } from '../types/contracts';

export class SwarmPipelineManager {
  private agents: SwarmAgentState[] = [...INITIAL_SWARM_AGENTS];

  public getAgents(): SwarmAgentState[] {
    return this.agents;
  }

  public advanceStage(): SwarmAgentState[] {
    const runningIdx = this.agents.findIndex(a => a.status === 'running');
    if (runningIdx !== -1) {
      this.agents[runningIdx].status = 'completed';
      this.agents[runningIdx].progress = 100;
      if (runningIdx + 1 < this.agents.length) {
        this.agents[runningIdx + 1].status = 'running';
        this.agents[runningIdx + 1].progress = 30;
      }
    }
    return [...this.agents];
  }
}

export const defaultSwarmManager = new SwarmPipelineManager();
