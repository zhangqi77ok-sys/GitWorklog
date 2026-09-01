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
} from 'lucide-react';

export interface SwarmFlowState {
  taskPrompt: string;
  budgetTokens: number;
  workersCount: number;
  status: 'idle' | 'running' | 'completed';
  candidates: {
    workerId: string;
    candidateName: string;
    codePatch: string;
    score: number;
  }[];
  selectedWorkerId: string;
  confidenceScore: number;
  humanReviewed: boolean;
  rationale: string;
}

interface SwarmFlowVisualizerProps {
  flowData?: SwarmFlowState;
  onInspectCode?: (code: string) => void;
}

export const SwarmFlowVisualizer: React.FC<SwarmFlowVisualizerProps> = ({
  flowData,
  onInspectCode,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!flowData) return null;

  return (
    <div className="my-3 bg-white border border-[#E6DFD5] rounded-xl overflow-hidden shadow-xs select-none">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 bg-[#F4EFEA] border-b border-[#E6DFD5] flex items-center justify-between cursor-pointer hover:bg-[#EAE4DC]/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27]">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-xs text-[#1E1C1A]">
            SwarmFlow 多智能体协同编排流 (Swarm Flow Mode)
          </span>
          <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-full text-[10px] font-mono font-bold">
            置信度: {(flowData.confidenceScore * 100).toFixed(0)}%
          </span>
        </div>

        <div className="flex items-center gap-2 text-[#8A847C]">
          <span className="text-[11px] font-mono">
            {flowData.workersCount} Workers 并行
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {/* Operators Flow Body */}
      {isExpanded && (
        <div className="p-3.5 space-y-3 bg-[#FAF8F5]/60 text-xs">
          {/* Step 1: budget() & parallel() */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] space-y-1">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-[#D96B27]" />
                <span>1. budget() 预算检查</span>
              </div>
              <p className="text-[10px] text-[#6B665F]">
                可用预算: <b className="font-mono text-[#2E7D32]">{flowData.budgetTokens.toLocaleString()} Tok</b>
              </p>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] space-y-1">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-[11px]">
                <GitBranch className="w-3.5 h-3.5 text-[#1565C0]" />
                <span>2. parallel() 栅栏同步</span>
              </div>
              <p className="text-[10px] text-[#6B665F]">
                并发派发 <b className="font-mono text-[#1565C0]">{flowData.workersCount} 个 Worker</b> 生产候选
              </p>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] space-y-1">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-[11px]">
                <Filter className="w-3.5 h-3.5 text-[#7B1FA2]" />
                <span>3. compact() 过滤空结果</span>
              </div>
              <p className="text-[10px] text-[#6B665F]">
                保留有效候选: <b className="font-mono text-[#7B1FA2]">{flowData.candidates.length} / {flowData.workersCount}</b>
              </p>
            </div>
          </div>

          {/* Step 2: pipeline() & Candidates List */}
          <div className="space-y-1.5">
            <div className="font-bold text-[#1E1C1A] text-[11px] flex items-center justify-between">
              <span>4. pipeline() 流式复核候选集</span>
              <span className="text-[10px] text-[#8A847C]">各分支独立评审语法、测试与安全</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {flowData.candidates.map((c) => {
                const isSelected = c.workerId === flowData.selectedWorkerId;
                return (
                  <div
                    key={c.workerId}
                    className={`p-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-[#D96B27] bg-white ring-2 ring-[#D96B27]/20 shadow-xs'
                        : 'border-[#E6DFD5] bg-white/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#1E1C1A]">{c.workerId}</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          isSelected
                            ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]'
                            : 'bg-[#F4EFEA] text-[#6B665F]'
                        }`}
                      >
                        评分: {(c.score * 100).toFixed(0)}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8A847C] font-mono truncate mb-2">
                      {c.candidateName}
                    </div>

                    {onInspectCode && (
                      <button
                        onClick={() => onInspectCode(c.codePatch)}
                        className="w-full flex items-center justify-center gap-1 py-1 rounded bg-[#FAF8F5] hover:bg-[#F4EFEA] border border-[#E6DFD5] text-[10px] text-[#3D3A36] font-medium transition-colors cursor-pointer"
                      >
                        <Code className="w-3 h-3 text-[#D96B27]" />
                        <span>查看该分支代码</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 3: agent_session() Arbiter & human() Fallback */}
          <div className="p-3 bg-white rounded-lg border border-[#E6DFD5] flex items-center justify-between">
            <div className="space-y-0.5 min-w-0 pr-3">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-xs">
                <Award className="w-4 h-4 text-[#D96B27]" />
                <span>5. agent_session() 有状态仲裁者决选</span>
                <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.2 rounded-full border border-[#A5D6A7]">
                  最优: {flowData.selectedWorkerId}
                </span>
              </div>
              <p className="text-[11px] text-[#6B665F] truncate">{flowData.rationale}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {flowData.confidenceScore >= 0.8 ? (
                <span className="flex items-center gap-1 text-[11px] text-[#2E7D32] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>置信度高 (自动放行)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-[#E65100] font-bold">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>触发 human() 人工兜底</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
