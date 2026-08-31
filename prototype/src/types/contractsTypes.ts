// Tcode ?????? (SDD Contract) - extracted from contracts.ts
// ?????????????

export type SessionTier1Type = 'global' | 'project';

export interface SessionItem {
  id: string;
  tier1: SessionTier1Type;
  title: string;
  projectId?: string;
  projectName?: string;
  projectPath?: string;
  gitBranch?: string;
  filePath?: string;
  lineRange?: [number, number];
  tags: string[];
  messagesCount: number;
  totalTokens: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectGroup {
  id: string;
  name: string;
  path: string;
  gitBranch: string;
  isExpanded: boolean;
}

export interface TokenStats {
  totalTokens?: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
  ttftMs?: number;
  contextCurrentTokens: number;
  contextMaxTokens: number;
}

export type ContextGaugeLevel = 'safe' | 'warning' | 'danger';

export interface AskOptionItem {
  id: string;
  label: string;
  description?: string;
  isRecommended?: boolean;
}

export interface AskOptionsPayload {
  id: string;
  question: string;
  single_select: boolean;
  options: AskOptionItem[];
  allow_custom_input?: boolean;
  resolvedSelection?: string[];
  customInput?: string;
  status: 'pending' | 'resolved';
}

export type PermissionPolicy = 'strict_approval' | 'autonomous_agent' | 'risk_adaptive';

export type PermissionMode = 'plan' | 'act';

export interface PathPermissionRule {
  pattern: string;
  action: 'allow' | 'ask' | 'deny';
}

export interface CommandPermissionRule {
  pattern: string;
  action: 'allow' | 'ask' | 'deny';
}

export interface PermissionPolicyConfig {
  mode: PermissionMode;
  fileRules: PathPermissionRule[];
  commandRules: CommandPermissionRule[];
  allowLowRiskInSession: boolean;
}

export const DEFAULT_PERMISSION_CONFIG: PermissionPolicyConfig = {
  mode: 'act',
  fileRules: [
    { pattern: '.env*', action: 'deny' },
    { pattern: 'package.json', action: 'ask' },
    { pattern: 'tests/**', action: 'allow' }
  ],
  commandRules: [
    { pattern: 'git push*', action: 'ask' },
    { pattern: 'git reset --hard*', action: 'deny' },
    { pattern: 'rm -rf*', action: 'deny' },
    { pattern: 'npm test*', action: 'allow' },
    { pattern: 'vitest*', action: 'allow' },
    { pattern: 'pytest*', action: 'allow' }
  ],
  allowLowRiskInSession: false
};

export type WorkMode = 'act' | 'plan' | 'minimal' | 'creator';

export interface TaskPlanStep {
  id: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timeTaken?: string;
}

export interface TaskPlan {
  id: string;
  title: string;
  steps: TaskPlanStep[];
  activeStepIndex: number;
}

export interface ChatMessageTokens {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type ActionExecutionStatus = 'idle' | 'pending' | 'executing' | 'success' | 'failed' | 'rejected';

export interface AgentPendingAction {
  id: string;
  type: 'write_file' | 'run_command' | 'read_file';
  target: string;
  code: string;
  linesCount?: number;
  isHighRisk?: boolean;
  messageId?: string;
  status: ActionExecutionStatus;
}

// Agent Loop execution result. actionId is the stable link from a rendered action block to its host result.
export interface ActionResult {
  actionId: string;
  type: 'write_file' | 'run_command' | 'read_file';
  target: string;           // file path or first line of command
  status: ActionExecutionStatus;
  output?: string;          // stdout for run_command or read_file content
  error?: string;           // stderr or error message
  exitCode?: number;        // for run_command
  fileSize?: number;        // for write_file or read_file
}

export interface AgentSkillItem {
  id: string;
  name: string;
  tier: 'capability' | 'skill' | 'mcp'; // 3-Tier: 专精能力, Domain Skill, MCP 工具
  category: string;
  icon: string;
  description: string;
  promptInstruction: string;
  enabled: boolean;
  isCustom?: boolean;
}

export interface QueuedPromptItem {
  id: string;
  text: string;
  createdAt: number;
  selectedMentions?: MentionContextItem[];
}

export interface EvidenceItem {
  type: 'command' | 'file' | 'test' | 'manual';
  summary: string;
  command?: string;
  exitCode?: number;
  output?: string;
  filePath?: string;
  timestamp?: number;
}

export interface TargetAcceptanceItem {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'model_claimed';
  evidence?: string;                 // Backwards compatible string summary
  evidenceDetails?: EvidenceItem[]; // 🔬 结构化证据链（命令、退出码、stdout/stderr、文件）
}

export interface ContextEpoch {
  id: string;
  sessionId: string;
  epochIndex: number;
  createdAt: number;
  archivedMessageIds: string[];
  summaryText: string;
  summaryTokens: number;
  systemTokens: number;
  rulesTokens: number;
  turnTokens: number;
  contextLimit: number;
}

export type LoopTerminationStatus =
  | 'running'
  | 'completed'          // ✓ 目标已全部验证通过
  | 'needs_decision'      // ⏸ 需要用户在备选方案间决策
  | 'blocked'             // ⚠ 任务被外部条件阻塞（如缺少凭据）
  | 'no_progress'         // ⚠ 连续无进展/死循环熔断
  | 'strikeout'           // ?? ??????? 3 ???????????? + ???
  | 'resource_limit';     // ⚠ 达到时间/费用/安全预算熔断

export interface InternalStepTag {
  turn: number;
  step: number;
  phase: 'understand' | 'inspect' | 'modify' | 'verify' | 'fix' | 'done';
  status: 'running' | 'passed' | 'failed' | 'blocked';
  label: string;
}

export interface AgentRoundItem {
  roundId: number;
  title: string;
  status: 'running' | 'passed' | 'failed' | 'blocked';
  phase: 'understand' | 'plan' | 'inspect' | 'modify' | 'verify' | 'fix' | 'done';
  content: string;
  thinkingText?: string;
  actionResults?: ActionResult[];
  feedback?: string;
  timestamp: number;
}

/** 🐝 Swarm 真并发多角色：单个 Subagent 的流式运行态。 */
export interface SwarmRoleStream {
  id: string;       // 角色稳定 id（architect/dev/qa/security）
  name: string;     // 角色显示名（如 系统架构师）
  icon: string;     // 角色徽标（📐 💻 🧪 🛡️）
  duty?: string;    // 分工职责一句话
  content: string;  // 该角色已累积的流式内容
  status: 'running' | 'passed' | 'error';
  error?: string;   // status=error 时的错误信息
  /** Master 审查后要求修订的次数（0 表示首轮即通过）。 */
  revisions?: number;
  /** Master 干预/审查反馈记录（含修订指令）。 */
  interventions?: string[];
}

/** 🐝 Swarm 会话级结构化协同状态（Master 拆解 -> 多角色并发 -> Master 终审）。 */
export type SwarmPhase = 'planning' | 'roles' | 'summary' | 'done';

export interface SwarmChatState {
  /** 当前协同阶段（前端据此决定流式光标/骨架展示）。 */
  phase: SwarmPhase;
  masterPlanning: string;
  roles: SwarmRoleStream[];
  masterSummary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  optionsPayload?: AskOptionsPayload;
  taskPlan?: TaskPlan;
  auditTag?: string;
  tokensUsed?: number;
  tokensDetail?: ChatMessageTokens;
  durationSeconds?: number;
  permissionPolicy?: PermissionPolicy;
  actionResults?: ActionResult[];     // Agent Loop execution results for action blocks in this message
  isAgentFeedback?: boolean;          // True for Agent Loop feedback messages (shown as compact system cards)
  checkpointRef?: string;             // Git plumbing shadow snapshot reference (e.g. refs/codemind/checkpoints/<sessionId>/<turnIndex>)
  turnIndex?: number;                 // 1-based user conversational turn index
  acceptanceItems?: TargetAcceptanceItem[]; // 🎯 目标驱动验收项清单
  stepTags?: InternalStepTag[];       // 🏷️ 内部执行步骤 Tag 列表
  rounds?: AgentRoundItem[];           // 🔄 单 Agent Run 内部各轮次历史记录（不覆盖历史，追加存储）
  activeRoundId?: number;             // 当前正在运行或查看的轮次 ID
  loopStatus?: LoopTerminationStatus; // 🏁 当前任务终止或进行状态
  terminationSummary?: string;        // 总结描述（如：4/4 项验收通过 · 测试通过）
  swarm?: SwarmChatState;            // 🐝 Swarm 真并发多角色结构化状态（存在时优先于正文正则解析）
  images?: Array<{ id: string; name: string; dataUrl: string; sizeBytes?: number }>; // 🖼️ 多模态图片/截图附件
}

// Runtime L2 Session State Snapshot
export interface SessionRuntimeState {
  scrollTop: number;
  activeFilePath?: string;
  openTabs: string[];
  terminalHeightPercent?: number;
  expandedThinkingIds: string[];
}

// Runtime L3 Agent Loop Checkpoint State
export interface AgentLoopBreakpoint {
  sessionId: string;
  stepIndex: number;
  totalSteps: number;
  pendingActions: AgentPendingAction[];
  executedResults: ActionResult[];
  isPaused: boolean;
  timestamp: number;
}

// DnD Standard Drag Payload
export interface DnDPayload {
  dragType: 'file' | 'snippet' | 'tab' | 'panel';
  payload: any;
  sourceId: string;
}

export interface LiveLogItem {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'NET';
  module: string;
  message: string;
}

export type WindowBreakpoint = 'ultrawide' | 'standard' | 'laptop' | 'split_half';

export interface AIModelOption {
  id: string;
  name: string;
  provider: 'Anthropic' | 'DeepSeek' | 'OpenAI' | 'Local';
  providerId?: string;       // Explicit provider parent ID (e.g. 'provider-opencode', 'provider-deepseek')
  uniqueKey?: string;        // Fully qualified composite key (e.g. 'provider-opencode:deepseek-v4-flash')
  contextLimit: number;
  inputPricePerM: number;
  outputPricePerM: number;
  badge?: string;
  description?: string;
  adapter?: 'openai-responses' | 'anthropic-messages' | 'google-generative-language' | 'openai-compatible-chat';
  endpointPath?: string;
  protocol?: 'responses' | 'anthropic_messages' | 'google_native' | 'chat_completions';
  capabilities?: {
    streaming: boolean;
    toolCalling: boolean;
    reasoning: boolean;
    vision: boolean;
    structuredOutput: boolean;
  };
}

export interface TerminalTab {
  id: string;
  title: string;
  shell: string;
  logs: string[];
  cwd?: string;
}

export interface FileNode {
  id: string;
  name: string;
  path?: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
  isExpanded?: boolean;
}

// Global Search Contract
export interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  matchRange: [number, number];
}

export interface SearchResultFile {
  filePath: string;
  fileName: string;
  matches: SearchMatch[];
}

export interface GitFileChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
  additions: number;
  deletions: number;
}

