import React, { useState } from 'react'
import { Download, X } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export const UsageCockpit: React.FC = () => {
  const { setActivityTab } = useWorkspaceStore()
  const [timeframe, setTimeframe] = useState<'today' | '7d' | '30d'>('today')

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F5] p-6 space-y-6 select-none animate-in fade-in duration-150">
      {/* 顶栏：标题 + 时间维度切换 + 导出与返回 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-base font-bold text-[#18181B] flex items-center gap-2">
            <span>📊</span>
            <span>模型使用情况与 Token 效能监控大盘</span>
            <span className="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-2 py-0.5 rounded-full font-mono font-medium">
              ● 生产网关已联机
            </span>
          </h2>
          <p className="text-xs text-[#71717A]">
            实时多模型吞吐计费、首字延迟 (TTFT)、Prompt 缓存节省率与调度流水
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 时间维度切换 */}
          <div className="flex items-center p-0.5 bg-black/[0.05] rounded-xl text-xs font-medium">
            <button
              onClick={() => setTimeframe('today')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                timeframe === 'today'
                  ? 'bg-white text-[#D96B27] shadow-2xs font-semibold'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              今日
            </button>
            <button
              onClick={() => setTimeframe('7d')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                timeframe === '7d'
                  ? 'bg-white text-[#D96B27] shadow-2xs font-semibold'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              近 7 天
            </button>
            <button
              onClick={() => setTimeframe('30d')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                timeframe === '30d'
                  ? 'bg-white text-[#D96B27] shadow-2xs font-semibold'
                  : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              本月
            </button>
          </div>

          <button
            onClick={() => alert('已导出 Token 审计报表')}
            className="px-3 py-1.5 rounded-lg bg-white border border-black/[0.08] shadow-2xs text-xs font-medium text-[#18181B] hover:border-[#D96B27] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download size={13} className="text-[#71717A]" />
            <span>导出报表</span>
          </button>

          <button
            onClick={() => setActivityTab('chat')}
            className="px-3 py-1.5 rounded-lg bg-[#18181B] hover:bg-[#D96B27] text-white text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <X size={13} />
            <span>关闭大盘</span>
          </button>
        </div>
      </div>

      {/* 4 大核心 KPI 指标卡片 (严格对齐原型) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: 今日 Token 总吞吐 */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.08] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#71717A]">
            <span className="font-medium">今日 Tokens 吞吐</span>
            <span className="text-[10px] text-[#10A37F] font-bold bg-[#10A37F]/10 px-1.5 py-0.5 rounded">
              ↑ 18.4%
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#18181B] tracking-tight">342,850</div>
          <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] pt-1 border-t border-black/[0.04]">
            <span>输入: 215.4k</span>
            <span>输出: 127.4k</span>
          </div>
        </div>

        {/* KPI 2: 预估累计费用 */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.08] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#71717A]">
            <span className="font-medium">预估计费支出</span>
            <span className="text-[10px] text-[#D96B27] font-bold bg-[#D96B27]/10 px-1.5 py-0.5 rounded">
              配额正常
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#D96B27] tracking-tight">
            ¥ 4.28 <span className="text-xs text-[#A1A1AA] font-normal">($0.61)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] pt-1 border-t border-black/[0.04]">
            <span>单日预算上限: ¥50.00</span>
            <span className="text-[#10A37F] font-medium">8.5% 使用率</span>
          </div>
        </div>

        {/* KPI 3: 平均首字延迟 TTFT */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.08] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#71717A]">
            <span className="font-medium">平均首字延迟 (TTFT)</span>
            <span className="text-[10px] text-[#10A37F] font-bold bg-[#10A37F]/10 px-1.5 py-0.5 rounded">
              极速
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-[#18181B] tracking-tight">
            480 <span className="text-xs text-[#A1A1AA] font-normal">ms</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] pt-1 border-t border-black/[0.04]">
            <span>DeepSeek: 420ms</span>
            <span>Claude: 1,150ms</span>
          </div>
        </div>

        {/* KPI 4: Prompt Cache 缓存节省率 */}
        <div className="p-4 rounded-2xl bg-white border border-black/[0.08] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-[#71717A]">
            <span className="font-medium">Prompt Cache 节省率</span>
            <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-1.5 py-0.5 rounded">
              深度优化
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 tracking-tight">82.4%</div>
          <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] pt-1 border-t border-black/[0.04]">
            <span>今日省下 182k Tokens</span>
            <span className="text-purple-600 font-medium">节约 ¥2.36</span>
          </div>
        </div>
      </div>

      {/* 详细厂商大模型调用明细卡片 */}
      <div className="p-5 rounded-2xl bg-white border border-black/[0.08] shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-1.5">
            <span>🤖</span>
            <span>各厂商大模型调用明细与负载占比</span>
          </h3>
          <span className="text-xs text-[#A1A1AA]">按 Tokens 消耗排序</span>
        </div>

        {/* 模型 1: DeepSeek-V4 */}
        <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-black/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#18181B]">DeepSeek-V4-Flash</span>
              <span className="text-[10px] text-[#10A37F] bg-[#10A37F]/10 px-1.5 py-0.2 rounded font-mono">
                主力日常
              </span>
            </div>
            <div className="font-mono text-xs">
              <span className="font-bold text-[#D96B27]">234,100</span>{' '}
              <span className="text-[#A1A1AA] text-[10px]">Tokens (68.3%)</span>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-black/[0.06] overflow-hidden">
            <div className="h-full bg-[#D96B27] rounded-full" style={{ width: '68.3%' }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-1">
            <span>调用 142 次 · 平均耗时 420ms</span>
            <span>
              预估费用: <strong className="text-[#18181B] font-mono">¥ 1.17</strong>
            </span>
          </div>
        </div>

        {/* 模型 2: GPT-5.6 Sol */}
        <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-black/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#18181B]">GPT-5.6-Sol</span>
              <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded font-mono">
                极速推理
              </span>
            </div>
            <div className="font-mono text-xs">
              <span className="font-bold text-[#D96B27]">86,400</span>{' '}
              <span className="text-[#A1A1AA] text-[10px]">Tokens (25.2%)</span>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-black/[0.06] overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: '25.2%' }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#71717A] pt-1">
            <span>调用 38 次 · 平均耗时 1.1s</span>
            <span>
              预估费用: <strong className="text-[#18181B] font-mono">¥ 2.59</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
