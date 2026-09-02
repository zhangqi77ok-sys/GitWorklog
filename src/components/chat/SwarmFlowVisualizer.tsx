import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Filter,
  CheckCircle,
  GitBranch,
  ShieldCheck,
  UserCheck,
  Award,
  ChevronDown,
  ChevronRight,
  Code,
  Cpu,
  Check,
  Activity,
  Maximize2,
} from 'lucide-react';

export interface SwarmCandidate {
  workerId: string;
  candidateName: string;
  roleTitle?: string;
  codePatch: string;
  score?: number;
  architectureScore?: number;
  robustnessScore?: number;
  performanceScore?: number;
  status?: 'pending' | 'streaming' | 'completed' | 'failed';
  progress?: number;
  executionTrace?: string;
}

export interface SwarmFlowState {
  taskPrompt: string;
  budgetTokens: number;
  workersCount: number;
  status: 'idle' | 'running' | 'completed';
  candidates: SwarmCandidate[];
  selectedWorkerId: string;
  confidenceScore: number;
  humanReviewed: boolean;
  rationale: string;
  isStreamingArbiter?: boolean;
}

interface SwarmFlowVisualizerProps {
  flowData?: SwarmFlowState;
  onInspectCode?: (code: string) => void;
  onSelectWinner?: (workerId: string) => void;
}