export interface ShadowSnapshotItem {
  id: string;
  timestamp: number;
  label: string;
  gitCommitHash: string;
  changedFilesCount: number;
  isAiGenerated: boolean;
}

// Gateway & MCP Contract
export interface ProviderHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  endpoint: string;
  activeModel: string;
}

export interface McpServerInfo {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  toolsCount: number;
  tools: string[];
}

// Settings Contract
export interface SystemSettings {
  airGappedMode: boolean;
  dailyTokenLimit: number;
  contextWarnRatio: number;
  defaultPermission: PermissionPolicy;
  theme: 'cream' | 'dark_charcoal' | 'system';
}


// Contextual Scoping Data & Helpers
export interface ProjectWorkspaceData {
  projectId: string;
  projectName: string;
  gitBranch: string;
  fileTree: FileNode;
  searchableFiles: Array<{ path: string; content: string }>;
  gitChanges: GitFileChange[];
  snapshots: ShadowSnapshotItem[];
}

export interface SkillItem {
  id: string;
  name: string;
  category: 'workflow' | 'architecture' | 'quality' | 'tools';
  description: string;
  enabled: boolean;
  slashCommand?: string;
}

export interface KeybindingItem {
  id: string;
  actionName: string;
  category: 'chat' | 'editor' | 'navigation' | 'agent';
  currentKey: string;
  defaultKey: string;
}

