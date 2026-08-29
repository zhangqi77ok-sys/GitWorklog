// CodeMind-Hub 核心接口规范契约 (SDD Contract)

export type SessionTier1Type = 'global' | 'project' | 'file';

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
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  cacheWriteTokens: number;
  estimatedCostUsd: number;
  contextCurrentTokens: number;
  contextMaxTokens: number;
}

export type ContextGaugeLevel = 'safe' | 'warning' | 'danger';

export function getContextGaugeLevel(current: number, max: number): ContextGaugeLevel {
  if (max <= 0) return 'safe';
  const ratio = current / max;
  if (ratio >= 0.8) return 'danger';
  if (ratio >= 0.6) return 'warning';
  return 'safe';
}

export function calculateTokenSavingsPercent(stats: TokenStats): number {
  const total = stats.promptTokens + stats.cacheHitTokens;
  if (total <= 0) return 0;
  return Math.round((stats.cacheHitTokens / total) * 1000) / 10;
}

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

export type WorkMode = 'plan' | 'act';

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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  optionsPayload?: AskOptionsPayload;
  taskPlan?: TaskPlan;
  auditTag?: string;
  tokensUsed?: number;
}

export type WindowBreakpoint = 'ultrawide' | 'standard' | 'laptop' | 'split_half';

export function getWindowBreakpoint(width: number): WindowBreakpoint {
  if (width >= 2000) return 'ultrawide';
  if (width >= 1400) return 'standard';
  if (width >= 1000) return 'laptop';
  return 'split_half';
}

// Session Tree Operations
export function addTagToSession(session: SessionItem, tag: string): SessionItem {
  const cleanTag = tag.trim().replace(/^#/, '');
  if (!cleanTag || session.tags.includes(cleanTag)) return session;
  return { ...session, tags: [...session.tags, cleanTag], updatedAt: Date.now() };
}

export function removeTagFromSession(session: SessionItem, tagToRemove: string): SessionItem {
  return { ...session, tags: session.tags.filter(t => t !== tagToRemove), updatedAt: Date.now() };
}

export function renameSession(session: SessionItem, newTitle: string): SessionItem {
  const cleanTitle = newTitle.trim();
  if (!cleanTitle) return session;
  return { ...session, title: cleanTitle, updatedAt: Date.now() };
}

// Project Directory Operations
export function addProjectToWorkspace(
  projects: ProjectGroup[],
  folderPath: string,
  gitBranch: string = 'main'
): { projects: ProjectGroup[]; newProject: ProjectGroup } {
  const cleanPath = folderPath.trim().replace(/\\/g, '/');
  const folderName = cleanPath.split('/').filter(Boolean).pop() || 'new-project';
  const existing = projects.find(p => p.path === cleanPath);
  if (existing) {
    return { projects, newProject: existing };
  }
  const newProject: ProjectGroup = {
    id: `proj-${Date.now()}`,
    name: folderName,
    path: cleanPath,
    gitBranch,
    isExpanded: true
  };
  return { projects: [...projects, newProject], newProject };
}

export function removeProjectFromWorkspace(projects: ProjectGroup[], projectId: string): ProjectGroup[] {
  return projects.filter(p => p.id !== projectId);
}
