/**
 * CodeMind Studio 统一类型契约体系 (Universal Type Contract System)
 * DX & Contract-First Single Source of Truth
 */

// 1. ReAct 状态与动作契约
export type ReActStepType = "THOUGHT" | "ACTION" | "OBSERVATION" | "FINAL_ANSWER";
export type ReActStepStatus = "PENDING" | "RESOLVED" | "FAILED" | "WAITING_APPROVAL" | "REJECTED";
export type ActionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ReActActionPayload {
  actionName: string;
  actionArgs: Record<string, any>;
  riskLevel: ActionRiskLevel;
  description: string;
  targetPath?: string;
  commandSnippet?: string;
}

export interface ReActStepNode {
  id: string;
  stepIndex: number;
  stepType: ReActStepType;
  status: ReActStepStatus;
  title: string;
  content: string;
  actionPayload?: ReActActionPayload;
  actionResult?: any;
  timestamp: number;
  durationMs?: number;
}

export interface ReActTraceState {
  traceId: string;
  currentStepIndex: number;
  steps: ReActStepNode[];
  activeAction?: string;
  isCompleted: boolean;
  hasError: boolean;
  waitingApprovalStepId?: string;
}

// 2. AST 结构化压缩与引用锚点契约
export interface CodeAnchorRef {
  file: string;
  startLine?: number;
  endLine?: number;
  symbolName?: string;
  signature?: string;
}

export interface ASTCompressedItem {
  id: string;
  anchor: CodeAnchorRef;
  extractedSignatures: string[];
  summary: string;
  originalLineCount: number;
  compressedTokenCount: number;
}

export interface ASTCompressionResult {
  wasCompressed: boolean;
  compressedMessages: any[];
  astItems: ASTCompressedItem[];
  originalTokens: number;
  newTokens: number;
  savedTokens: number;
  ratioPercent: number;
}

// 3. Tauri v2 IPC 统一响应信封契约
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    suggestion?: string;
  };
  durationMs: number;
}

// 4. 会话三态与全局状态契约
export type SessionLifecycleStatus = "idle" | "running" | "error";

export interface SessionStatusEventDetail {
  sessionId?: string;
  status: SessionLifecycleStatus;
  errorMessage?: string;
}

// 5. 五星评分与严谨度动态约束契约
export type MessageRating = 1 | 2 | 3 | 4 | 5;

export interface RatingFeedbackRecord {
  id: string;
  rating: MessageRating;
  projectName: string;
  userQuery: string;
  assistantSummary: string;
  timestamp: number;
  strictnessMode: "CRITICAL_RIGOR" | "STANDARD" | "GOLDEN_TEMPLATE";
}

export interface StrictnessConstraint {
  level: "CRITICAL_RIGOR" | "STANDARD" | "GOLDEN_TEMPLATE";
  shouldInject: boolean;
  promptConstraint: string;
}
