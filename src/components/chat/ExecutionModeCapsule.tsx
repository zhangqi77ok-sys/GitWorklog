import React, { useState, useRef, useEffect } from 'react';
import { Zap, Sparkles, Sliders, ChevronDown, Check, X, Shield, Cpu, Gauge } from 'lucide-react';
import type { ExecutionMode } from '../../types';

interface ExecutionModeCapsuleProps {
  mode: ExecutionMode;
  onModeChange: (mode: ExecutionMode) => void;
  swarmBudgetTokens: number;
  onBudgetChange?: (budget: number) => void;
  swarmWorkersCount?: number;
  onWorkersCountChange?: (count: number) => void;
  confidenceThreshold?: number;
  onConfidenceThresholdChange?: (threshold: number) => void;
}

interface PresetTier {
  name: string;
  desc: string;
  tokens: number;
  workers: number;
  icon: string;
}

const PRESET_TIERS: PresetTier[] = [
  { name: '轻量快速', desc: '小型模块与单点函数微调', tokens: 15000, workers: 2, icon: '⚡' },
  { name: '标准推荐', desc: '架构/测试/性能 3视角竞标', tokens: 25000, workers: 3, icon: '🎯' },
  { name: '深度攻坚', desc: '跨模块复杂重构与单测套件', tokens: 50000, workers: 4, icon: '🔬' },
  { name: '极致推演', desc: '全系统级方案推演与多路PK', tokens: 100000, workers: 5, icon: '🚀' },
];

