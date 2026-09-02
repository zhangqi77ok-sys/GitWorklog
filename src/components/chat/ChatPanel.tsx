import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  ChevronDown,
  ChevronRight,
  SplitSquareVertical,
  BrainCircuit,
  Trash2,
  Paperclip,
  Zap,
  Check,
  Settings,
  Code2,
  Copy,
  Plus,
  Square,
  Cpu,
  Layers,
  CheckCircle2,
  FileCode,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useProjectSessionStore } from '../../store/useProjectSessionStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useGatewayStore } from '../../store/useGatewayStore';
import { SessionTabBar } from './SessionTabBar';
import { PromptQueueBar, QueuedPrompt } from './PromptQueueBar';
import { SubtaskProgressCard } from './SubtaskProgressCard';
import { SwarmFlowVisualizer, SwarmFlowState } from './SwarmFlowVisualizer';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingBlock } from './ThinkingBlock';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ResizableMessageBubble } from './ResizableMessageBubble';
import { sanitizeTextContent } from '../../services/tauriBridge';
import { toast } from '../common/Toast';
import type { Subtask, ExecutionMode } from '../../types';

interface ChatPanelProps {
  onOpenSettings?: () => void;
  isEditorOpen?: boolean;
  onToggleEditor?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  onOpenSettings,
  isEditorOpen = false,
  onToggleEditor,
}) => {
  const {
    projects,
    activeProjectId,
    activeSessionId,
    openSessionIds,
    loadInitialData,
    updateSession,
    createSession,
  } = useProjectSessionStore();

  const { openDiffTab, activeTabPath } = useWorkspaceStore();
  const { channels, activeChannelId, activeModelId, setActiveModel } = useGatewayStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingThought, setStreamingThought] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Prompt Queue State (Auto-drained, Reorderable, Editable, Preemptible)
  const [promptQueue, setPromptQueue] = useState<QueuedPrompt[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_prompt_queue');
        return saved ? JSON.parse(saved) : [];
      }
    } catch (e) {}
    return [];
  });

  const promptQueueRef = useRef<QueuedPrompt[]>(promptQueue);
  useEffect(() => {
    promptQueueRef.current = promptQueue;
    try {
      localStorage.setItem('tcode_prompt_queue', JSON.stringify(promptQueue));
    } catch (e) {}
  }, [promptQueue]);

  const [collapsedThoughts, setCollapsedThoughts] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_collapsed_thoughts');
        return saved ? JSON.parse(saved) : {};
      }
    } catch (e) {}
    return {};
  });

  const handleCopyMessage = (id: string, text: string) => {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        setCopiedMessageId(id);
        toast.success('已复制对话内容');
        setTimeout(() => setCopiedMessageId(null), 2000);
      }
    } catch (e) {
      toast.error('复制失败');
    }
  };

  const [executionMode, setExecutionMode] = useState<ExecutionMode>('coding');

  const [swarmBudgetTokens, setSwarmBudgetTokens] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tcode_swarm_budget');
      return saved ? parseInt(saved, 10) : 25000;
    }
    return 25000;
  });

  const [swarmWorkersCount, setSwarmWorkersCount] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_swarm_workers');
        return saved ? parseInt(saved, 10) : 3;
      }
    } catch (e) {}
    return 3;
  });

  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_swarm_confidence');
        return saved ? parseFloat(saved) : 0.8;
      }
    } catch (e) {}
    return 0.8;
  });

  const [swarmFlowData, setSwarmFlowData] = useState<SwarmFlowState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [inputHeight, setInputHeight] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_chat_input_height');
        if (saved) {
          const val = parseInt(saved, 10);
          return val > 120 ? 90 : Math.max(val, 76);
        }
        return 90;
      }
    } catch (e) {}
    return 90;
  });
  const [isDraggingInput, setIsDraggingInput] = useState(false);
  const isDraggingInputRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(90);

  const handleInputResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingInputRef.current = true;
    setIsDraggingInput(true);
    startYRef.current = e.clientY;
    startHeightRef.current = inputHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingInputRef.current) return;
      const deltaY = startYRef.current - moveEvent.clientY;
      const newHeight = Math.min(Math.max(startHeightRef.current + deltaY, 76), 400);
      setInputHeight(newHeight);
    };

    const onMouseUp = () => {
      isDraggingInputRef.current = false;
      setIsDraggingInput(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem('tcode_chat_input_height', String(inputHeight));
      } catch (e) {}
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const [isBottomDropdownOpen, setIsBottomDropdownOpen] = useState(false);
  const bottomDropdownRef = useRef<HTMLDivElement>(null);

  const handleModeChange = (mode: ExecutionMode) => {
    setExecutionMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tcode_execution_mode', mode);
    }
  };

  const handleBudgetChange = (tokens: number) => {
    setSwarmBudgetTokens(tokens);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tcode_swarm_budget', String(tokens));
    }
  };

  const handleWorkersCountChange = (count: number) => {
    setSwarmWorkersCount(count);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tcode_swarm_workers', String(count));
    }
    toast.success(`已配置 Swarm 并发 Worker 数: ${count} 路并行`);
  };

  const handleConfidenceThresholdChange = (threshold: number) => {
    setConfidenceThreshold(threshold);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tcode_swarm_confidence', String(threshold));
    }
  };

  // Global hotkeys: Alt+1 for Coding Loop, Alt+2 for SwarmFlow
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        handleModeChange('coding');
        toast.info('已切换至: ⚡ 极速双环 (Coding Loop)');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        handleModeChange('swarm');
        toast.info('已切换至: ✨ SwarmFlow 算子编排流');
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeSession = activeProject?.sessions?.find((s) => s.id === activeSessionId);
  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const availableModels: string[] =
    activeChannel?.models && activeChannel.models.length > 0
      ? activeChannel.models
      : ['deepseek-v4-flash', 'claude-3-7-sonnet', 'gpt-4o'];

  const activeFileName = activeTabPath
    ? activeTabPath.split(/[/\\]/).pop() || activeTabPath
    : null;

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (bottomDropdownRef.current && !bottomDropdownRef.current.contains(e.target as Node)) {
        setIsBottomDropdownOpen(false);
      }
    };
    if (isBottomDropdownOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isBottomDropdownOpen]);

  const handleSelectModel = (model: string) => {
    setActiveModel(model);
    if (activeSession) {
      updateSession(activeSession.id, undefined, undefined, undefined, model);
    }
    setIsBottomDropdownOpen(false);
    toast.success(`已切换生效模型: ${model}`);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, streamingContent, streamingThought]);

  const handleStopGeneration = async () => {
    try {
      await invoke('cancel_chat_prompt', { sessionId: activeSessionId });
      setIsStreaming(false);
      setStreamingThought('');
      setStreamingContent('');
      toast.info('已中断当前生成');
      await loadInitialData();
    } catch (e) {
      console.error('Stop stream error:', e);
    }
  };

  const executePromptNow = async (
    promptText: string,
    modelOverride?: string,
    modeOverride?: ExecutionMode,
    budgetOverride?: number
  ) => {
    if (!promptText.trim() || !activeSessionId) return;

    setIsStreaming(true);
    setStreamingThought('');
    setStreamingContent('');

    const workspaceDir = activeProject?.path || 'E:\\pro\\agent-learning';
    const execMode = modeOverride || executionMode;
    const budget = budgetOverride || swarmBudgetTokens;
    const targetModel = modelOverride || activeModelId;

    if (execMode === 'swarm') {
      setSwarmFlowData({
        taskPrompt: promptText,
        budgetTokens: budget,
        workersCount: swarmWorkersCount,
        status: 'running',
        candidates: [],
        selectedWorkerId: '',
        confidenceScore: 0,
        humanReviewed: false,
        rationale: `正在启动 SwarmFlow 7 算子流并行多视角分析与仲裁 (${swarmWorkersCount} 路竞标 · 门禁 ${(confidenceThreshold * 100).toFixed(0)}%)...`,
      });
    } else {
      setSwarmFlowData(null);
    }

    try {
      await invoke('stream_chat_prompt', {
        sessionId: activeSessionId,
        workspaceDir,
        prompt: promptText,
        model: targetModel,
        executionMode: execMode,
        budgetTokens: budget,
        workersCount: swarmWorkersCount,
        confidenceThreshold,
      });
    } catch (err: any) {
      setIsStreaming(false);
      toast.error(`发送失败: ${err}`);
    }
  };

  // Listen to Tauri streaming events
  useEffect(() => {
    let unlistenThought: () => void = () => {};
    let unlistenText: () => void = () => {};
    let unlistenDone: () => void = () => {};
    let unlistenError: () => void = () => {};
    let unlistenSwarmState: () => void = () => {};
    let unlistenSwarmWorker: () => void = () => {};

    const setupListeners = async () => {
      unlistenThought = await listen<any>('agent_thought_chunk', (event) => {
        if (event.payload.session_id === activeSessionId) {
          setStreamingThought((prev) => prev + event.payload.chunk);
        }
      });

      unlistenText = await listen<any>('agent_text_chunk', (event) => {
        if (event.payload.session_id === activeSessionId) {
          setStreamingContent((prev) => prev + event.payload.chunk);
        }
      });

      unlistenSwarmState = await listen<any>('swarm_flow_state_update', (event) => {
        if (event.payload.session_id === activeSessionId) {
          setSwarmFlowData((prev) => ({
            taskPrompt: event.payload.taskPrompt || prev?.taskPrompt || '',
            budgetTokens: event.payload.budgetTokens || prev?.budgetTokens || 25000,
            workersCount: event.payload.workersCount || prev?.workersCount || 3,
            status: event.payload.status || 'running',
            candidates: event.payload.candidates || prev?.candidates || [],
            selectedWorkerId: event.payload.selectedWorkerId || prev?.selectedWorkerId || '',
            confidenceScore: event.payload.confidenceScore ?? prev?.confidenceScore ?? 0,
            humanReviewed: event.payload.humanReviewed ?? false,
            rationale: event.payload.rationale || prev?.rationale || '',
          }));
        }
      });

      unlistenSwarmWorker = await listen<any>('swarm_worker_chunk', (event) => {
        if (event.payload.session_id === activeSessionId) {
          setSwarmFlowData((prev) => {
            if (!prev) return null;
            const updated = prev.candidates.map((c) => {
              if (c.workerId === event.payload.workerId) {
                return {
                  ...c,
                  codePatch: (c.codePatch || '') + event.payload.chunk,
                  progress: event.payload.progress || c.progress || 50,
                  status: 'streaming' as const,
                };
              }
              return c;
            });
            return {
              ...prev,
              candidates: updated,
            };
          });
        }
      });

      unlistenDone = await listen<any>('agent_stream_done', async (event) => {
        if (event.payload.session_id === activeSessionId) {
          setIsStreaming(false);
          setStreamingThought('');
          setStreamingContent('');
          await loadInitialData();

          // Auto-drain next queue item if available!
          if (promptQueueRef.current.length > 0) {
            const next = promptQueueRef.current[0];
            setPromptQueue((prev) => prev.slice(1));
            setTimeout(() => {
              executePromptNow(next.text, next.modelId, next.executionMode, next.budgetTokens);
            }, 300);
          }
        }
      });

      unlistenError = await listen<any>('agent_stream_error', (event) => {
        if (event.payload.session_id === activeSessionId) {
          setIsStreaming(false);
          toast.error(`生成异常: ${event.payload.error}`);
        }
      });
    };

    setupListeners();

    return () => {
      unlistenThought();
      unlistenText();
      unlistenDone();
      unlistenError();
      unlistenSwarmState();
      unlistenSwarmWorker();
    };
  }, [activeSessionId, loadInitialData]);

  const handleSend = async () => {
    if (!inputPrompt.trim() || !activeSessionId) return;
    const promptText = inputPrompt.trim();

    if (isStreaming) {
      // If currently generating, queue the message!
      const newItem: QueuedPrompt = {
        id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: promptText,
        createdAt: Date.now(),
        modelId: activeModelId,
        executionMode,
        budgetTokens: swarmBudgetTokens,
      };
      setPromptQueue((prev) => [...prev, newItem]);
      setInputPrompt('');
      toast.info(`已加入待发送队列 (第 ${promptQueue.length + 1} 位)`);
      return;
    }

    setInputPrompt('');
    await executePromptNow(promptText);
  };

  const handleDeleteQueueItem = (id: string) => {
    setPromptQueue((prev) => prev.filter((item) => item.id !== id));
    toast.success('已从队列中移除');
  };

  const handleEditQueueItem = (id: string, newText: string) => {
    setPromptQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, text: newText } : item))
    );
    toast.success('队列内容已修改');
  };

  const handleMoveUpQueueItem = (index: number) => {
    if (index <= 0) return;
    setPromptQueue((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveDownQueueItem = (index: number) => {
    setPromptQueue((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handlePreemptSend = async (id: string) => {
    const item = promptQueue.find((q) => q.id === id);
    if (!item) return;

    // 1. Remove from queue
    setPromptQueue((prev) => prev.filter((q) => q.id !== id));

    // 2. Interrupt current stream
    if (isStreaming) {
      await handleStopGeneration();
    }

    // 3. Execute immediately
    setTimeout(() => {
      executePromptNow(item.text, item.modelId, item.executionMode, item.budgetTokens);
    }, 200);

    toast.success('已插队并立即启动执行');
  };

  const handleClearAllQueue = () => {
    setPromptQueue([]);
    toast.info('已清空待发送队列');
  };

  const toggleThoughtCollapse = (msgId: string) => {
    setCollapsedThoughts((prev) => {
      const next = {
        ...prev,
        [msgId]: !prev[msgId],
      };
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('tcode_collapsed_thoughts', JSON.stringify(next));
        }
      } catch (e) {}
      return next;
    });
  };

  const handleOpenDiffFromCode = (codeBlock: string) => {
    const targetFile =
      activeTabPath && !activeTabPath.startsWith('diff:')
        ? activeTabPath
        : `${activeProject?.path || 'E:\\pro\\agent-learning'}\\src\\App.tsx`;

    openDiffTab(targetFile, '// 原始文件代码', codeBlock);
    if (!isEditorOpen && onToggleEditor) {
      onToggleEditor();
    }
  };

  const handleCreateNewSession = async () => {
    if (activeProjectId) {
      return await createSession(activeProjectId);
    }
  };

  const handleQuickAction = async (promptText: string) => {
    if (!activeSession && activeProjectId) {
      await createSession(activeProjectId);
    }
    setInputPrompt(promptText);
  };

  return (
    <div className="flex-1 h-full bg-[#FAF9F6] flex flex-col overflow-hidden">
      {/* 1. Multi-Session Tab Bar Header */}
      <SessionTabBar
        isEditorOpen={isEditorOpen}
        onToggleEditor={onToggleEditor}
      />

      {/* 2. Messages Stream List */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-10">
        {!activeSession || (activeSession.messages.length === 0 && !isStreaming) ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-2xl mx-auto select-none animate-in fade-in duration-300">
            {/* OpenAI / Studio Minimal Emblem */}
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#18181B] to-[#3F3F46] text-white flex items-center justify-center font-bold text-lg shadow-sm mb-3">
              T
            </div>

            <h2 className="text-base font-semibold text-[#18181B] tracking-tight mb-1">
              Tcode Studio
            </h2>
            <p className="text-xs text-[#71717A] max-w-sm mb-6 leading-relaxed">
              基于 Rust 双环轨道的自主式编程工作台。选择下方快捷能力或在底栏输入指令：
            </p>

            {/* 4 Interactive Quick-Action Suggestion Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
              <button
                type="button"
                onClick={() => handleQuickAction("请审查当前项目的目录结构与整体技术架构，分析分层职责并给出系统性架构演进建议。")}
                className="group flex flex-col p-3 rounded-xl bg-white hover:bg-black/[0.02] border border-black/[0.08] hover:border-[#D96B27]/40 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-md bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27]">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-xs text-[#18181B] group-hover:text-[#D96B27] transition-colors">
                    审查项目架构
                  </span>
                </div>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  全景扫描技术栈、分层结构与架构演进建议
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction("请针对当前项目运行并检查所有测试用例，扫描代码质量与边界异常处理，给出改进报告。")}
                className="group flex flex-col p-3 rounded-xl bg-white hover:bg-black/[0.02] border border-black/[0.08] hover:border-[#10A37F]/40 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-md bg-[#10A37F]/10 flex items-center justify-center text-[#10A37F]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-xs text-[#18181B] group-hover:text-[#10A37F] transition-colors">
                    单测与缺陷诊断
                  </span>
                </div>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  检测单元测试覆盖率并排查潜在异常隐患
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction("请对活跃代码进行审查与重构，应用现代 React 19 最佳实践并确保代码整洁。")}
                className="group flex flex-col p-3 rounded-xl bg-white hover:bg-black/[0.02] border border-black/[0.08] hover:border-[#F59E0B]/40 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-md bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B]">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-xs text-[#18181B] group-hover:text-[#F59E0B] transition-colors">
                    极速双环重构
                  </span>
                </div>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  基于现代前端规范与 Clean Code 清理坏味道
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction("请生成当前工程的核心文件导览索引，说明主要入口、状态层与服务层调用关系。")}
                className="group flex flex-col p-3 rounded-xl bg-white hover:bg-black/[0.02] border border-black/[0.08] hover:border-[#3B82F6]/40 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-md bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6]">
                    <FileCode className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-xs text-[#18181B] group-hover:text-[#3B82F6] transition-colors">
                    工程文件导览
                  </span>
                </div>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  梳理项目关键配置、数据流与模块依赖关系
                </p>
              </button>
            </div>
          </div>
        ) : (
          activeSession.messages.map((msg) => (
            <div
              key={msg.id}
              className={`group/msg flex flex-col ${
                msg.role === 'user'
                  ? 'items-end self-end max-w-[65%]'
                  : 'items-start self-start w-full'
              } space-y-2`}
            >
              {/* Role label */}
              <div className="flex items-center gap-1.5 text-[11px] text-[#71717A] px-0.5 select-none">
                {msg.role === 'user' ? (
                  <>
                    <span className="font-medium text-[#18181B]">You</span>
                    <span className="opacity-60 text-[10px]">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-3.5 h-3.5 rounded bg-[#18181B] flex items-center justify-center text-white text-[8px] font-bold">
                      T
                    </div>
                    <span className="font-semibold text-[#18181B] text-xs">Tcode Agent</span>
                    <span className="opacity-60 text-[10px]">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </>
                )}
              </div>

              {/* 1. Collapsible Deep Thinking Block */}
              {msg.thought && (
                <ThinkingBlock thinking={msg.thought} defaultExpanded={false} />
              )}

              {/* 2. Subtask DAG / Progress Card */}
              {msg.dag && (
                <div className="w-full">
                  <SubtaskProgressCard subtasks={msg.dag?.subtasks || (Array.isArray(msg.dag) ? msg.dag : [])} />
                </div>
              )}

              {/* 3. Tool Execution Card */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="w-full">
                  <ToolCallCard toolCalls={msg.toolCalls} />
                </div>
              )}

              {/* 4. Main Answer Bubble */}
              {(() => {
                const cleanText = sanitizeTextContent(msg.content || '');
                if (!cleanText && msg.role === 'assistant') return null;
                return (
                  <ResizableMessageBubble
                    msgId={msg.id}
                    role={msg.role}
                    cleanText={cleanText}
                    rawContent={msg.content || ''}
                    onCopy={() => handleCopyMessage(msg.id, cleanText)}
                    isCopied={copiedMessageId === msg.id}
                    onOpenDiff={() => handleOpenDiffFromCode(msg.content)}
                  />
                );
              })()}
            </div>
          ))
        )}

        {/* Live Streaming Indicator & Partial Message */}
        {isStreaming && (
          <div className="flex flex-col items-start self-start w-full space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-[#8A847C] px-0.5 select-none">
              <Bot className="w-3 h-3 text-[#D96B27] animate-pulse" />
              <span className="font-semibold text-[#D96B27]">Tcode Agent</span>
              <span className="opacity-60">正在生成...</span>
            </div>

            {streamingThought && (
              <ThinkingBlock thinking={streamingThought} defaultExpanded={true} />
            )}

            {(() => {
              const cleanStreaming = sanitizeTextContent(streamingContent || '');

              if (!cleanStreaming) return null;

              return (
                <ResizableMessageBubble
                  msgId="streaming-partial"
                  role="assistant"
                  cleanText={cleanStreaming}
                  rawContent={streamingContent || ''}
                  onCopy={() => handleCopyMessage('streaming-partial', cleanStreaming)}
                  isCopied={copiedMessageId === 'streaming-partial'}
                  onOpenDiff={() => handleOpenDiffFromCode(streamingContent)}
                />
              );
            })()}
          </div>
        )}

        {/* Swarm Flow Visualization Overlay */}
        {swarmFlowData && (
          <div className="my-3">
            <SwarmFlowVisualizer
              flowData={swarmFlowData}
              onInspectCode={(workerName, code) => {
                if (onToggleEditor && !isEditorOpen) {
                  onToggleEditor();
                }
                const tabName = `[SwarmFlow] ${workerName}.ts`;
                openDiffTab(
                  tabName,
                  '// 当前代码基线 (Original Baseline)\n\n// 尚未应用此 Worker 分支方案',
                  code
                );
                toast.success(`已在右侧 Diff 工作台载入 [${workerName}] 方案代码`);
              }}
              onSelectWinner={(workerId) => {
                setSwarmFlowData((prev) => (prev ? { ...prev, selectedWorkerId: workerId } : null));
                toast.success(`已人工指定选用 [${workerId}] 方案`);
              }}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 对话区上下拖拽分割条 (Draggable Vertical Splitter for Chat)   */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 对话区上下拖拽分割条 (Draggable Vertical Splitter for Chat)   */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div
        onMouseDown={handleInputResizeStart}
        className={`h-1.5 w-full cursor-row-resize z-30 flex items-center justify-center select-none transition-colors border-t border-[#E8E5DF] flex-shrink-0 group ${
          isDraggingInput ? 'bg-[#D96B27]' : 'bg-[#F4F2EE] hover:bg-[#D96B27]/40'
        }`}
        title="上下拖动调节对话区与输入框高度"
      >
        <div className="w-10 h-0.5 rounded-full bg-[#71717A]/40 group-hover:bg-[#D96B27] transition-colors" />
      </div>

      {/* 3. Chat Input Box & Prompt Queue Container */}
      <div
        style={{ height: `${inputHeight}px` }}
        className="bg-[#F4F2EE] flex flex-col flex-shrink-0 relative transition-[height] duration-75 z-20"
      >
        <div className="p-1.5 px-2 flex-1 flex flex-col space-y-1 relative">
          {/* Reorderable & Preemptible Prompt Queue Bar */}
          <PromptQueueBar
            queue={promptQueue}
            onDelete={handleDeleteQueueItem}
            onEdit={handleEditQueueItem}
            onMoveUp={handleMoveUpQueueItem}
            onMoveDown={handleMoveDownQueueItem}
            onPreemptSend={handlePreemptSend}
            onClearAll={handleClearAllQueue}
            isStreaming={isStreaming}
          />

          <div className="bg-white border border-black/[0.08] focus-within:border-[#D96B27] focus-within:ring-1 focus-within:ring-[#D96B27]/10 rounded-xl p-2 px-2.5 shadow-2xs transition-all flex-1 flex flex-col justify-between relative">
            {activeFileName && (
              <div className="flex items-center gap-1 text-[9px] text-[#52525B] bg-black/[0.03] px-1.5 py-0.5 rounded border border-black/[0.06] w-fit select-none mb-0.5">
                <Paperclip className="w-2.5 h-2.5 text-[#D96B27]" />
                <span>已引用:</span>
                <span className="font-mono font-medium text-[#18181B]">{activeFileName}</span>
              </div>
            )}

            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && isStreaming) {
                  e.preventDefault();
                  handleStopGeneration();
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入代码需求、架构设计或任务指令 (Enter 发送, Shift+Enter 换行)..."
              className="w-full flex-1 resize-none outline-none text-xs text-[#18181B] placeholder-[#71717A] leading-normal bg-transparent select-text overflow-y-auto min-h-[28px]"
            />

            <div className="flex items-center justify-between pt-1.5 border-t border-black/[0.05] relative z-30">
              {/* Left group: Model Selector & Workspace Context */}
              <div className="flex items-center gap-2 select-none">
                {/* Bottom Model Selector Layered Capsule Button & Upward Popover */}
                <div className="relative" ref={bottomDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsBottomDropdownOpen(!isBottomDropdownOpen)}
                    className={`flex items-center gap-1.5 px-3 h-7 rounded-full bg-gradient-to-b from-white to-[#F7F6F2] hover:to-white text-[#18181B] text-xs font-mono transition-all cursor-pointer border border-black/[0.12] hover:border-black/[0.22] shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:scale-[0.98] ${
                      isBottomDropdownOpen ? 'ring-2 ring-black/[0.1] border-black/[0.25]' : ''
                    }`}
                    title="选择当前会话大模型"
                  >
                    <Cpu className="w-3 h-3 text-[#D96B27]" />
                    <span className="max-w-[130px] truncate">{activeModelId}</span>
                    <ChevronDown
                      className={`w-2.5 h-2.5 text-[#71717A] transition-transform duration-150 ml-0.5 ${
                        isBottomDropdownOpen ? 'rotate-180 text-[#18181B]' : ''
                      }`}
                    />
                  </button>

                  {/* Upward Model Selector Popover */}
                  {isBottomDropdownOpen && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-64 bg-[#FAF9F6] border border-black/[0.08] rounded-2xl shadow-xl p-1.5 z-50 select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-black/[0.05] mb-1">
                        <span className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">
                          选择运行模型
                        </span>
                        <span className="text-[10px] text-[#71717A] font-mono">
                          {availableModels.length} 个可用
                        </span>
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-0.5">
                        {availableModels.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleSelectModel(m)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer text-left transition-colors ${
                              activeModelId === m
                                ? 'bg-white text-[#D96B27] font-semibold shadow-2xs border border-black/[0.06]'
                                : 'text-[#18181B] hover:bg-black/[0.03]'
                            }`}
                          >
                            <span className="font-mono truncate">{m}</span>
                            {activeModelId === m && <Check className="w-3.5 h-3.5 text-[#D96B27] flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Stop or Send */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="flex items-center gap-1 px-3 py-1 bg-[#FFF0F0] hover:bg-[#FFE5E5] border border-[#FFCDD2] text-[#D32F2F] rounded-lg text-xs font-semibold cursor-pointer animate-pulse"
                  title="中断生成 (Esc)"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>停止生成</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputPrompt.trim() || !activeSessionId}
                  className="flex items-center gap-1 px-3.5 py-1 bg-[#D96B27] hover:bg-[#B8551B] disabled:bg-[#EAE4DC] text-white disabled:text-[#71717A] rounded-lg text-xs font-semibold shadow-2xs disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
                  title="发送指令 (Enter)"
                >
                  <Send className="w-3 h-3" />
                  <span>发送</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
