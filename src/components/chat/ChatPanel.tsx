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
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useProjectSessionStore } from '../../store/useProjectSessionStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useGatewayStore } from '../../store/useGatewayStore';
import { SubtaskProgressCard } from './SubtaskProgressCard';
import { SwarmFlowVisualizer, SwarmFlowState } from './SwarmFlowVisualizer';
import { ExecutionModeCapsule } from './ExecutionModeCapsule';
import { ToolCallCard } from './ToolCallCard';
import { MarkdownRenderer } from './MarkdownRenderer';
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
    loadInitialData,
    updateSession,
  } = useProjectSessionStore();

  const { openDiffTab, activeTabPath } = useWorkspaceStore();
  const { channels, activeChannelId, activeModelId, setActiveModel } = useGatewayStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingThought, setStreamingThought] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [collapsedThoughts, setCollapsedThoughts] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('tcode_collapsed_thoughts');
        return saved ? JSON.parse(saved) : {};
      }
    } catch (e) {}
    return {};
  });

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

  const [swarmFlowData, setSwarmFlowData] = useState<SwarmFlowState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const availableModels =
    activeChannel?.models && activeChannel.models.length > 0
      ? activeChannel.models
      : ['deepseek-v4-flash', 'gpt-5.6-sol', 'claude-opus-5', 'claude-opus-4-8', 'glm-5.3'];

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

  const activeFileName = activeTabPath ? activeTabPath.split(/[/\\]/).pop() : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, streamingContent, streamingThought]);

  // Listen to Tauri streaming events
  useEffect(() => {
    let unlistenThought: () => void = () => {};
    let unlistenText: () => void = () => {};
    let unlistenDone: () => void = () => {};
    let unlistenError: () => void = () => {};

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

      unlistenDone = await listen<any>('agent_stream_done', async (event) => {
        if (event.payload.session_id === activeSessionId) {
          setIsStreaming(false);
          setStreamingThought('');
          setStreamingContent('');
          await loadInitialData();
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
    };
  }, [activeSessionId, loadInitialData]);

  const handleSend = async () => {
    if (!inputPrompt.trim() || isStreaming || !activeSessionId) return;

    const promptText = inputPrompt.trim();
    setInputPrompt('');
    setIsStreaming(true);
    setStreamingThought('');
    setStreamingContent('');

    const workspaceDir = activeProject?.path || 'E:\\pro\\agent-learning';

    if (executionMode === 'swarm') {
      setSwarmFlowData({
        taskPrompt: promptText,
        budgetTokens: swarmBudgetTokens,
        workersCount: 3,
        status: 'running',
        candidates: [],
        selectedWorkerId: '',
        confidenceScore: 0,
        humanReviewed: false,
        rationale: '正在启动 SwarmFlow 7 算子流并行多视角分析与仲裁...',
      });
    } else {
      setSwarmFlowData(null);
    }

    try {
      await invoke('stream_chat_prompt', {
        sessionId: activeSessionId,
        workspaceDir,
        prompt: promptText,
        model: activeModelId,
        executionMode,
        budgetTokens: swarmBudgetTokens,
      });
    } catch (err: any) {
      setIsStreaming(false);
      toast.error(`发送失败: ${err}`);
    }
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

  return (
    <div className="flex-1 h-full bg-[#FAF8F5] flex flex-col overflow-hidden select-none">
      {/* 1. Chat Header (Clean & Minimalist, no redundant model dropdown) */}
      <div className="h-10 px-3 border-b border-[#E6DFD5] flex items-center justify-between bg-[#F4EFEA]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#D96B27]" />
          <span className="font-semibold text-xs text-[#1E1C1A]">
            {activeSession?.title || '新对话'}
          </span>
          <span className="text-[10px] text-[#8A847C] font-mono">
            ({activeProject?.name || '未知项目'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleEditor && (
            <button
              type="button"
              onClick={onToggleEditor}
              title={isEditorOpen ? '收起右侧代码工作区 (Alt+E)' : '弹出右侧代码工作区与 Diff 审查 (Alt+E)'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border ${
                isEditorOpen
                  ? 'bg-white text-[#D96B27] border-[#D96B27]/40 shadow-xs'
                  : 'bg-white/80 text-[#6B665F] hover:text-[#1E1C1A] hover:bg-white border-[#E6DFD5]'
              }`}
            >
              <Code2 className={`w-3.5 h-3.5 ${isEditorOpen ? 'text-[#D96B27]' : 'text-[#8A847C]'}`} />
              <span>{isEditorOpen ? '收起代码区' : '代码工作区'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Stream List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeSession || (activeSession.messages.length === 0 && !isStreaming) ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="w-10 h-10 rounded-full bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27] mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#1E1C1A] mb-1">
              Tcode Next-Gen Agentic Studio
            </h3>
            <p className="text-xs text-[#8A847C] max-w-sm">
              基于 Rust Tokio Core 稳定双环轨道与全插件化能力生态。输入任何编程需求或任务指令即可启动。
            </p>
          </div>
        ) : (
          activeSession.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              } space-y-1`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-[#8A847C] px-1">
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
                    className="flex items-center justify-between p-2 px-3 bg-[#EAE4DC]/60 cursor-pointer hover:bg-[#EAE4DC] transition-colors"
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
                    <div className="p-3 font-mono text-[11px] text-[#6B665F] whitespace-pre-wrap leading-relaxed border-t border-[#E6DFD5]/50 bg-[#FAF8F5]">
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
                const cleanText = (msg.content || '')
                  .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*tool_calls[\s\/\u007C\uFF5C\u2502\u00A6>|]*>[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*tool_calls[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
                  .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*invoke[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*invoke[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
                  .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*parameter[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*parameter[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
                  .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*tool_call[\s\/\u007C\uFF5C\u2502\u00A6]*>[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*tool_call[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
                  .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*\/?[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\S]*?>/gi, '')
                  .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*\/?[\s\/\u007C\uFF5C\u2502\u00A6]*tool_call[\s\S]*?>/gi, '')
                  .trim();

                if (!cleanText && msg.role === 'assistant') {
                  return null;
                }

                return (
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#D96B27] text-white rounded-tr-xs shadow-xs'
                        : 'bg-white border border-[#E6DFD5] text-[#1E1C1A] rounded-tl-xs shadow-xs'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{cleanText}</div>
                    ) : (
                      <MarkdownRenderer content={cleanText} />
                    )}

                    {/* Diff Viewer Button for Agent Code Patches */}
                    {msg.role === 'assistant' && msg.content.includes('```') && (
                      <div className="mt-3 pt-2.5 border-t border-[#E6DFD5] flex items-center justify-between">
                        <span className="text-[10px] text-[#8A847C] font-mono">
                          包含代码补丁变更
                        </span>
                        <button
                          onClick={() => handleOpenDiffFromCode(msg.content)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F5] border border-[#E6DFD5] hover:border-[#D96B27] text-[#D96B27] rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          <SplitSquareVertical className="w-3 h-3" />
                          <span>在编辑器中审查 Diff</span>
                        </button>
                      </div>
                    )}
                  </div>
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
              const cleanStreaming = (streamingContent || '')
                .replace(/<[\s|]*DSML[\s|]*tool_calls[\s|]*>[\s\S]*?<\/[\s|]*DSML[\s|]*tool_calls[\s|]*>/gi, '')
                .replace(/<[\s|]*DSML[\s|]*invoke[\s\S]*?<\/[\s|]*DSML[\s|]*invoke[\s|]*>/gi, '')
                .replace(/<[\s|]*DSML[\s|]*parameter[\s\S]*?<\/[\s|]*DSML[\s|]*parameter[\s|]*>/gi, '')
                .replace(/<[\s|]*tool_call[\s|]*>[\s\S]*?<\/[\s|]*tool_call[\s|]*>/gi, '')
                .replace(/<[\s|]*\/?[\s|]*DSML[\s\S]*?>/gi, '')
                .trim();

              if (!cleanStreaming) return null;

              return (
                <div className="max-w-[85%] bg-white border border-[#E6DFD5] text-[#1E1C1A] rounded-2xl rounded-tl-xs p-3.5 text-xs leading-relaxed shadow-xs">
                  <MarkdownRenderer content={cleanStreaming} />
                </div>
              );
            })()}
          </div>
        )}

        {/* Swarm Flow Visualization Overlay */}
        {swarmFlowData && (
          <div className="my-3">
            <SwarmFlowVisualizer flowData={swarmFlowData} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Chat Input Box */}
      <div className="p-3 bg-[#F4EFEA] border-t border-[#E6DFD5]">
        <div className="bg-white border border-[#E6DFD5] focus-within:border-[#D96B27] rounded-xl p-2.5 shadow-xs transition-colors space-y-2">
          {activeFileName && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B665F] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E6DFD5] w-fit">
              <Paperclip className="w-3 h-3 text-[#D96B27]" />
              <span>已引用当前文件:</span>
              <span className="font-mono font-medium text-[#1E1C1A]">{activeFileName}</span>
            </div>
          )}

          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              executionMode === 'swarm'
                ? "输入复杂重构或多任务方案设计，将通过 SwarmFlow 7 算子流并行竞标与仲裁推进 (Alt+2)..."
                : "输入日常编程需求或任务指令，由单 Agent 极速执行内外双环 (Enter 发送, Alt+1 切换)..."
            }
            rows={2}
            className="w-full resize-none outline-none text-xs text-[#1E1C1A] placeholder-[#8A847C] leading-relaxed bg-transparent"
          />

          <div className="flex items-center justify-between pt-1 border-t border-[#F4EFEA]">
            <div className="flex items-center gap-2">
              <ExecutionModeCapsule
                mode={executionMode}
                onModeChange={handleModeChange}
                swarmBudgetTokens={swarmBudgetTokens}
                onBudgetChange={handleBudgetChange}
              />

              {/* Bottom Model Selector Button & Upward Popover */}
              <div className="relative" ref={bottomDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsBottomDropdownOpen(!isBottomDropdownOpen)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#FAF8F5] hover:bg-white border border-[#E6DFD5] hover:border-[#D96B27] rounded-lg text-[10px] font-mono text-[#6B665F] hover:text-[#1E1C1A] transition-all cursor-pointer shadow-2xs group"
                  title="当前会话模型 (点击弹出模型列表切换)"
                >
                  <Bot className="w-3 h-3 text-[#D96B27]" />
                  <span className="font-semibold max-w-[120px] truncate">{activeModelId}</span>
                  <ChevronDown className={`w-2.5 h-2.5 text-[#8A847C] transition-transform duration-150 ${isBottomDropdownOpen ? 'rotate-180 text-[#D96B27]' : ''}`} />
                </button>

                {isBottomDropdownOpen && (
                  <div className="absolute left-0 bottom-full mb-1.5 w-64 bg-white border border-[#E6DFD5] rounded-xl shadow-xl z-50 p-1.5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-100">
                    <div className="px-2 py-1 text-[10px] font-bold text-[#8A847C] uppercase tracking-wider border-b border-[#F4EFEA] flex items-center justify-between">
                      <span>切换生效模型 ({availableModels.length})</span>
                      <span className="text-[#D96B27] truncate max-w-[110px]">{activeChannel?.name || '当前渠道'}</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                      {availableModels.map((m) => {
                        const isCurrent = m === activeModelId;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleSelectModel(m)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-[#FAF8F5] text-[#D96B27] font-bold border border-[#D96B27]/20'
                                : 'text-[#3D3A36] hover:bg-[#FAF8F5]'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Bot className="w-3.5 h-3.5 text-[#8A847C] flex-shrink-0" />
                              <span className="truncate font-mono text-[11px]">{m}</span>
                            </div>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-[#D96B27] flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    {onOpenSettings && (
                      <div className="pt-1 mt-1 border-t border-[#F4EFEA]">
                        <button
                          type="button"
                          onClick={() => {
                            setIsBottomDropdownOpen(false);
                            onOpenSettings();
                          }}
                          className="w-full text-left px-2.5 py-1 rounded text-[10px] text-[#8A847C] hover:text-[#D96B27] hover:bg-[#FAF8F5] transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
                        >
                          <Settings className="w-3 h-3" />
                          <span>管理 AI 模型网关与渠道...</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={!inputPrompt.trim() || isStreaming}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isStreaming ? '生成中...' : '发送'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
