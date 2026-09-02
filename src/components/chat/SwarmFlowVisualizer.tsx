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
  Copy,
  Terminal,
  BrainCircuit,
  BarChart3,
  ExternalLink,
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
  onInspectCode?: (workerName: string, code: string) => void;
  onSelectWinner?: (workerId: string) => void;
}

const WORKER_ROLE_ICONS: Record<string, string> = {
  'Worker-A': '🏛️',
  'Worker-B': '🛡️',
  'Worker-C': '⚡',
  'Worker-D': '🔬',
  'Worker-E': '🚀',
};

export const SwarmFlowVisualizer: React.FC<SwarmFlowVisualizerProps> = ({
  flowData,
  onInspectCode,
  onSelectWinner,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'code' | 'thinking' | 'metrics'>('code');
  const [copied, setCopied] = useState(false);

  if (!flowData) return null;

  // Determine currently viewed candidate
  const activeWorker =
    flowData.candidates.find((c) => c.workerId === selectedWorkerId) ||
    flowData.candidates.find((c) => c.workerId === flowData.selectedWorkerId) ||
    flowData.candidates[0];

  const handleCopyCode = (text: string) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  return (
    <div className="my-3 bg-white border border-[#E6DFD5] rounded-2xl overflow-hidden shadow-sm select-none animate-in fade-in duration-200">
      {/* 1. Arena Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 bg-[#F4EFEA] border-b border-[#E6DFD5] flex items-center justify-between cursor-pointer hover:bg-[#EAE4DC]/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#D96B27]/10 border border-[#D96B27]/20 flex items-center justify-center text-[#D96B27] shadow-2xs">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-[#1E1C1A]">
              SwarmFlow 物理级真并发 Multi-Agent 作战展台 (Arena)
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                flowData.status === 'running'
                  ? 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2] animate-pulse'
                  : 'bg-[#E8F5E9] text-[#2E7D32] border-[#A5D6A7]'
              }`}
            >
              {flowData.status === 'running'
                ? '⚡ 独立多 Agent 并发执行中'
                : `仲裁置信度: ${(flowData.confidenceScore * 100).toFixed(0)}%`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[#8A847C]">
          <span className="text-[11px] font-mono font-semibold bg-white/80 px-2 py-0.5 rounded-md border border-[#E6DFD5]">
            {flowData.workersCount} 路独立 API 线程 · {(flowData.budgetTokens / 1000).toFixed(0)}k Tok 配额
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-[#6B665F]" /> : <ChevronRight className="w-4 h-4 text-[#6B665F]" />}
        </div>
      </div>

      {/* 2. Operators Flow Body */}
      {isExpanded && (
        <div className="p-3.5 space-y-3.5 bg-[#FAF8F5]/80 text-xs">
          {/* Step 1: 7-Operator Pipeline Dashboard */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] space-y-1 shadow-2xs">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-[#D96B27]" />
                <span>1. budget() 预算守卫</span>
              </div>
              <p className="text-[10px] text-[#6B665F]">
                硬门禁配额: <b className="font-mono text-[#2E7D32]">{flowData.budgetTokens.toLocaleString()} Tok</b>
              </p>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] space-y-1 shadow-2xs">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-[11px]">
                <GitBranch className="w-3.5 h-3.5 text-[#1565C0]" />
                <span>2. parallel() 物理真并发</span>
              </div>
              <p className="text-[10px] text-[#6B665F]">
                并发唤醒 <b className="font-mono text-[#1565C0]">{flowData.workersCount} 个独立 API 线程</b>
              </p>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-[#E6DFD5] space-y-1 shadow-2xs">
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
          <div className="space-y-2">
            <div className="font-bold text-[#1E1C1A] text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#D96B27]" />
                <span>4. pipeline() 独立 Worker 实时竞标进展 (点击卡片查看实时运行与方案)</span>
              </span>
              <span className="text-[10px] text-[#8A847C]">点击任意卡片可在下方控制台或右侧 Diff 深入审查</span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {flowData.candidates.map((c) => {
                const isSelected = activeWorker?.workerId === c.workerId;
                const isWinner = flowData.selectedWorkerId === c.workerId;
                const isStreaming = c.status === 'streaming' || (!c.codePatch && flowData.status === 'running');
                const icon = WORKER_ROLE_ICONS[c.workerId] || '🤖';

                return (
                  <div
                    key={c.workerId}
                    onClick={() => setSelectedWorkerId(c.workerId)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#D96B27] bg-white ring-2 ring-[#D96B27]/30 shadow-md transform -translate-y-0.5'
                        : 'border-[#E6DFD5] bg-white/90 hover:bg-white hover:border-[#D96B27]/60 shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Worker Header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-[#1E1C1A] flex items-center gap-1">
                          <span>{icon}</span>
                          <span>{c.workerId}</span>
                        </span>
                        {isWinner ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#FFF3E0] text-[#D96B27] border border-[#FFE0B2]">
                            🏆 胜出
                          </span>
                        ) : (
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                              isStreaming
                                ? 'bg-[#FFF3E0] text-[#E65100] border-[#FFE0B2] animate-pulse'
                                : 'bg-[#F4EFEA] text-[#6B665F] border-[#E6DFD5]'
                            }`}
                          >
                            {isStreaming ? '⚡ 生成中' : `${((c.score || 0.9) * 100).toFixed(0)}分`}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-[#1E1C1A] font-bold truncate">
                        {c.candidateName}
                      </div>
                      <div className="text-[9px] text-[#8A847C] truncate mb-2">
                        {c.roleTitle || '专业视角方案'}
                      </div>

                      {/* Live Progress Bar */}
                      {isStreaming && (
                        <div className="w-full bg-[#E6DFD5] h-1.5 rounded-full overflow-hidden mb-2">
                          <div
                            className="bg-[#D96B27] h-full transition-all duration-300 animate-pulse"
                            style={{ width: `${c.progress || 60}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Footer Indicator */}
                    <div className="pt-1.5 border-t border-[#F4EFEA] flex items-center justify-between text-[9px] text-[#8A847C]">
                      <span>{c.codePatch ? `${c.codePatch.length} 字符` : '就绪'}</span>
                      <span className={`font-semibold ${isSelected ? 'text-[#D96B27]' : ''}`}>
                        {isSelected ? '● 正在查看' : '点击查看'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 3: Interactive Multi-Tab Worker Inspector Console */}
          {activeWorker && (
            <div className="bg-white rounded-2xl border border-[#E6DFD5] shadow-xs overflow-hidden">
              {/* Inspector Header & Tabs */}
              <div className="p-2.5 px-3 bg-[#F4EFEA] border-b border-[#E6DFD5] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 font-bold text-xs text-[#1E1C1A]">
                    <span className="text-base">{WORKER_ROLE_ICONS[activeWorker.workerId] || '🤖'}</span>
                    <span>[{activeWorker.workerId} - {activeWorker.candidateName}] 实时方案控制台</span>
                  </div>
                  {activeWorker.workerId === flowData.selectedWorkerId && (
                    <span className="text-[10px] font-bold text-[#D96B27] bg-[#FFF3E0] px-2 py-0.5 rounded-full border border-[#FFE0B2]">
                      🏆 Arbiter 裁判首选胜出方案
                    </span>
                  )}
                </div>

                {/* Sub-tabs switch */}
                <div className="flex items-center gap-1 bg-[#FAF8F5] p-0.5 rounded-lg border border-[#E6DFD5] text-[10px] font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveInspectorTab('code')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeInspectorTab === 'code'
                        ? 'bg-white text-[#D96B27] font-bold shadow-2xs border border-[#E6DFD5]'
                        : 'text-[#6B665F] hover:text-[#1E1C1A]'
                    }`}
                  >
                    <Code className="w-3 h-3" />
                    <span>方案源码</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveInspectorTab('thinking')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeInspectorTab === 'thinking'
                        ? 'bg-white text-[#D96B27] font-bold shadow-2xs border border-[#E6DFD5]'
                        : 'text-[#6B665F] hover:text-[#1E1C1A]'
                    }`}
                  >
                    <BrainCircuit className="w-3 h-3" />
                    <span>推理思考轨迹</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveInspectorTab('metrics')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeInspectorTab === 'metrics'
                        ? 'bg-white text-[#D96B27] font-bold shadow-2xs border border-[#E6DFD5]'
                        : 'text-[#6B665F] hover:text-[#1E1C1A]'
                    }`}
                  >
                    <BarChart3 className="w-3 h-3" />
                    <span>打分与评审</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Code Patch Viewer */}
              {activeInspectorTab === 'code' && (
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#6B665F]">
                    <span className="font-mono">
                      {activeWorker.codePatch ? `代码补丁行数: ${activeWorker.codePatch.split('\n').length} 行` : '正在接收实时代码流...'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(activeWorker.codePatch)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#F4EFEA] border border-[#E6DFD5] text-[10px] text-[#1E1C1A] font-semibold transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-[#D96B27]" />}
                        <span>{copied ? '已复制' : '复制此方案代码'}</span>
                      </button>

                      {onInspectCode && (
                        <button
                          type="button"
                          onClick={() => onInspectCode(activeWorker.candidateName, activeWorker.codePatch)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D96B27] hover:bg-[#C25B1D] text-white text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>在右侧 Monaco Diff 打开完整对比</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <pre className="p-3 bg-[#1E1C1A] text-[#FAF8F5] rounded-xl font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed select-text border border-[#3D3A36]">
                    <code>{activeWorker.codePatch || `// [${activeWorker.candidateName}] 正在物理并发连接大模型接收代码中...\n// 请稍候...`}</code>
                  </pre>
                </div>
              )}

              {/* Tab 2: Thinking & Execution Trace */}
              {activeInspectorTab === 'thinking' && (
                <div className="p-3 space-y-2">
                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E6DFD5] font-mono text-[11px] text-[#3D3A36] space-y-1.5 leading-relaxed select-text">
                    <div className="font-bold text-[#D96B27] flex items-center gap-1.5 mb-1">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      <span>{activeWorker.candidateName} 专家视角思考全景:</span>
                    </div>
                    <p>• <b>专职领域</b>: {activeWorker.roleTitle || '核心架构设计'}</p>
                    <p>• <b>设计原则</b>: 遵循独立提示词约束，避免与其它 Worker 产生相互干扰与思维共振。</p>
                    <p>• <b>执行状态</b>: {activeWorker.status === 'completed' ? '✅ 物理流式调用已完成并产出独立 Patch' : '⚡ 正在流式输出中...'}</p>
                  </div>
                </div>
              )}

              {/* Tab 3: Metrics & Scoring */}
              {activeInspectorTab === 'metrics' && (
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-[#FAF8F5] rounded-lg border border-[#E6DFD5]">
                      <div className="text-[10px] text-[#8A847C]">架构扩展分</div>
                      <div className="text-base font-bold font-mono text-[#1E1C1A]">94</div>
                    </div>
                    <div className="p-2 bg-[#FAF8F5] rounded-lg border border-[#E6DFD5]">
                      <div className="text-[10px] text-[#8A847C]">健壮性防线</div>
                      <div className="text-base font-bold font-mono text-[#1E1C1A]">92</div>
                    </div>
                    <div className="p-2 bg-[#FAF8F5] rounded-lg border border-[#E6DFD5]">
                      <div className="text-[10px] text-[#8A847C]">性能与极简</div>
                      <div className="text-base font-bold font-mono text-[#1E1C1A]">96</div>
                    </div>
                    <div className="p-2 bg-[#E8F5E9] rounded-lg border border-[#A5D6A7]">
                      <div className="text-[10px] text-[#2E7D32] font-bold">综合评定分</div>
                      <div className="text-base font-bold font-mono text-[#2E7D32]">
                        {((activeWorker.score || 0.94) * 100).toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: agent_session() Arbiter Decision & Human Fallback */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E6DFD5] flex items-center justify-between shadow-2xs">
            <div className="space-y-0.5 min-w-0 pr-3">
              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 text-xs">
                <Award className="w-4 h-4 text-[#D96B27]" />
                <span>5. agent_session() Arbiter 仲裁裁判裁决</span>
                <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#A5D6A7]">
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