export const SwarmFlowVisualizer: React.FC<SwarmFlowVisualizerProps> = ({
  flowData,
  onInspectCode,
  onSelectWinner,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTabWorkerId, setActiveTabWorkerId] = useState<string | null>(null);

  if (!flowData) return null;

  const currentTabWorker =
    flowData.candidates.find((c) => c.workerId === activeTabWorkerId) ||
    flowData.candidates.find((c) => c.workerId === flowData.selectedWorkerId) ||
    flowData.candidates[0];

  return (
    <div className="my-3 bg-white border border-[#E6DFD5] rounded-xl overflow-hidden shadow-xs select-none animate-in fade-in duration-200">
      {/* 1. Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 bg-[#F4EFEA] border-b border-[#E6DFD5] flex items-center justify-between cursor-pointer hover:bg-[#EAE4DC]/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27]">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-xs text-[#1E1C1A]">
            SwarmFlow 物理级真并发多 Agent 竞标展台 (Arena)
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
              flowData.status === 'running'
                ? 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2] animate-pulse'
                : 'bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]'
            }`}
          >
            {flowData.status === 'running'
              ? '⚡ 多 Agent 并发生成中'
              : `置信度: ${(flowData.confidenceScore * 100).toFixed(0)}%`}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[#8A847C]">
          <span className="text-[11px] font-mono font-semibold">
            {flowData.workersCount} 路物理真并发 · {(flowData.budgetTokens / 1000).toFixed(0)}k Tok 配额
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {/* 2. Operators Flow Body */}
      {isExpanded && (
        <div className="p-3.5 space-y-3 bg-[#FAF8F5]/60 text-xs">
          {/* Step 1: 7-Operator Pipeline Dashboard */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] space-y-1">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-[#D96B27]" />
                <span>1. budget() 预算守卫</span>
              </div>
              <p className="text-[10px] text-[#6B665F]">
                硬门禁上限: <b className="font-mono text-[#2E7D32]">{flowData.budgetTokens.toLocaleString()} Tok</b>
              </p>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] space-y-1">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-[11px]">
                <GitBranch className="w-3.5 h-3.5 text-[#1565C0]" />
                <span>2. parallel() 物理并发</span>
              </div>
              <p className="text-[10px] text-[#6B665F]">
                并发唤醒 <b className="font-mono text-[#1565C0]">{flowData.workersCount} 路独立 API 线程</b>
              </p>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] space-y-1">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-[11px]">
                <Filter className="w-3.5 h-3.5 text-[#7B1FA2]" />
                <span>3. compact() 方案清洗</span>
              </div>
              <p className="text-[10px] text-[#6B665F]">
                有效候选: <b className="font-mono text-[#7B1FA2]">{flowData.candidates.filter(c => c.codePatch.length > 0).length} / {flowData.workersCount}</b>
              </p>
            </div>
          </div>

          {/* Step 2: Live Parallel Workers Cards Grid */}
          <div className="space-y-1.5">
            <div className="font-bold text-[#1E1C1A] text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#D96B27]" />
                <span>4. pipeline() 独立 Worker 实时竞标进展与打分</span>
              </span>
              <span className="text-[10px] text-[#8A847C]">每个 Worker 携带独立 System Prompt 独立生成</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {flowData.candidates.map((c) => {
                const isSelected = c.workerId === flowData.selectedWorkerId;
                const isStreaming = c.status === 'streaming' || (!c.codePatch && flowData.status === 'running');
                return (
                  <div
                    key={c.workerId}
                    className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#D96B27] bg-white ring-2 ring-[#D96B27]/20 shadow-xs'
                        : 'border-[#E6DFD5] bg-white/80 hover:border-[#D96B27]/40'
                    }`}
                  >
                    <div>
                      {/* Worker Header */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-[#1E1C1A] flex items-center gap-1">
                          <span>{c.workerId}</span>
                          {isSelected && <span className="text-[#D96B27]">🏆</span>}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            isSelected
                              ? 'bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]'
                              : isStreaming
                              ? 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2] animate-pulse'
                              : 'bg-[#F4EFEA] text-[#6B665F] border-[#E6DFD5]'
                          }`}
                        >
                          {isStreaming ? '⚡ 正在生成' : `得分: ${((c.score || 0.9) * 100).toFixed(0)}`}
                        </span>
                      </div>

                      <div className="text-[10px] text-[#3D3A36] font-semibold truncate">
                        {c.candidateName}
                      </div>
                      <div className="text-[9px] text-[#8A847C] truncate mb-2">
                        {c.roleTitle || '专业视角方案'}
                      </div>

                      {/* Live Progress Bar */}
                      {isStreaming && (
                        <div className="w-full bg-[#E6DFD5] h-1 rounded-full overflow-hidden mb-2">
                          <div
                            className="bg-[#D96B27] h-full transition-all duration-300"
                            style={{ width: `${c.progress || 60}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 pt-1 border-t border-[#F4EFEA]">
                      {onInspectCode && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTabWorkerId(c.workerId);
                            onInspectCode(c.codePatch || `// [${c.candidateName}] 正在生成中...`);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#F4EFEA] border border-[#E6DFD5] text-[10px] text-[#3D3A36] font-medium transition-colors cursor-pointer"
                          title="在右侧工作区查看此方案代码"
                        >
                          <Code className="w-3 h-3 text-[#D96B27]" />
                          <span>审查方案</span>
                        </button>
                      )}

                      {onSelectWinner && !isSelected && flowData.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => onSelectWinner(c.workerId)}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-[#FAF8F5] border border-[#E6DFD5] text-[10px] text-[#6B665F] hover:text-[#1E1C1A] transition-colors cursor-pointer"
                          title="人工指定采纳此方案"
                        >
                          <span>采纳</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 3: Candidate Code Quick Preview Panel */}
          {currentTabWorker && currentTabWorker.codePatch && (
            <div className="p-3 bg-white rounded-xl border border-[#E6DFD5] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#1E1C1A]">
                  <Code className="w-3.5 h-3.5 text-[#D96B27]" />
                  <span>
                    方案源码对比预览: [{currentTabWorker.workerId} - {currentTabWorker.candidateName}]
                  </span>
                  {currentTabWorker.workerId === flowData.selectedWorkerId && (
                    <span className="text-[10px] font-bold text-[#D96B27] bg-[#FFF3E0] px-2 py-0.2 rounded-full border border-[#FFE0B2]">
                      🏆 裁判首选胜出方案
                    </span>
                  )}
                </div>

                {onInspectCode && (
                  <button
                    type="button"
                    onClick={() => onInspectCode(currentTabWorker.codePatch)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D96B27] hover:underline cursor-pointer"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>在右侧 Monaco Diff 打开完整对比</span>
                  </button>
                )}
              </div>

              <pre className="p-2.5 bg-[#1E1C1A] text-[#FAF8F5] rounded-lg font-mono text-[10px] overflow-x-auto max-h-40 leading-relaxed">
                <code>{currentTabWorker.codePatch.slice(0, 1000)}{currentTabWorker.codePatch.length > 1000 ? '\n\n... (点击右上角查看完整代码)' : ''}</code>
              </pre>
            </div>
          )}

          {/* Step 4: agent_session() Arbiter Decision & Human Fallback */}
          <div className="p-3 bg-white rounded-xl border border-[#E6DFD5] flex items-center justify-between">
            <div className="space-y-0.5 min-w-0 pr-3">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-xs">
                <Award className="w-4 h-4 text-[#D96B27]" />
                <span>5. agent_session() Arbiter 仲裁裁判裁决</span>
                <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.2 rounded-full border border-[#A5D6A7]">
                  最终胜出: {flowData.selectedWorkerId || '评选中...'}
                </span>
              </div>
              <p className="text-[11px] text-[#6B665F] truncate leading-normal">
                {flowData.rationale || '仲裁裁判正在对各方案的架构、健壮性与性能进行交叉打分...'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {flowData.confidenceScore >= 0.8 ? (
                <span className="flex items-center gap-1 text-[11px] text-[#2E7D32] font-bold bg-[#E8F5E9] px-2.5 py-1 rounded-lg border border-[#A5D6A7]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>置信度达标 (自动合入)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-[#E65100] font-bold bg-[#FFF3E0] px-2.5 py-1 rounded-lg border border-[#FFE0B2]">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>触发 human() 人工终审</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
