import { useState } from 'react';
import { WorkMode, PermissionPolicy } from './types/contracts';

export default function App() {
  const [mode, setMode] = useState<WorkMode>('act');
  const [policy, setPolicy] = useState<PermissionPolicy>('smart_autonomous');

  return (
    <div className="flex h-screen w-screen flex-col bg-[#FAF8F5] text-[#1E1C1A] font-sans antialiased select-none">
      {/* 系统级无边框标题栏 */}
      <header className="flex h-9 items-center justify-between border-b border-[#E7E2D9] px-4 bg-[#F4EFEA]/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#D96B27]"></span>
          <span className="font-semibold tracking-wide">CodeMind-Hub</span>
          <span className="text-[#8C827A]">/ Clean Architecture v0.11.0</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-md bg-[#EBE5DE] px-2 py-0.5 text-[11px]">
            <span>⚡ KV Cache: 95.8%</span>
            <span className="text-[#8C827A]">|</span>
            <span>Token Saver: Active</span>
          </div>
        </div>
      </header>

      {/* 主工作区 */}
      <main className="flex flex-1 overflow-hidden">
        {/* 42px 活动栏 */}
        <nav className="flex w-[42px] flex-col items-center border-r border-[#E7E2D9] bg-[#F4EFEA] py-3 gap-4 text-sm">
          <button className="text-[#D96B27] font-bold">💬</button>
          <button className="text-[#8C827A] hover:text-[#1E1C1A]">📁</button>
          <button className="text-[#8C827A] hover:text-[#1E1C1A]">⚙️</button>
        </nav>

        {/* 三栏布局骨架 */}
        <div className="flex flex-1">
          {/* 左栏：文件树与会话 */}
          <aside className="w-60 border-r border-[#E7E2D9] bg-[#FAF8F5] p-3 text-xs">
            <div className="font-semibold text-[#8C827A] mb-2 uppercase tracking-wider text-[10px]">Explorer & Sessions</div>
            <div className="text-[#57534E]">Workspace Ready (Clean Slate)</div>
          </aside>

          {/* 中栏：流式推理与决策 */}
          <section className="flex flex-1 flex-col border-r border-[#E7E2D9] bg-[#FAF8F5]">
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="rounded-xl border border-[#E7E2D9] bg-white p-4 shadow-2xs max-w-2xl">
                <h2 className="text-sm font-semibold text-[#D96B27] mb-1">🚀 纯净积木底座已就绪</h2>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  旧版代码已全量安全备份并清空。当前运行于基于 <strong>总线-子线</strong>、<strong>极致省 Token 引擎</strong> 与 <strong>安全系统底座</strong> 的全新纯净架构上。
                </p>
              </div>
            </div>

            {/* 输入与权限控制条 */}
            <div className="border-t border-[#E7E2D9] p-3 bg-white">
              <div className="flex items-center justify-between mb-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setMode(mode === 'plan' ? 'act' : 'plan')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      mode === 'plan' ? 'bg-[#F4EFEA] text-[#8C827A]' : 'bg-[#D96B27] text-white'
                    }`}
                  >
                    {mode === 'plan' ? '📋 Plan 模式' : '⚡ Act 模式'}
                  </button>
                  <button 
                    onClick={() => setPolicy(policy === 'strict_approval' ? 'smart_autonomous' : 'strict_approval')}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F4EFEA] text-[#57534E] border border-[#E7E2D9]"
                  >
                    {policy === 'strict_approval' ? '🛡️ 逐次审核' : '🤖 智能决策'}
                  </button>
                </div>
                <div className="text-[11px] text-[#8C827A]">AST 骨架裁剪 · 原子 Patch 引擎</div>
              </div>
              <input 
                type="text" 
                placeholder="键入指令或使用 / 呼出快捷指令 (输入回车发送)..." 
                className="w-full rounded-lg border border-[#E7E2D9] px-3 py-2 text-xs focus:border-[#D96B27] focus:outline-none"
              />
            </div>
          </section>

          {/* 右栏：代码工作台与终端 */}
          <aside className="w-[45%] flex flex-col bg-[#FDFCFB]">
            <div className="flex h-8 items-center border-b border-[#E7E2D9] px-3 text-xs text-[#8C827A]">
              <span className="text-[#1E1C1A] font-medium">📄 Editor Preview</span>
            </div>
            <div className="flex-1 p-4 font-mono text-xs text-[#57534E]">
              // Clean Building-Block Editor Workspace
            </div>
            {/* 抽屉终端 */}
            <div className="h-28 border-t border-[#E7E2D9] bg-[#1E1C1A] p-2 text-[#A3E635] font-mono text-xs">
              <div>$ codemind-hub --clean-substrate initialized</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
