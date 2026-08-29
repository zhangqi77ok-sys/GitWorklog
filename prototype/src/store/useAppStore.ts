import { useState, useCallback } from 'react';
import {
  SessionItem,
  ChatMessage,
  WorkMode,
  RoutingStrategyId,
  AIModelOption,
  AVAILABLE_MODELS,
  PermissionPolicy,
  RulesMemoryItem,
  MOCK_RULES_MEMORY,
  TrajectoryStepSnapshot,
  MOCK_TRAJECTORY_STEPS,
  ArchitectureTopologyNode,
  MOCK_TOPOLOGY_NODES,
  TokenStats,
  PreFlightCiReport,
  generatePreFlightCiReport,
  DiffNavigationTarget
} from '../types/contracts';
import { desktopBridge } from '../services/desktopBridge';

export interface AppState {
  // Navigation & Workspace
  activeNav: string;
  currentSessionId: string;
  rightWorkspaceOpen: boolean;
  workbenchWidth: number;
  isLeftCollapsed: boolean;

  // Agent Runtime & Model Strategy
  workMode: WorkMode;
  routingStrategy: RoutingStrategyId;
  currentModel: AIModelOption;
  permissionPolicy: PermissionPolicy;

  // Domain Data
  sessions: SessionItem[];
  messages: ChatMessage[];
  rules: RulesMemoryItem[];
  trajectorySteps: TrajectoryStepSnapshot[];
  topologyNodes: ArchitectureTopologyNode[];
  tokenStats: TokenStats;
  preflightCiReport: PreFlightCiReport;
  activeDiffTarget: DiffNavigationTarget | null;

  // Modals & Drawers
  isCommitModalOpen: boolean;
  isPrModalOpen: boolean;
  isSettingsOpen: boolean;
  isTokenAnalyticsOpen: boolean;
  isCiDrawerOpen: boolean;
}

const INITIAL_SESSIONS: SessionItem[] = [
  { id: 'session-1', tier1: 'global', title: 'Python 3.12 模式匹配语法讨论', messagesCount: 4, totalTokens: 5200, tags: ['docs', 'refactor'], createdAt: Date.now() - 100000, updatedAt: Date.now() },
  { id: 'session-2', tier1: 'project', projectId: 'proj-1', title: '重构三栏自适应流体布局', messagesCount: 8, totalTokens: 18500, tags: ['feat', 'ui'], createdAt: Date.now() - 50000, updatedAt: Date.now() },
  { id: 'session-3', tier1: 'project', projectId: 'proj-1', title: 'GatewayBus.ts 事件防重与重试', messagesCount: 3, totalTokens: 4200, tags: ['bug'], createdAt: Date.now() - 20000, updatedAt: Date.now() },
  { id: 'session-4', tier1: 'project', projectId: 'proj-2', title: 'Python AST 语法治具规范定义', messagesCount: 2, totalTokens: 3100, tags: ['test'], createdAt: Date.now() - 10000, updatedAt: Date.now() }
];

const INITIAL_STATS: TokenStats = {
  promptTokens: 2100,
  completionTokens: 850,
  cacheHitTokens: 18500,
  cacheWriteTokens: 400,
  estimatedCostUsd: 0.038,
  contextCurrentTokens: 21450,
  contextMaxTokens: 128000
};

export const useAppStore = () => {
  const [state, setState] = useState<AppState>({
    activeNav: 'sessions',
    currentSessionId: 'session-2',
    rightWorkspaceOpen: false,
    workbenchWidth: 560,
    isLeftCollapsed: false,
    workMode: 'act',
    routingStrategy: 'auto',
    currentModel: AVAILABLE_MODELS[0],
    permissionPolicy: 'autonomous_agent',
    sessions: INITIAL_SESSIONS,
    messages: [],
    rules: MOCK_RULES_MEMORY,
    trajectorySteps: MOCK_TRAJECTORY_STEPS,
    topologyNodes: MOCK_TOPOLOGY_NODES,
    tokenStats: INITIAL_STATS,
    preflightCiReport: generatePreFlightCiReport(true, 88.4, 85.2),
    activeDiffTarget: null,
    isCommitModalOpen: false,
    isPrModalOpen: false,
    isSettingsOpen: false,
    isTokenAnalyticsOpen: false,
    isCiDrawerOpen: false
  });

  const setActiveNav = useCallback((nav: string) => {
    setState(prev => ({ ...prev, activeNav: nav }));
  }, []);

  const setCurrentSessionId = useCallback((id: string) => {
    setState(prev => ({ ...prev, currentSessionId: id }));
  }, []);

  const setRightWorkspaceOpen = useCallback((open: boolean) => {
    setState(prev => ({ ...prev, rightWorkspaceOpen: open }));
  }, []);

  const setWorkbenchWidth = useCallback((w: number) => {
    setState(prev => ({ ...prev, workbenchWidth: w }));
  }, []);

  const setRoutingStrategy = useCallback((strategy: RoutingStrategyId) => {
    setState(prev => ({ ...prev, routingStrategy: strategy }));
  }, []);

  const setWorkMode = useCallback((mode: WorkMode) => {
    setState(prev => ({ ...prev, workMode: mode }));
  }, []);

  const toggleRule = useCallback((ruleId: string) => {
    setState(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r)
    }));
  }, []);

  const cascadeFixTopologyNode = useCallback((nodeId: string) => {
    setState(prev => ({
      ...prev,
      topologyNodes: prev.topologyNodes.map(n => n.id === nodeId ? { ...n, status: 'healthy', impactCount: 0 } : n)
    }));
  }, []);

  return {
    state,
    setActiveNav,
    setCurrentSessionId,
    setRightWorkspaceOpen,
    setWorkbenchWidth,
    setRoutingStrategy,
    setWorkMode,
    toggleRule,
    cascadeFixTopologyNode,
    desktopBridge
  };
};
