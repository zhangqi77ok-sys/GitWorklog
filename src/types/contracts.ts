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

// 6. 智能体向用户提问的选项契约 (Ask Options Protocol)
export interface AskOption {
  id: string;
  label: string;
  description?: string;
}

export interface AskOptionsPayload {
  type: "ask_options";
  question: string;
  options: AskOption[];
  single_select: boolean;
}
// 7. 智能体文件修改工具契约 (File Modification Tool Protocol)
export interface WriteFileToolCall {
  type: "tool_call";
  tool: "write_file";
  path: string;          // 相对项目根的路径 (如 src/foo.ts)
  content: string;       // 完整新文件内容 (非 patch)
  description?: string;  // 修改说明
}

export type FileChangeStatus = "PENDING_APPROVAL" | "APPLIED" | "REVERTED" | "FAILED";

export interface FileChangeRecord {
  id: string;
  toolCall: WriteFileToolCall;
  absolutePath: string;    // 解析后的绝对路径 (供读写与展示)
  originalContent: string; // 修改前快照 (新文件为空字符串)
  newContent: string;
  status: FileChangeStatus;
  errorMessage?: string;
  timestamp: number;
  appliedAt?: number;
}

export interface DiffLine {
  type: "same" | "add" | "remove";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}
// 8. 智能体工具调用展示契约 (Tool Invocation Display)
export interface ParsedToolCall {
  type: "tool_call";
  tool: string;                         // write_file | skill | mcp | read_file | execute_command ...
  name?: string;                        // skill / mcp / 工具名称
  path?: string;                        // 文件相关路径
  args?: Record<string, any>;           // 调用参数
  content?: string;                     // write_file 时为完整新文件内容
  description?: string;                 // 调用说明
}

export type ToolInvocationStatus = "COMPLETED" | "FAILED";

export interface ToolInvocation {
  id: string;
  toolCall: ParsedToolCall;
  status: ToolInvocationStatus;
  errorMessage?: string;
  timestamp: number;
}
// 9. 计划任务契约 (Plan Task Protocol)
export type TaskDifficulty = "low" | "medium" | "high";
export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface PlanTaskItem {
  id: string;
  summary: string;          // 任务概要
  status: TaskStatus;       // pending / running / completed / failed
  difficulty: TaskDifficulty;
}

export interface TaskPlan {
  id: string;
  title: string;
  tasks: PlanTaskItem[];
  createdAt: number;
}

export interface ParsedPlan {
  type: "plan";
  title: string;
  tasks: PlanTaskItem[];
}

