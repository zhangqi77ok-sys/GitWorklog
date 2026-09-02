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
  tokens: number;
  workers: number;
}

const PRESET_TIERS: PresetTier[] = [
  { name: '轻量 15k·2W', tokens: 15000, workers: 2 },
  { name: '标准 25k·3W', tokens: 25000, workers: 3 },
  { name: '深度 50k·4W', tokens: 50000, workers: 4 },
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
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or Esc
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsModeDropdownOpen(false);
        setIsPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModeDropdownOpen(false);
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelectPreset = (tier: PresetTier) => {
    onBudgetChange?.(tier.tokens);
    onWorkersCountChange?.(tier.workers);
  };

  return (
    <div className="flex items-center gap-1.5 relative" ref={containerRef}>
      {/* 1. Single Compact Mode Selector: Defaults to Act, toggles between Act and Swarm */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsModeDropdownOpen(!isModeDropdownOpen);
            setIsPopoverOpen(false);
          }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/[0.03] hover:bg-black/[0.06] text-[#18181B] text-xs font-medium transition-colors cursor-pointer border border-black/[0.06] shadow-2xs"
          title="切换智能体执行模式 (Alt+1 / Alt+2)"
        >
          {mode === 'swarm' ? (
            <>
              <Sparkles className="w-3 h-3 text-[#D96B27]" />
              <span>Swarm</span>
            </>
          ) : (
            <>
              <Zap className="w-3 h-3 text-[#D96B27]" />
              <span>Act</span>
            </>
          )}
          <ChevronDown
            className={`w-3 h-3 text-[#71717A] transition-transform duration-150 ${
              isModeDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Upward Dropdown for Act / Swarm */}
        {isModeDropdownOpen && (
          <div className="absolute left-0 bottom-full mb-1.5 w-44 bg-[#FAF9F6] border border-black/[0.08] rounded-xl shadow-lg p-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
            <button
              type="button"
              onClick={() => {
                onModeChange('coding');
                setIsModeDropdownOpen(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                mode === 'coding'
                  ? 'bg-white text-[#18181B] font-medium shadow-2xs border border-black/[0.05]'
                  : 'text-[#52525B] hover:bg-black/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[#D96B27]" />
                <span>Act (默认)</span>
              </div>
              {mode === 'coding' && <Check className="w-3.5 h-3.5 text-[#D96B27]" />}
            </button>

            <button
              type="button"
              onClick={() => {
                onModeChange('swarm');
                setIsModeDropdownOpen(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                mode === 'swarm'
                  ? 'bg-white text-[#18181B] font-medium shadow-2xs border border-black/[0.05]'
                  : 'text-[#52525B] hover:bg-black/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#D96B27]" />
                <span>Swarm</span>
              </div>
              {mode === 'swarm' && <Check className="w-3.5 h-3.5 text-[#D96B27]" />}
            </button>
          </div>
        )}
      </div>

      {/* 2. Sleek Orchestration Button (ONLY VISIBLE IN SWARM MODE) */}
      {mode === 'swarm' && (
        <button
          type="button"
          onClick={() => {
            setIsPopoverOpen(!isPopoverOpen);
            setIsModeDropdownOpen(false);
          }}
          title="配置 Swarm 算力配额与并发参数"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
            isPopoverOpen
              ? 'bg-white text-[#D96B27] border-black/[0.12] shadow-2xs'
              : 'bg-black/[0.03] hover:bg-black/[0.06] text-[#52525B] hover:text-[#18181B] border-black/[0.06]'
          }`}
        >
          <Sliders className="w-3 h-3 text-[#D96B27]" />
          <span>{(swarmBudgetTokens / 1000).toFixed(0)}k · {swarmWorkersCount}W</span>
          <ChevronDown
            className={`w-2.5 h-2.5 text-[#71717A] transition-transform duration-150 ${
              isPopoverOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}

      {/* 3. Upward Configuration Popover Panel (Minimalist OpenAI Design) */}
      {mode === 'swarm' && isPopoverOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-76 bg-[#FAF9F6] border border-black/[0.08] rounded-xl shadow-xl z-50 p-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150 select-none">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#D96B27]" />
              <span className="font-semibold text-[#18181B] text-xs">
                SwarmFlow 编排配置
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPopoverOpen(false)}
              className="p-1 text-[#71717A] hover:text-[#18181B] rounded hover:bg-black/[0.04] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-2.5 space-y-3">
            {/* Presets */}
            <div className="space-y-1">
              <span className="text-[10px] text-[#71717A] font-medium">策略预设</span>
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                {PRESET_TIERS.map((tier) => {
                  const isMatch =
                    swarmBudgetTokens === tier.tokens && swarmWorkersCount === tier.workers;
                  return (
                    <button
                      key={tier.name}
                      type="button"
                      onClick={() => handleSelectPreset(tier)}
                      className={`px-1.5 py-1 rounded-md text-center text-[10px] font-mono border transition-all cursor-pointer ${
                        isMatch
                          ? 'bg-white text-[#D96B27] border-black/[0.12] shadow-2xs font-semibold'
                          : 'bg-white/60 hover:bg-white text-[#52525B] border-black/[0.05]'
                      }`}
                    >
                      {tier.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider 1: Token Budget Limit */}
            <div className="space-y-1 pt-1 border-t border-black/[0.05]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#52525B] flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-[#71717A]" />
                  <span>Token 预算</span>
                </span>
                <span className="font-mono text-[11px] text-[#18181B] bg-white px-1.5 py-0.5 rounded border border-black/[0.06]">
                  {(swarmBudgetTokens / 1000).toFixed(0)}k Tok
                </span>
              </div>
              <input
                type="range"
                min={10000}
                max={100000}
                step={5000}
                value={swarmBudgetTokens}
                onChange={(e) => onBudgetChange?.(parseInt(e.target.value, 10))}
                className="w-full accent-[#D96B27] cursor-pointer h-1.5 bg-black/[0.06] rounded-lg"
              />
            </div>

            {/* Selector 2: Parallel Workers Count */}
            <div className="space-y-1.5 pt-1 border-t border-black/[0.05]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#52525B] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#71717A]" />
                  <span>并发竞标分支</span>
                </span>
                <span className="font-mono text-xs text-[#18181B]">
                  {swarmWorkersCount} 路方案
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
                      className={`py-1 text-center rounded-md text-xs font-mono border transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-[#D96B27] border-black/[0.12] font-semibold shadow-2xs'
                          : 'bg-white/60 text-[#52525B] hover:bg-white border-black/[0.05]'
                      }`}
                    >
                      {num} 路
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider 3: Confidence Score Gate */}
            <div className="space-y-1 pt-1 border-t border-black/[0.05]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#52525B] flex items-center gap-1">
                  <Shield className="w-3 h-3 text-[#10A37F]" />
                  <span>合入置信门禁</span>
                </span>
                <span className="font-mono text-[11px] text-[#10A37F] bg-white px-1.5 py-0.5 rounded border border-black/[0.06]">
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
                className="w-full accent-[#10A37F] cursor-pointer h-1.5 bg-black/[0.06] rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
