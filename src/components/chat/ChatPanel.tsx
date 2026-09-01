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
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useProjectSessionStore } from '../../store/useProjectSessionStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useGatewayStore } from '../../store/useGatewayStore';
import { SubtaskProgressCard } from './SubtaskProgressCard';
import { SwarmFlowVisualizer, SwarmFlowState } from './SwarmFlowVisualizer';
import type { Subtask } from '../../types';

export const ChatPanel: React.FC = () => {
  const {
    projects,
    activeProjectId,
    activeSessionId,
    loadInitialData,
  } = useProjectSessionStore();

  const { openDiffTab, activeTabPath } = useWorkspaceStore();
  const { channels, activeChannelId } = useGatewayStore();

  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingThought, setStreamingThought] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [collapsedThoughts, setCollapsedThoughts] = useState<Record<string, boolean>>({});
  const [isSwarmMode, setIsSwarmMode] = useState(false);
  const [swarmFlowData, setSwarmFlowData] = useState<SwarmFlowState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeSession = activeProject?.sessions.find((s) => s.id === activeSessionId);
  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];

  const activeFileName = activeTabPath ? activeTabPath.split(/[/\\]/).pop() : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, streamingContent, streamingThought]);

  // Listen to Tauri streaming events
  useEffect(() => {
    const unlistenThought = listen<{ session_id: string; chunk: string }>(
      'agent_thought_chunk',
      (event) => {
        if (event.payload.session_id === activeSessionId) {
          setStreamingThought((prev) => prev + event.payload.chunk);
        }
      }
    );

    const unlistenText = listen<{ session_id: string; chunk: string }>(
      'agent_text_chunk',
      (event) => {
        if (event.payload.session_id === activeSessionId) {
          setStreamingContent((prev) => prev + event.payload.chunk);
        }
      }
    );

    const unlistenDone = listen<{
      session_id: string;
      full_content: string;
      full_thought: string;
    }>('agent_stream_done', async (event) => {
      if (event.payload.session_id === activeSessionId) {
        setIsStreaming(false);
        setStreamingContent('');
        setStreamingThought('');
        await loadInitialData();
      }
    });

    return () => {
      unlistenThought.then((f) => f());
      unlistenText.then((f) => f());
      unlistenDone.then((f) => f());
    };
  }, [activeSessionId, loadInitialData]);

  const handleSend = async () => {
    if (!inputPrompt.trim() || isStreaming || !activeSessionId) return;

    const promptText = inputPrompt.trim();
    setInputPrompt('');
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingThought('');

    const workspaceDir = activeProject?.path || 'D:\\weihu\\agent-learning';

    if (isSwarmMode) {
      try {
        const decision = await invoke<any>('run_swarm_flow_task', {
          prompt: promptText,
          budgetTokens: 25000,
        });
        if (decision) {
          setSwarmFlowData({
            taskPrompt: promptText,
            budgetTokens: 25000,
            workersCount: 3,
            status: 'completed',
            candidates: [
              {
                workerId: 'Worker-A',
                candidateName: 'Candidate_Worker-A (高内聚方案)',
                codePatch: '// Worker-A 候选实现\npub fn execute() -> bool { true }\n',
                score: 0.88,
              },
              {
                workerId: 'Worker-B',
                candidateName: 'Candidate_Worker-B (双环沙箱极致方案)',
                codePatch: decision.selected_candidate?.code_patch || '// Worker-B 候选实现\n',
                score: decision.confidence_score || 0.96,
              },
              {
                workerId: 'Worker-C',
                candidateName: 'Candidate_Worker-C (轻量快速方案)',
                codePatch: '// Worker-C 候选实现\npub fn execute() -> bool { false }\n',
                score: 0.82,
              },
            ],
            selectedWorkerId: decision.selected_candidate?.worker_id || 'Worker-B',
            confidenceScore: decision.confidence_score || 0.96,
            humanReviewed: decision.human_reviewed || false,
            rationale: decision.rationale || 'Candidate [Worker-B] chosen with highest review score 0.96',
          });
        }
      } catch (err: any) {
        alert(`Swarm Flow 调度异常: ${err}`);
      } finally {
        setIsStreaming(false);
      }
      return;
    }

    try {
      await invoke('stream_chat_prompt', {
        sessionId: activeSessionId,
        workspaceDir,
        prompt: promptText,
      });
    } catch (err: any) {
      setIsStreaming(false);
      alert(`发送失败: ${err}`);
    }
  };

  const toggleThoughtCollapse = (msgId: string) => {
    setCollapsedThoughts((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleOpenDiffFromCode = (codeBlock: string) => {
    const targetFile =
      activeTabPath && !activeTabPath.startsWith('diff:')
        ? activeTabPath
        : `${activeProject?.path || 'D:\\weihu\\agent-learning'}\\src\\App.tsx`;

    openDiffTab(targetFile, '// 原始文件代码', codeBlock);
  };

  return (
    <div className="flex-1 h-full bg-[#FAF8F5] flex flex-col overflow-hidden select-none">
      {/* 1. Chat Header */}
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
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white border border-[#E6DFD5] text-[#2E7D32] shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32]" />
            <span>{activeChannel?.name || 'DeepSeek-Reasoner (64k)'}</span>
          </div>
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
            <div key={msg.id} className="space-y-2">
              {msg.role === 'user' ? (
                /* User Bubble */
                <div className="flex items-start gap-2.5 justify-end">
                  <div className="max-w-2xl bg-white border border-[#E6DFD5] rounded-2xl rounded-tr-xs p-3 shadow-xs text-xs text-[#1E1C1A] leading-relaxed select-text">
                    {msg.content}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#3D3A36] text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                /* Assistant Bubble */
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#D96B27] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex-1 max-w-3xl space-y-2">
                    {/* Collapsible Deep Thinking Block */}
                    {msg.thought && (
                      <div className="bg-[#F4EFEA] border border-[#E6DFD5] rounded-lg overflow-hidden text-xs">
                        <button
                          onClick={() => toggleThoughtCollapse(msg.id)}
                          className="w-full px-3 py-2 flex items-center justify-between text-[#6B665F] hover:text-[#1E1C1A] transition-colors"
                        >
                          <div className="flex items-center gap-1.5 font-medium text-[11px]">
                            <BrainCircuit className="w-3.5 h-3.5 text-[#D96B27]" />
                            <span>深度思考过程 (Deep Thinking · 耗时 2.4s)</span>
                          </div>
                          {collapsedThoughts[msg.id] ? (
                            <ChevronRight className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {!collapsedThoughts[msg.id] && (
                          <div className="px-3 pb-2.5 text-[#6B665F] font-mono text-[11px] leading-relaxed border-t border-[#E6DFD5]/60 pt-2 whitespace-pre-wrap select-text">
                            {msg.thought}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Main Content & Code Blocks */}
                    <div className="bg-white border border-[#E6DFD5] rounded-2xl rounded-tl-xs p-3.5 shadow-xs text-xs text-[#1E1C1A] leading-relaxed select-text space-y-3">
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {msg.content.includes('```') && (
                        <div className="pt-2 border-t border-[#E6DFD5] flex items-center justify-between">
                          <span className="text-[11px] text-[#8A847C]">检测到生成代码补丁</span>
                          <button
                            onClick={() => {
                              const match = msg.content.match(/```(?:\w+)?\n([\s\S]*?)```/);
                              if (match && match[1]) {
                                handleOpenDiffFromCode(match[1]);
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-[#F4EFEA] hover:bg-[#D96B27] text-[#3D3A36] hover:text-white rounded text-xs font-medium transition-colors border border-[#E6DFD5]"
                          >
                            <SplitSquareVertical className="w-3.5 h-3.5" />
                            <span>在右侧开启 Diff 审查</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Live Streaming State */}
        {isStreaming && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#D96B27] text-white flex items-center justify-center flex-shrink-0 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1 max-w-3xl space-y-2">
              {streamingThought && (
                <div className="bg-[#F4EFEA] border border-[#D96B27]/40 rounded-lg p-3 text-xs font-mono text-[#6B665F] whitespace-pre-wrap leading-relaxed animate-pulse select-text">
                  <div className="flex items-center gap-1 text-[#D96B27] font-semibold text-[11px] mb-1">
                    <BrainCircuit className="w-3.5 h-3.5" />
                    <span>正在深度推理思考中...</span>
                  </div>
                  {streamingThought}
                </div>
              )}

              {streamingContent && (
                <div className="bg-white border border-[#E6DFD5] rounded-2xl rounded-tl-xs p-3.5 shadow-xs text-xs text-[#1E1C1A] leading-relaxed whitespace-pre-wrap select-text">
                  {streamingContent}
                  <span className="inline-block w-1.5 h-3 bg-[#D96B27] ml-1 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Swarm Flow Operators Execution Card */}
        {swarmFlowData && (
          <SwarmFlowVisualizer
            flowData={swarmFlowData}
            onInspectCode={(code) => handleOpenDiffFromCode(code)}
          />
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
              isSwarmMode
                ? "输入复杂重构或多任务指令，将通过 SwarmFlow (budget -> parallel -> compact -> pipeline -> arbiter) 并行推进..."
                : "输入编程需求或任务指令 (Enter 发送, Shift+Enter 换行)..."
            }
            rows={2}
            className="w-full resize-none outline-none text-xs text-[#1E1C1A] placeholder-[#8A847C] leading-relaxed bg-transparent"
          />

          <div className="flex items-center justify-between pt-1 border-t border-[#F4EFEA]">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FAF8F5] border border-[#E6DFD5] rounded text-[10px] font-medium text-[#6B665F]">
                <Zap className="w-3 h-3 text-[#D96B27]" />
                模式: ⚡ Coding
              </span>

              <button
                type="button"
                onClick={() => setIsSwarmMode(!isSwarmMode)}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  isSwarmMode
                    ? 'bg-[#D96B27] text-white shadow-xs'
                    : 'bg-[#FAF8F5] border border-[#E6DFD5] text-[#6B665F] hover:text-[#1E1C1A]'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>{isSwarmMode ? 'SwarmFlow 算子流 (已开启)' : 'SwarmFlow 算子流'}</span>
              </button>
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
