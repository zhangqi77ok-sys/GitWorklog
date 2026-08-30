/**
 * ────────────────────────────────────────────────────────────
 * 🧱 EVENT-DRIVEN AGENT RUNTIME CORE CONTRACTS
 * ────────────────────────────────────────────────────────────
 * 
 * Truth-First Architectural Principles:
 * 1. Single Source of Truth: AgentRun -> AgentRound -> ToolCall -> ToolResult -> Changeset
 * 2. Immutable Event Log: AgentEventEnvelope records every state transition.
 * 3. Unified Execution Pipeline: All host modifications route exclusively through AgentRuntimeController.
 * 4. Progressive & Verifiable: Acceptance criteria belong to the Run, verified with concrete evidence.
 */

export type AgentRunStatus =
  | 'created'
  | 'running'
  | 'waiting_approval'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'resource_limit';

export type AgentRoundPhase =
  | 'understand'
  | 'inspect'
  | 'plan'
  | 'modify'
  | 'verify'
  | 'fix'
  | 'done';

export type AgentRoundStatus =
  | 'queued'
  | 'thinking'
  | 'responding'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ToolCallStatus =
  | 'requested'
  | 'awaiting_approval'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export type ToolResultStatus = 'succeeded' | 'failed' | 'rejected' | 'cancelled';

export type ChangesetStatus = 'pending' | 'applied' | 'failed' | 'reverted';

export type AcceptanceItemStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'blocked';

export interface ChangedFile {
  path: string;
  operation: 'created' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  beforeHash?: string;
  afterHash?: string;
  diff?: string;
  toolCallId: string;
}

export interface Changeset {
  id: string;
  runId: string;
  roundId: string;
  status: ChangesetStatus;
  files: ChangedFile[];
  additions: number;
  deletions: number;
  createdAt: number;
}

export interface ToolCall {
  id: string;
  runId: string;
  roundId: string;
  source: 'builtin' | 'mcp' | 'hook';
  toolName: string;
  serverName?: string;
  input: Record<string, unknown>;
  status: ToolCallStatus;
  resultId?: string;
  createdAt: number;
}

export interface ToolResult {
  id: string;
  toolCallId: string;
  status: ToolResultStatus;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
  cwd?: string;
  durationMs?: number;
  affectedFiles?: string[];
  createdAt: number;
}

export interface AcceptanceItem {
  id: string;
  runId: string;
  description: string;
  status: AcceptanceItemStatus;
  evidenceIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentRound {
  id: string;
  runId: string;
  index: number;
  phase: AgentRoundPhase;
  status: AgentRoundStatus;
  thinkingText?: string;
  progressSummary?: string;
  responseText?: string;
  toolCallIds: string[];
  changesetIds: string[];
  evidenceIds: string[];
  acceptanceIds: string[];
  startedAt: number;
  finishedAt?: number;
}

export interface AgentError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ContextSource {
  id: string;
  type: 'rule' | 'steering' | 'skill' | 'file' | 'mcp';
  name: string;
  path?: string;
  reason: 'always' | 'fileMatch' | 'manual' | 'auto' | 'selected';
  injected: boolean;
  tokenCount: number;
}

export interface ContextSnapshot {
  id: string;
  runId: string;
  systemRules: ContextSource[];
  steeringFiles: ContextSource[];
  selectedSkills: ContextSource[];
  mcpCapabilities: Array<{ name: string; toolsCount: number }>;
  referencedFiles: ContextSource[];
  systemPromptText: string;
  estimatedTokens: number;
  contextLimit: number;
  createdAt: number;
}

export interface AgentRun {
  id: string;
  sessionId: string;
  userMessageId: string;
  status: AgentRunStatus;
  goal: string;
  modelId: string;
  workMode: string;
  permissionPolicy: string;
  acceptanceIds: string[];
  roundIds: string[];
  contextSnapshotId: string;
  startedAt: number;
  finishedAt?: number;
  error?: AgentError;
}

// ────────────────────────────────────────────────────────────
// 📜 IMMUTABLE EVENT ENVELOPE
// ────────────────────────────────────────────────────────────

export type AgentEventType =
  | 'run.created'
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled'
  | 'round.started'
  | 'round.progress'
  | 'round.response_delta'
  | 'round.completed'
  | 'tool.requested'
  | 'tool.approval_required'
  | 'tool.approved'
  | 'tool.rejected'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'changeset.created'
  | 'changeset.applied'
  | 'changeset.reverted'
  | 'verification.completed'
  | 'context.loaded'
  | 'context.compressed'
  | 'error.created'
  | 'task.created'
  | 'task.ready'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.retrying'
  | 'task.blocked'
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'artifact.created'
  | 'review.requested'
  | 'review.completed';

export interface AgentEventEnvelope {
  id: string;
  sessionId: string;
  runId: string;
  roundId?: string;
  parentEventId?: string;
  type: AgentEventType;
  source: 'user' | 'agent' | 'builtin' | 'mcp' | 'hook' | 'system';
  timestamp: number;
  payload: unknown;
}

export interface PermissionRule {
  id: string;
  actionType: 'write_file' | 'run_command' | 'mcp_tool';
  scope: string;
  decision: 'allow' | 'deny';
  sessionId?: string;
  createdAt: number;
}

// ────────────────────────────────────────────────────────────
// 🐝 SWARM MULTI-AGENT TASKGRAPH & ARTIFACT CONTRACTS
// ────────────────────────────────────────────────────────────

export type AgentRole =
  | 'planner'
  | 'analyst'
  | 'architect'
  | 'coder'
  | 'tester'
  | 'reviewer'
  | 'fixer'
  | 'summarizer';

export type SwarmTaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting_approval'
  | 'blocked'
  | 'reviewing'
  | 'passed'
  | 'failed'
  | 'cancelled';

export interface AgentDefinition {
  id: string;
  role: AgentRole;
  modelId: string;
  providerId: string;
  systemPrompt: string;
  allowedTools: string[];
  readScopes: string[];
  writeScopes: string[];
  maxConcurrency: number;
  canDelegate: boolean;
}

export type ArtifactType =
  | 'plan'
  | 'analysis'
  | 'architecture'
  | 'patch'
  | 'changeset'
  | 'test_result'
  | 'review'
  | 'summary';

export interface Artifact {
  id: string;
  runId: string;
  taskId: string;
  type: ArtifactType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: number;
}

export interface SwarmTask {
  id: string;
  runId: string;
  title: string;
  description: string;
  role: AgentRole;
  status: SwarmTaskStatus;
  dependsOn: string[];
  inputArtifactIds: string[];
  outputArtifactIds: string[];
  acceptanceIds: string[];
  attempt: number;
  assignedAgentId?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

export interface TaskGraph {
  runId: string;
  tasks: SwarmTask[];
  dependencies: Array<{ fromTaskId: string; toTaskId: string }>;
  createdAt: number;
}

export interface SwarmRun {
  id: string;
  sessionId: string;
  userMessageId: string;
  mode: 'harness' | 'swarm';
  status:
    | 'created'
    | 'planning'
    | 'running'
    | 'waiting_approval'
    | 'waiting_user'
    | 'blocked'
    | 'reviewing'
    | 'completed'
    | 'failed'
    | 'cancelled';
  rootTaskId?: string;
  taskIds: string[];
  agentIds: string[];
  configSnapshotId: string;
  checkpointRef?: string;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
}