export interface AccentColorOption {
  id: string;
  name: string;
  hex: string;
  bgSubtle: string;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataPreview?: string;
}

export interface RuleItem {
  id: string;
  title: string;
  scope: 'global' | 'project';
  content: string;
  enabled: boolean;
  priority: number;
}

export interface ModelRoleRouting {
  planModelId: string;
  actModelId: string;
  inlineModelId: string;
  fallbackModelId: string;
}

export interface GatewayModelItem {
  id: string;
  name: string;
  enabled: boolean;
  contextLimit: number;
}

export interface GatewayChannel {
  id: string;
  name: string;
  protocol: 'openai' | 'anthropic' | 'ollama';
  baseUrl: string;
  apiKey: string;
  status: 'healthy' | 'error' | 'untested';
  latencyMs: number;
  models: GatewayModelItem[];
}

export type ChannelType =
  | 1   // OpenAI
  | 3   // Azure
  | 4   // Ollama
  | 8   // Custom
  | 14  // Anthropic
  | 16  // Zhipu
  | 17  // Ali
  | 20  // OpenRouter
  | 24  // Gemini
  | 25  // Moonshot
  | 33  // AWS Bedrock
  | 35  // MiniMax
  | 40  // SiliconFlow
  | 43  // DeepSeek
  | 48  // xAI
  | 60  // OpenCode
  | 61; // New API / One API

