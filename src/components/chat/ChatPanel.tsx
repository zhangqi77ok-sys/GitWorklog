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
import { ExecutionModeCapsule } from './ExecutionModeCapsule';
import { ToolCallCard } from './ToolCallCard';
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

  const [executionMode, setExecutionMode] = useState<ExecutionMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tcode_execution_mode') as ExecutionMode) || 'coding';
    }
    return 'coding';
  });

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
        return saved ? parseInt(saved, 10) : 130;
      }
    } catch (e) {}
    return 130;
  });
  const [isDraggingInput, setIsDraggingInput] = useState(false);
  const isDraggingInputRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(130);

  const handleInputResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingInputRef.current = true;
    setIsDraggingInput(true);
    startYRef.current = e.clientY;
    startHeightRef.current = inputHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingInputRef.current) return;
      const deltaY = startYRef.current - moveEvent.clientY;
      const newHeight = Math.min(Math.max(startHeightRef.current + deltaY, 90), 450);
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
      await createSession(activeProjectId);
    }
  };

  return (
    <div className="flex-1 h-full bg-[#FAF8F5] flex flex-col overflow-hidden">
      {/* 1. Multi-Session Tab Bar Header */}
      <SessionTabBar
        isEditorOpen={isEditorOpen}
        onToggleEditor={onToggleEditor}
      />

      {/* 2. Messages Stream List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeSession ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="w-12 h-12 rounded-2xl bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27] mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-[#1E1C1A] mb-1">
              暂无打开的会话分支
            </h3>
            <p className="text-xs text-[#8A847C] max-w-sm mb-4">
              可从左侧项目列表点击打开已有会话分支，或点击下方按钮在当前项目中新建分支
            </p>
            {activeProjectId && (
              <button
                type="button"
                onClick={handleCreateNewSession}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>新建会话分支</span>
              </button>
            )}
          </div>
        ) : activeSession.messages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="w-10 h-10 rounded-full bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27] mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#1E1C1A] mb-1">
              {activeSession.title || '新对话分支'}
            </h3>
            <p className="text-xs text-[#8A847C] max-w-sm">
              基于 Rust Tokio Core 稳定双环轨道与全插件化能力生态。输入任何编程需求或任务指令即可启动。
            </p>
          </div>
        ) : (
          activeSession.messages.map((msg) => (
            <div
              key={msg.id}
              className={`group/msg flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              } space-y-1`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-[#8A847C] px-1 select-none">
                {msg.role === 'user' ? (
                  <>
                    <User className="w-3 h-3 text-[#1E1C1A]" />
                    <span className="font-medium text-[#1E1C1A]">You</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-[#D96B27]" />
                    <span className="font-medium text-[#D96B27]">Tcode Agent</span>
                  </>
                )}
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Collapsible Deep Thinking Block */}
              {msg.thought && (
                <div className="max-w-[85%] w-full my-1 bg-[#F4EFEA] border border-[#E6DFD5] rounded-xl overflow-hidden text-xs">
                  <div
                    onClick={() => toggleThoughtCollapse(msg.id)}
                    className="flex items-center justify-between p-2 px-3 bg-[#EAE4DC]/60 cursor-pointer hover:bg-[#EAE4DC] transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5 text-[#6B665F] font-mono text-[11px]">
                      <BrainCircuit className="w-3.5 h-3.5 text-[#D96B27]" />
                      <span className="font-semibold">深度思考推理过程</span>
                    </div>
                    {collapsedThoughts[msg.id] ? (
                      <ChevronRight className="w-3.5 h-3.5 text-[#8A847C]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[#8A847C]" />
                    )}
                  </div>
                  {!collapsedThoughts[msg.id] && (
                    <div className="p-3 font-mono text-[11px] text-[#6B665F] whitespace-pre-wrap leading-relaxed border-t border-[#E6DFD5]/50 bg-[#FAF8F5] select-text">
                      {msg.thought}
                    </div>
                  )}
                </div>
              )}

              {/* Subtask DAG / Progress Card */}
              {msg.dag && (
                <div className="max-w-[85%] w-full my-1">
                  <SubtaskProgressCard subtasks={msg.dag?.subtasks || (Array.isArray(msg.dag) ? msg.dag : [])} />
                </div>
              )}

              {/* Tool Execution Card (Image 2 Specification) */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <ToolCallCard toolCalls={msg.toolCalls} />
              )}

              {/* Main Message Bubble */}
              {(() => {
                const cleanText = sanitizeTextContent(msg.content || '');

                if (!cleanText && msg.role === 'assistant') {
                  return null;
                }

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
          <div className="flex flex-col items-start space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-[#8A847C] px-1">
              <Bot className="w-3 h-3 text-[#D96B27] animate-pulse" />
              <span className="font-medium text-[#D96B27]">Tcode Agent (正在实时生成...)</span>
            </div>

            {streamingThought && (
              <div className="max-w-[85%] w-full my-1 bg-[#F4EFEA] border border-[#E6DFD5] rounded-xl overflow-hidden text-xs">
                <div className="flex items-center gap-1.5 p-2 px-3 bg-[#EAE4DC]/60 font-mono text-[11px] text-[#6B665F]">
                  <BrainCircuit className="w-3.5 h-3.5 text-[#D96B27] animate-spin" />
                  <span className="font-semibold">正在深度思考推理...</span>
                </div>
                <div className="p-3 font-mono text-[11px] text-[#6B665F] whitespace-pre-wrap leading-relaxed border-t border-[#E6DFD5]/50 bg-[#FAF8F5]">
                  {streamingThought}
                </div>
              </div>
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
      <div
        onMouseDown={handleInputResizeStart}
        className={`h-2.5 w-full cursor-row-resize z-30 flex items-center justify-center select-none transition-colors border-t border-[#E6DFD5] flex-shrink-0 group ${
          isDraggingInput ? 'bg-[#D96B27]' : 'bg-[#F4EFEA] hover:bg-[#D96B27]/40'
        }`}
        title="上下拖动调节对话区与输入框高度"
      >
        <div className="w-12 h-1 rounded-full bg-[#8A847C]/40 group-hover:bg-[#D96B27] transition-colors" />
      </div>

      {/* 3. Chat Input Box & Prompt Queue Container */}
      <div
        style={{ height: `${inputHeight}px` }}
        className="bg-[#F4EFEA] flex flex-col flex-shrink-0 relative transition-[height] duration-75 z-20"
      >
        <div className="p-2.5 flex-1 flex flex-col space-y-1.5 relative">
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

          <div className="bg-white border border-[#E6DFD5] focus-within:border-[#D96B27] rounded-xl p-2 shadow-2xs transition-colors flex-1 flex flex-col justify-between relative">
            {activeFileName && (
              <div className="flex items-center gap-1.5 text-[10px] text-[#6B665F] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E6DFD5] w-fit select-none">
                <Paperclip className="w-3 h-3 text-[#D96B27]" />
                <span>已引用当前文件:</span>
                <span className="font-mono font-medium text-[#1E1C1A]">{activeFileName}</span>
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
              placeholder={
                isStreaming
                  ? "Agent 正在生成中... 输入指令按 Enter 可直接加入待发送队列（生成完毕后自动执行）"
                  : executionMode === 'swarm'
                  ? "输入复杂重构或多任务方案设计，将通过 SwarmFlow 7 算子流并行竞标与仲裁推进 (Alt+2)..."
                  : "输入日常编程需求或任务指令，由单 Agent 极速执行内外双环 (Enter 发送, Alt+1 切换)..."
              }
              className="w-full flex-1 resize-none outline-none text-xs text-[#1E1C1A] placeholder-[#8A847C] leading-relaxed bg-transparent select-text overflow-y-auto"
            />

            <div className="flex items-center justify-between pt-1 border-t border-[#F4EFEA] relative z-30">
              <div className="flex items-center gap-2 select-none">
                <ExecutionModeCapsule
                  mode={executionMode}
                  onModeChange={handleModeChange}
                  swarmBudgetTokens={swarmBudgetTokens}
                  onBudgetChange={handleBudgetChange}
                  swarmWorkersCount={swarmWorkersCount}
                  onWorkersCountChange={handleWorkersCountChange}
                  confidenceThreshold={confidenceThreshold}
                  onConfidenceThresholdChange={handleConfidenceThresholdChange}
                />

                {/* Bottom Model Selector Button & Upward Popover */}
                <div className="relative" ref={bottomDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsBottomDropdownOpen(!isBottomDropdownOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#F4EFEA] border border-[#E6DFD5] rounded-lg text-[11px] text-[#6B665F] hover:text-[#1E1C1A] transition-colors cursor-pointer shadow-2xs"
                  >
                    <Cpu className="w-3 h-3 text-[#D96B27]" />
                    <span className="font-mono font-medium max-w-[110px] truncate">{activeModelId}</span>
                    <ChevronDown className="w-3 h-3 text-[#8A847C]" />
                  </button>

                  {/* Upward Model Selector Popover */}
                  {isBottomDropdownOpen && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-56 bg-white border border-[#E6DFD5] rounded-xl shadow-lg p-1.5 z-50 space-y-1 select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="px-2 py-1 text-[10px] font-bold text-[#8A847C] border-b border-[#F4EFEA]">
                        选择生效模型
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {availableModels.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleSelectModel(m)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                              activeModelId === m
                                ? 'bg-[#FAF8F5] text-[#D96B27] font-semibold border border-[#E6DFD5]'
                                : 'text-[#1E1C1A] hover:bg-[#FAF8F5]'
                            }`}
                          >
                            <span className="font-mono truncate">{m}</span>
                            {activeModelId === m && <Check className="w-3.5 h-3.5 text-[#D96B27]" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Action Button (Stop or Send) */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#FFF0F0] hover:bg-[#FFE5E5] border border-[#FFCDD2] text-[#D32F2F] rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer animate-pulse"
                  title="中断生成 (Esc)"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>停止生成</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputPrompt.trim() || !activeSessionId}
                  className="flex items-center gap-1.5 px-3.5 py-1 bg-[#D96B27] hover:bg-[#B8551B] disabled:bg-[#E6DFD5] text-white disabled:text-[#8A847C] rounded-lg text-xs font-bold transition-all shadow-xs disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
                  title="发送指令 (Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
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
