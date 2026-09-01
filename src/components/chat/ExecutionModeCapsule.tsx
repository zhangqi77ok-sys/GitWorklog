import React from 'react';
import { Zap, Sparkles, Sliders } from 'lucide-react';
import type { ExecutionMode } from '../../types';

interface ExecutionModeCapsuleProps {
  mode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
  swarmBudgetTokens: number;
  onBudgetChange?: (budget: number) => void;
}

export const ExecutionModeCapsule: React.FC<ExecutionModeCapsuleProps> = ({
  mode,
  onModeChange,
  swarmBudgetTokens,
  onBudgetChange,
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* 1. Integrated Two-State Segmented Control */}
      <div
        role="radiogroup"
        aria-label="智能体执行模式"
        className="inline-flex items-center p-0.5 bg-[#FAF8F5] border border-[#E6DFD5] rounded-lg text-[10px] font-medium"
      >
        {/* State 1: Single-Agent Coding Loop */}
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'coding'}
          onClick={() => onModeChange('coding')}
          title="⚡ 单智能体内外双环极速闭环 (Alt+1)"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            mode === 'coding'
              ? 'bg-white text-[#1E1C1A] font-semibold shadow-2xs border border-[#E6DFD5]'
              : 'text-[#6B665F] hover:text-[#1E1C1A]'
          }`}
        >
          <Zap className={`w-3 h-3 ${mode === 'coding' ? 'text-[#D96B27]' : 'text-[#8A847C]'}`} />
          <span>⚡ 极速双环 (Coding)</span>
        </button>

        {/* State 2: Multi-Agent Swarm Flow */}
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'swarm'}
          onClick={() => onModeChange('swarm')}
          title="✨ 多智能体 7 算子并行竞标与仲裁编排 (Alt+2)"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
            mode === 'swarm'
              ? 'bg-[#D96B27] text-white font-bold shadow-2xs'
              : 'text-[#6B665F] hover:text-[#1E1C1A]'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>✨ SwarmFlow 算子流</span>
        </button>
      </div>

      {/* 2. Swarm Budget & Concurrency Telemetry Capsule */}
      {mode === 'swarm' && (
        <div
          title="SwarmFlow 当前动态资源与并行 Worker 配额"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF8F5] border border-[#E6DFD5] rounded-lg text-[10px] font-mono text-[#8A847C] shadow-2xs animate-fade-in"
        >
          <Sliders className="w-3 h-3 text-[#D96B27]" />
          <span>配额: {(swarmBudgetTokens / 1000).toFixed(0)}k tokens · 3 Workers 竞标</span>
        </div>
      )}
    </div>
  );
};