export interface ChannelPresetMeta {
  type: ChannelType;
  name: string;
  icon: string;
  defaultBaseUrl: string;
  defaultTestModel: string;
  recommendedModels: string[];
  docUrl?: string;
  description: string;
}

export interface ChannelItem {
  id: string;                            // Unique channel identifier
  name: string;                          // Human-readable channel name
  type: ChannelType;                     // Channel type (constant/channel.go)
  key: string;                           // API key (supports multi-key separated by newline)
  baseUrl: string;                       // Upstream base URL
  defaultBaseUrl: string;                // Default base URL for this channel type
  models: string[];                      // Whitelist models enabled on this channel
  modelMapping?: Record<string, string>; // Model alias mapping, e.g. {"gpt-4": "claude-3-7-sonnet"}
  status: 'active' | 'disabled' | 'error' | 'untested';
  responseTime: number;                  // Latency in ms from last probe
  testTime?: number;                     // Timestamp of last probe
  testModel?: string;                    // Model used for connectivity probe
  priority: number;                      // Routing priority (higher = first)
  weight: number;                        // Load balance weight
  group: string;                         // Routing group
  headerOverride?: Record<string, string>;
  paramOverride?: Record<string, any>;
  remark?: string;
}

export type ProviderCategory = 'all' | 'domestic' | 'international' | 'aggregator' | 'local';

export interface ModelItem {
  id: string;
  name: string;
  enabled: boolean;
  contextLimit: number;
  capabilities: string[];
  outputLimit?: number;
  endpointPath?: string;
  adapter?: 'openai-responses' | 'anthropic-messages' | 'google-generative-language' | 'openai-compatible-chat';
  protocol?: 'responses' | 'anthropic_messages' | 'google_native' | 'chat_completions';
  description?: string;
}

export interface ModelProviderItem {
  id: string;
  name: string;
  icon: string;
  category: 'domestic' | 'international' | 'aggregator' | 'local';
  enabled: boolean;
  protocol: 'openai' | 'anthropic' | 'ollama';
  baseUrl: string;
  defaultBaseUrl: string;
  apiKey: string;
  status: 'healthy' | 'error' | 'untested';
  latencyMs: number;
  docUrl?: string;
  models: ModelItem[];
}

