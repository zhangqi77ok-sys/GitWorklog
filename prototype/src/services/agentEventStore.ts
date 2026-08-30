import {
  AgentRun,
  AgentRound,
  ToolCall,
  ToolResult,
  Changeset,
  AcceptanceItem,
  AgentEventEnvelope,
  AgentEventType,
  ContextSnapshot,
  PermissionRule
} from '../types/agentRuntimeTypes';
import { hostGateway } from './hostGateway';

const STORAGE_EVENTS_KEY = 'tcode_agent_events_v1';
const STORAGE_RUNS_KEY = 'tcode_agent_runs_v1';
const STORAGE_ROUNDS_KEY = 'tcode_agent_rounds_v1';
const STORAGE_PERM_RULES_KEY = 'tcode_permission_rules_v1';

/** In-memory active event stream store */
class AgentEventStore {
  private events: AgentEventEnvelope[] = [];
  private runs: Map<string, AgentRun> = new Map();
  private rounds: Map<string, AgentRound> = new Map();
  private toolCalls: Map<string, ToolCall> = new Map();
  private toolResults: Map<string, ToolResult> = new Map();
  private changesets: Map<string, Changeset> = new Map();
  private acceptances: Map<string, AcceptanceItem> = new Map();
  private permissionRules: PermissionRule[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const rawEvents = localStorage.getItem(STORAGE_EVENTS_KEY);
      if (rawEvents) {
        this.events = JSON.parse(rawEvents);
      }
      const rawRuns = localStorage.getItem(STORAGE_RUNS_KEY);
      if (rawRuns) {
        const list: AgentRun[] = JSON.parse(rawRuns);
        list.forEach(r => this.runs.set(r.id, r));
      }
      const rawRounds = localStorage.getItem(STORAGE_ROUNDS_KEY);
      if (rawRounds) {
        const list: AgentRound[] = JSON.parse(rawRounds);
        list.forEach(r => this.rounds.set(r.id, r));
      }
      const rawRules = localStorage.getItem(STORAGE_PERM_RULES_KEY);
      if (rawRules) {
        this.permissionRules = JSON.parse(rawRules);
      }
    } catch {
      // safe fallback in browser/test env
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(this.events.slice(-500)));
      localStorage.setItem(STORAGE_RUNS_KEY, JSON.stringify(Array.from(this.runs.values()).slice(-50)));
      localStorage.setItem(STORAGE_ROUNDS_KEY, JSON.stringify(Array.from(this.rounds.values()).slice(-200)));
      localStorage.setItem(STORAGE_PERM_RULES_KEY, JSON.stringify(this.permissionRules));
    } catch {
      // quota or environment handling
    }
  }

  public emit(event: Omit<AgentEventEnvelope, 'id' | 'timestamp'>): AgentEventEnvelope {
    const fullEvent: AgentEventEnvelope = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...event
    };
    this.events.push(fullEvent);
    this.persist();

    // Broadcast to UI layer
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tcode_agent_event', { detail: fullEvent }));
    }
    return fullEvent;
  }

  public createRun(run: Omit<AgentRun, 'startedAt' | 'acceptanceIds' | 'roundIds'>): AgentRun {
    const fullRun: AgentRun = {
      ...run,
      acceptanceIds: [],
      roundIds: [],
      startedAt: Date.now()
    };
    this.runs.set(fullRun.id, fullRun);
    this.emit({
      sessionId: fullRun.sessionId,
      runId: fullRun.id,
      type: 'run.created',
      source: 'system',
      payload: fullRun
    });
    return fullRun;
  }

  public getRun(runId: string): AgentRun | undefined {
    return this.runs.get(runId);
  }

  public updateRun(runId: string, patch: Partial<AgentRun>): AgentRun | undefined {
    const run = this.runs.get(runId);
    if (!run) return undefined;
    const updated = { ...run, ...patch };
    this.runs.set(runId, updated);
    this.persist();
    return updated;
  }

  public createRound(round: Omit<AgentRound, 'startedAt' | 'toolCallIds' | 'changesetIds' | 'evidenceIds' | 'acceptanceIds'>): AgentRound {
    const fullRound: AgentRound = {
      ...round,
      toolCallIds: [],
      changesetIds: [],
      evidenceIds: [],
      acceptanceIds: [],
      startedAt: Date.now()
    };
    this.rounds.set(fullRound.id, fullRound);
    
    // Link to Run
    const run = this.runs.get(fullRound.runId);
    if (run && !run.roundIds.includes(fullRound.id)) {
      run.roundIds.push(fullRound.id);
      this.runs.set(run.id, run);
    }

    this.emit({
      sessionId: run?.sessionId || 'default',
      runId: fullRound.runId,
      roundId: fullRound.id,
      type: 'round.started',
      source: 'agent',
      payload: fullRound
    });
    return fullRound;
  }

  public getRound(roundId: string): AgentRound | undefined {
    return this.rounds.get(roundId);
  }

  public updateRound(roundId: string, patch: Partial<AgentRound>): AgentRound | undefined {
    const round = this.rounds.get(roundId);
    if (!round) return undefined;
    const updated = { ...round, ...patch };
    this.rounds.set(roundId, updated);
    this.persist();
    return updated;
  }

  public addPermissionRule(rule: Omit<PermissionRule, 'id' | 'createdAt'>): PermissionRule {
    const fullRule: PermissionRule = {
      id: `perm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      ...rule
    };
    this.permissionRules.push(fullRule);
    this.persist();
    return fullRule;
  }

  public getPermissionRules(): PermissionRule[] {
    return [...this.permissionRules];
  }

  public getAllEvents(): AgentEventEnvelope[] {
    return [...this.events];
  }

  public clearAll() {
    this.events = [];
    this.runs.clear();
    this.rounds.clear();
    this.toolCalls.clear();
    this.toolResults.clear();
    this.changesets.clear();
    this.acceptances.clear();
    this.persist();
  }
}

export const agentEventStore = new AgentEventStore();
