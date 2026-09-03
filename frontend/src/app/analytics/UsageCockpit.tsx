import React from 'react'
import { Coins, Zap, Sparkles, TrendingUp } from 'lucide-react'

export const UsageCockpit: React.FC = () => {
  return (
    <div className="flex-1 bg-[#FAF8F5] p-6 overflow-y-auto flex flex-col gap-6 select-none">
      {/* 顶栏标题与统计时间 */}
      <div className="flex items-center justify-between border-b border-[#EADFD7] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[#2C2825]">模型使用效能与 Token 监控大盘</h2>
          <p className="text-xs text-[#7A726B] mt-0.5">全景追踪多模型 API 吞吐、延迟表现与成本节约情况</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-[#F4EFEA] text-[#2C2825] px-2.5 py-1 rounded-md border border-[#EADFD7] font-medium">
            统计周期: 今日 (24h)
          </span>
        </div>
      </div>

      {/* 四大 KPI 仪表盘 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#EADFD7] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#7A726B]">
            <span>今日 Tokens 吞吐</span>
            <Coins size={15} className="text-[#D96B27]" />
          </div>
          <div className="text-2xl font-bold text-[#2C2825] my-2">342,850</div>
          <div className="text-[11px] text-[#52D17C] flex items-center gap-1 font-medium">
            <TrendingUp size={11} /> 环比昨日 +18.4%
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EADFD7] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#7A726B]">
            <span>预估计费支出</span>
            <span className="text-[10px] bg-[#F4EFEA] text-[#7A726B] px-1.5 py-0.5 rounded font-mono">日限额 ¥50</span>
          </div>
          <div className="text-2xl font-bold text-[#2C2825] my-2">¥ 4.28 <span className="text-xs font-normal text-[#7A726B]">($0.61)</span></div>
          <div className="text-[11px] text-[#7A726B]">当前水位 8.5%</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EADFD7] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#7A726B]">
            <span>平均首字延迟 (TTFT)</span>
            <Zap size={15} className="text-[#D96B27]" />
          </div>
          <div className="text-2xl font-bold text-[#2C2825] my-2">480ms</div>
          <div className="text-[11px] text-[#52D17C] font-medium">极速流式响应</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#EADFD7] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#7A726B]">
            <span>Prompt Cache 节省率</span>
            <Sparkles size={15} className="text-[#D96B27]" />
          </div>
          <div className="text-2xl font-bold text-[#D96B27] my-2">82.4%</div>
          <div className="text-[11px] text-[#7A726B]">节约 ~210,000 Tokens</div>
        </div>
      </div>

      {/* 模型占比条速览 */}
      <div className="bg-white p-5 rounded-xl border border-[#EADFD7] shadow-2xs">
        <h3 className="text-xs font-semibold text-[#2C2825] uppercase tracking-wider mb-3">活跃模型调度占比</h3>
        <div className="w-full h-3 bg-[#F4EFEA] rounded-full overflow-hidden flex">
          <div style={{ width: '65%' }} className="bg-[#D96B27]" title="DeepSeek-V4: 65%" />
          <div style={{ width: '25%' }} className="bg-[#C15F22]" title="Claude-3.7-Sonnet: 25%" />
          <div style={{ width: '10%' }} className="bg-[#2C2825]" title="GPT-4o: 10%" />
        </div>
        <div className="flex items-center gap-4 text-xs text-[#7A726B] mt-3">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#D96B27]" /> DeepSeek-V4 (65%)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#C15F22]" /> Claude 3.7 (25%)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2C2825]" /> GPT-4o (10%)</span>
        </div>
      </div>
    </div>
  )
}