export interface McpToolItem {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface McpServerItem {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  endpoint: string;
  status: 'running' | 'stopped' | 'error';
  latencyMs: number;
  toolsCount: number;
  tools: McpToolItem[];
}

export interface OpenedEditorFile {
  id: string;
  path: string;
  name: string;
  language: string;
  isDirty?: boolean;
  isModified?: boolean;
  content?: string;
  astStatus?: string;
}

export type ThemeMode = 'paper-warm' | 'cyberpunk-dark' | 'clean-white';

export interface ThemeConfig {
  mode: ThemeMode;
  fontSize: number; // 12, 13, 14, 15, 16
  fontFamily: 'JetBrains Mono' | 'Fira Code' | 'PingFang SC' | 'Geist Mono';
  accentColor: string;
}

export interface SystemSafetyConfig {
  dataDesensitization: boolean; // 是否自动脱敏 API Key 与邮箱等 PII 数据
  gitShadowAutoSnapshot: boolean; // 是否在每次 AI 发起操作前自动打影子快照
  astDepthLevel: 'shallow' | 'standard' | 'deep'; // AST 符号索引解析深度
  maxConcurrentTasks: number; // 并发多 Agent 任务最大数
  localPersistence: boolean; // 是否本地 SQLite 持久化
}

export interface WorkModeMetadata {
  id: WorkMode;
  name: string;
  label: string;
  icon: string;
  description: string;
  badge: string;
  tokenSavingRate: string;
}

export interface MentionContextItem {
  id: string;
  type: 'file' | 'symbol' | 'git-diff' | 'terminal';
  name: string;
  path?: string;
  detail: string;
  snippet?: string;
}

export interface ChangesetFileItem {
  path: string;
  name: string;
  additions: number;
  deletions: number;
  status: 'modified' | 'added' | 'deleted';
  astVerified: boolean;
}

export interface ChangesetReviewPayload {
  id: string;
  taskId: string;
  description: string;
  totalAdditions: number;
  totalDeletions: number;
  files: ChangesetFileItem[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface PinnedFileItem {
  id: string;
  path: string;
  name: string;
  size: number;
}

export interface TokenRoiStats {
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheHitRatePercent: number;
  estimatedCostUsd: number;
  savedCostUsd: number;
  linesGeneratedApprox: number;
}

export type CommandSecurityLevel = 'safe' | 'warning' | 'blocked';

export interface CommandSafetyResult {
  level: CommandSecurityLevel;
  reason?: string;
  command: string;
}

export interface SwarmPipelineStage {
  id: string;
  role: 'architect' | 'coder' | 'tester';
  name: string;
  model: string;
  task: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

export interface RepoGraphNode {
  id: string;
  name: string;
  type: 'interface' | 'class' | 'function' | 'module';
  file: string;
  dependencies: string[];
}

export interface ResizableLayoutState {
  leftPanelWidth: number;
  workbenchWidth: number;
  terminalHeightPercent: number;
}

export interface LessonRuleItem {
  id: string;
  category: 'architecture' | 'safety' | 'style' | 'performance';
  title: string;
  ruleContent: string;
  source: 'user_correction' | 'manual' | 'ci_failure';
  appliedCount: number;
  createdAt: number;
}

export interface PreFlightCiReport {
  status: 'passed' | 'failed' | 'running';
  tsErrorsCount: number;
  eslintWarningsCount: number;
  lineCoverage: number;
  lineCoverageDelta: number;
  branchCoverage: number;
  durationMs: number;
  allowPush: boolean;
}

export interface SemanticCommitItem {
  id: string;
  type: 'feat' | 'fix' | 'test' | 'refactor' | 'chore' | 'docs';
  scope: string;
  message: string;
  files: string[];
}

export interface DebugProbeItem {
  id: string;
  fileId: string;
  line: number;
  variableName: string;
  capturedValue: string;
  status: 'active' | 'cleared';
}

export interface BlastRadiusItem {
  packagePath: string;
  impactedSymbolsCount: number;
  severity: 'low' | 'medium' | 'high';
}

export interface BlastRadiusReport {
  sourcePackage: string;
  impactedDownstream: BlastRadiusItem[];
  totalAffectedCallsites: number;
}

export interface DiffNavigationTarget {
  fileId: string;
  filePath: string;
  targetLine: number;
  highlightToken: string;
}

export interface WorkbenchIconAction {
  id: 'blast-radius' | 'preflight-ci' | 'inline-refactor' | 'shadow-snapshot';
  icon: string;
  label: string;
  tooltipTitle: string;
  tooltipDesc: string;
  badgeText?: string;
}

export interface PullRequestDraftPayload {
  branchName: string;
  targetBranch: string;
  title: string;
  motivation: string;
  decisionLog: string;
  changedFilesCount: number;
  ciPassProof: {
    typescript: string;
    lint: string;
    coverage: string;
  };
}

export interface ManagedRule {
  id: string;
  title: string;
  description: string;
  category: 'iron_law' | 'lesson' | 'team_rule' | 'global';
  scope: 'global' | 'project' | 'session';
  sourceFile: string;
  enabled: boolean;
  priority: number;
  readonly?: boolean;
  updatedAt?: number;
  version?: number;
}

export type RulesMemoryItem = ManagedRule;

export type RoutingStrategyId = 'auto' | 'max_reasoning' | 'lightning_fast' | 'cost_saver';

export interface ModelRoutingStrategy {
  id: RoutingStrategyId;
  name: string;
  desc: string;
  icon: string;
  defaultModelId: string;
}

export interface TrajectoryStepSnapshot {
  stepIndex: number;
  totalSteps: number;
  title: string;
  status: 'completed' | 'in_progress' | 'pending';
  timestamp: string;
  summary: string;
  snapshotFileCount: number;
}

export interface ArchitectureTopologyNode {
  id: string;
  name: string;
  type: 'package' | 'service' | 'module' | 'database';
  status: 'healthy' | 'impacted' | 'modified';
  dependencies: string[];
  impactCount?: number;
}

export interface ThinkingBlockPayload {
  thinkingText: string;
  contentText: string;
  isThinkingFinished: boolean;
  durationSeconds: number;
  tokensCount: number;
}

export interface ParsedToolCall {
  id: string;
  name: string;
  parameters: Record<string, string>;
  raw: string;
}

export interface ParsedAgentMessage {
  thinkingText: string;
  toolCalls: ParsedToolCall[];
  cleanContent: string;
}

export interface PatchChunk {
  oldStart: number;
  oldLines: string[];
  newLines: string[];
}

export interface PatchApplyResult {
  success: boolean;
  patchedContent: string;
  appliedChunksCount: number;
  syntaxValid: boolean;
  errorMessage?: string;
}

export type SwarmRoleType = 'planner' | 'coder' | 'verifier' | 'scribe';

export interface SwarmAgentState {
  role: SwarmRoleType;
  name: string;
  model: string;
  status: 'idle' | 'running' | 'completed' | 'blocked';
  progress: number;
  outputSummary?: string;
}

export interface RedactionResult {
  redactedText: string;
  redactedSecretsCount: number;
  secretMap: Record<string, string>;
}

export interface SandboxSafetyCheckResult {
  isSafe: boolean;
  command: string;
  hazardReason?: string;
  requiresSudo: boolean;
}

export interface ShadowSnapshotMeta {
  snapshotId: string;
  refPath: string;
  createdAt: number;
  filesChangedCount: number;
  label: string;
}

export interface MentionSearchResultItem {
  id: string;
  type: 'file' | 'symbol' | 'diff' | 'doc';
  name: string;
  detail: string;
  score: number;
}

export type DesktopPlatformType = 'windows' | 'macos' | 'linux';
export type DesktopArchType = 'x86_64' | 'aarch64' | 'universal';

export interface DesktopPlatformConfig {
  platform: DesktopPlatformType;
  arch: DesktopArchType;
  bundleFormats: string[];
  nativeEngine: string;
  isSandboxed: boolean;
}

export interface SlashCommandItem {
  id: string;
  command: string;
  name: string;
  description: string;
  icon: string;
  promptTemplate: string;
}

export interface DeveloperProfile {
  name: string;
  avatar: string;
  roleTitle: string;
}

export interface KVCacheMetrics {
  prefixTokens: number;
  historyTokens: number;
  turnCacheHitTokens: number;
  totalCacheHitTokens: number;
  savedCostYuan: number;
  savingsPercentage: number;
  latencySpeedup: string;
}