export const ExecutionModeCapsule: React.FC<ExecutionModeCapsuleProps> = ({
  mode,
  onModeChange,
  swarmBudgetTokens,
  onBudgetChange,
  swarmWorkersCount = 3,
  onWorkersCountChange,
  confidenceThreshold = 0.8,
  onConfidenceThresholdChange,
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click or Esc
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPopoverOpen) {
        setIsPopoverOpen(false);
      }
    };

    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopoverOpen]);

  const handleSelectPreset = (tier: PresetTier) => {
    onBudgetChange?.(tier.tokens);
    onWorkersCountChange?.(tier.workers);
  };

  return (
    <div className="flex items-center gap-2 relative" ref={popoverRef}>
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
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
            mode === 'coding'
              ? 'bg-white text-[#1E1C1A] font-bold shadow-2xs border border-[#E6DFD5]'
              : 'text-[#6B665F] hover:text-[#1E1C1A]'
          }`}
        >
          <Zap className={`w-3 h-3 ${mode === 'coding' ? 'text-[#D96B27]' : 'text-[#8A847C]'}`} />
          <span>极速双环</span>
        </button>

        {/* State 2: Multi-Agent Swarm Flow */}
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'swarm'}
          onClick={() => onModeChange('swarm')}
          title="✨ 多智能体 7 算子并行竞标与仲裁编排 (Alt+2)"
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
            mode === 'swarm'
              ? 'bg-[#D96B27] text-white font-bold shadow-2xs'
              : 'text-[#6B665F] hover:text-[#1E1C1A]'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>SwarmFlow</span>
        </button>
      </div>

      {/* 2. Interactive Swarm Budget & Concurrency Telemetry & Config Button */}
      {mode === 'swarm' && (
        <button
          type="button"
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          title="点击配置 SwarmFlow 算力配额、并发 Worker 数与仲裁门禁"
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer border shadow-2xs ${
            isPopoverOpen
              ? 'bg-white text-[#D96B27] border-[#D96B27] ring-1 ring-[#D96B27]/20 font-bold'
              : 'bg-[#FAF8F5] hover:bg-white text-[#6B665F] hover:text-[#1E1C1A] border-[#E6DFD5] hover:border-[#D96B27]/50'
          }`}
        >
          <Sliders className="w-3 h-3 text-[#D96B27]" />
          <span>{(swarmBudgetTokens / 1000).toFixed(0)}k · {swarmWorkersCount}W 竞标</span>
          <ChevronDown
            className={`w-2.5 h-2.5 text-[#8A847C] transition-transform duration-150 ${
              isPopoverOpen ? 'rotate-180 text-[#D96B27]' : ''
            }`}
          />
        </button>
      )}

      {/* 3. Upward Configuration Popover Panel */}
      {mode === 'swarm' && isPopoverOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-84 bg-white border border-[#E6DFD5] rounded-2xl shadow-2xl z-50 p-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#F4EFEA]">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27]">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-[#1E1C1A] text-xs">
                SwarmFlow 算力配额与并发编排
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPopoverOpen(false)}
              className="p-1 text-[#8A847C] hover:text-[#1E1C1A] rounded-md hover:bg-[#FAF8F5] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-2.5 space-y-3">
            {/* Presets Grid */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8A847C] uppercase tracking-wider flex items-center justify-between">
                <span>⚡ 常用策略预设 (一键联动)</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                {PRESET_TIERS.map((tier) => {
                  const isMatch =
                    swarmBudgetTokens === tier.tokens && swarmWorkersCount === tier.workers;
                  return (
                    <button
                      key={tier.name}
                      type="button"
                      onClick={() => handleSelectPreset(tier)}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                        isMatch
                          ? 'bg-[#FAF8F5] border-[#D96B27] ring-1 ring-[#D96B27]/20 shadow-xs'
                          : 'bg-white hover:bg-[#FAF8F5]/80 border-[#E6DFD5] hover:border-[#D96B27]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#1E1C1A] flex items-center gap-1">
                          <span>{tier.icon}</span>
                          <span>{tier.name}</span>
                        </span>
                        {isMatch && <Check className="w-3 h-3 text-[#D96B27]" />}
                      </div>
                      <div className="text-[10px] text-[#8A847C] font-mono mt-1">
                        {(tier.tokens / 1000).toFixed(0)}k Tok · {tier.workers} Workers
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider 1: Token Budget Limit */}
            <div className="space-y-1 pt-1 border-t border-[#F4EFEA]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1E1C1A] flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-[#D96B27]" />
                  <span>Token 预算上限 (Budget)</span>
                </span>
                <span className="font-mono font-bold text-[#D96B27] bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#E6DFD5]">
                  {(swarmBudgetTokens / 1000).toFixed(0)}k Tok ({swarmBudgetTokens.toLocaleString()})
                </span>
              </div>
              <input
                type="range"
                min={10000}
                max={100000}
                step={5000}
                value={swarmBudgetTokens}
                onChange={(e) => onBudgetChange?.(parseInt(e.target.value, 10))}
                className="w-full accent-[#D96B27] cursor-pointer h-1.5 bg-[#E6DFD5] rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-[#8A847C] font-mono">
                <span>10k (轻度)</span>
                <span>50k (深度)</span>
                <span>100k (极致)</span>
              </div>
            </div>

            {/* Selector 2: Parallel Workers Count */}
            <div className="space-y-1.5 pt-1 border-t border-[#F4EFEA]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1E1C1A] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#D96B27]" />
                  <span>并发竞标方案数 (Workers Fan-out)</span>
                </span>
                <span className="font-mono font-bold text-[#1E1C1A] text-xs">
                  {swarmWorkersCount} 个独立视角
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[2, 3, 4, 5].map((num) => {
                  const active = swarmWorkersCount === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => onWorkersCountChange?.(num)}
                      className={`py-1 text-center rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#D96B27] text-white border-[#D96B27] shadow-xs'
                          : 'bg-[#FAF8F5] text-[#6B665F] hover:text-[#1E1C1A] hover:bg-white border-[#E6DFD5]'
                      }`}
                    >
                      {num} 路并行
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#8A847C] leading-normal">
                {swarmWorkersCount === 2 && '⚡ 2 路：架构方案 vs 极简实现（快速收敛）'}
                {swarmWorkersCount === 3 && '🎯 3 路：系统架构师 · 测试安全 · 极简性能（标准推荐）'}
                {swarmWorkersCount === 4 && '🔬 4 路：架构 · 安全 · 性能 · 前瞻重构（深度攻坚）'}
                {swarmWorkersCount === 5 && '🚀 5 路：全视角极限竞标与多轮交叉仲裁（全系统级）'}
              </p>
            </div>

            {/* Slider 3: Confidence Score Gate */}
            <div className="space-y-1 pt-1 border-t border-[#F4EFEA]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#1E1C1A] flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-[#2E7D32]" />
                  <span>自动合入置信度门禁 (Gate)</span>
                </span>
                <span className="font-mono font-bold text-[#2E7D32]">
                  {(confidenceThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0.7}
                max={0.95}
                step={0.05}
                value={confidenceThreshold}
                onChange={(e) => onConfidenceThresholdChange?.(parseFloat(e.target.value))}
                className="w-full accent-[#2E7D32] cursor-pointer h-1.5 bg-[#E6DFD5] rounded-lg"
              />
              <p className="text-[10px] text-[#8A847C]">
                仲裁得分低于 <b className="font-mono">{(confidenceThreshold * 100).toFixed(0)}%</b> 时自动挂起，唤起人类工程师终审确认。
              </p>
            </div>
          </div>

          {/* Footer Close Info */}
          <div className="pt-2 border-t border-[#F4EFEA] flex items-center justify-between text-[10px] text-[#8A847C]">
            <span>✨ 设置已自动保存并即时生效</span>
            <button
              type="button"
              onClick={() => setIsPopoverOpen(false)}
              className="px-2.5 py-1 bg-[#FAF8F5] hover:bg-white border border-[#E6DFD5] hover:border-[#D96B27] text-[#1E1C1A] rounded-md font-bold transition-colors cursor-pointer"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
