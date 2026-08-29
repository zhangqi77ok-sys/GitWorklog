import React, { useState } from 'react';
import {
  RotateCcw,
  SplitSquareVertical,
  Terminal,
  FileCode,
  Sparkles,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  PanelRightClose
} from 'lucide-react';
import { TerminalTab, createTerminalTab, closeTerminalTab } from '../types/contracts';

interface EditorWorkspaceProps {
  onCloseWorkspace: () => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({ onCloseWorkspace }) => {
  const [activeTab, setActiveTab] = useState<'code' | 'canvas'>('code');
  const [splitView, setSplitView] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);

  // Multi-terminal tabs
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([
    {
      id: 'term-1',
      title: 'zsh (1)',
      shell: 'zsh',
      logs: [
        '$ npm test',
        '✓ tests/contracts.test.ts (10 tests passed)',
        '[CodeMind Noise Filter]: 过滤了 42 行无用编译器转轮进度日志',
        'All tests passed. Zero errors.'
      ]
    },
    {
      id: 'term-2',
      title: 'pwsh (2)',
      shell: 'pwsh',
      logs: [
        'PS E:\\pro\\agent-learning> git status',
        'On branch main',
        'Your branch is up to date with origin/main.'
      ]
    }
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState('term-1');
  const [terminalCommandInput, setTerminalCommandInput] = useState('');

  const currentTerm = terminalTabs.find(t => t.id === activeTerminalId) || terminalTabs[0];

  const handleNewTerminal = () => {
    const newTab = createTerminalTab(terminalTabs, 'zsh');
    setTerminalTabs(prev => [...prev, newTab]);
    setActiveTerminalId(newTab.id);
  };

  const handleCloseTerminal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const after = closeTerminalTab(terminalTabs, id);
    setTerminalTabs(after);
    if (activeTerminalId === id && after.length > 0) {
      setActiveTerminalId(after[0].id);
    }
  };

  const handleRunCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && terminalCommandInput.trim()) {
      const cmd = terminalCommandInput.trim();
      setTerminalTabs(prev =>
        prev.map(t => {
          if (t.id === activeTerminalId) {
            return {
              ...t,
              logs: [...t.logs, `$ ${cmd}`, `[Executed]: ${cmd} executed successfully (0 exit)`]
            };
          }
          return t;
        })
      );
      setTerminalCommandInput('');
    }
  };

  return (
    <main style={{
      flex: 1,
      height: 'calc(100vh - 38px)',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      borderLeft: '1px solid var(--border-subtle)',
      overflow: 'hidden'
    }}>
      {/* ========================================================= */}
      {/* 1. TOP TAB BAR & CONTROLS                                 */}
      {/* ========================================================= */}
      <div style={{
        height: '34px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div
            onClick={() => setActiveTab('code')}
            style={{
              padding: '4px 10px',
              borderRadius: '4px 4px 0 0',
              background: activeTab === 'code' ? 'var(--bg-base)' : 'transparent',
              border: activeTab === 'code' ? '1px solid var(--border-subtle)' : 'none',
              borderBottom: 'none',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: activeTab === 'code' ? 600 : 400
            }}
          >
            <FileCode size={13} color="var(--accent)" />
            <span>contracts.ts</span>
          </div>

          <div
            style={{
              padding: '4px 10px',
              fontStyle: 'italic',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <span>📄 GatewayBus.ts (临时预览)</span>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setSplitView(!splitView)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: splitView ? 'var(--accent-subtle)' : 'transparent',
              color: splitView ? 'var(--accent)' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            <SplitSquareVertical size={12} />
            <span>◫ 分屏</span>
          </button>

          <button
            title="一键还原至上个影子快照"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(217, 107, 39, 0.1)',
              color: 'var(--accent)',
              border: '1px solid rgba(217, 107, 39, 0.3)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={11} />
            <span>↩️ 影子回退</span>
          </button>

          {/* Close Workspace Button */}
          <button
            onClick={onCloseWorkspace}
            title="收起右侧工作台区块"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            <PanelRightClose size={12} />
            <span>收起</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. MAIN 6:4 VERTICAL SPLIT: Files (60%) : Terminal (40%)  */}
      {/* ========================================================= */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* 2.1 File & Code Area (60% height when terminal is open, 100% when closed) */}
        <div style={{
          height: terminalOpen ? '60%' : '100%',
          display: 'flex',
          overflow: 'hidden',
          transition: 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Left: Code Editor */}
          <div style={{
            flex: splitView ? 1 : (activeTab === 'code' ? 1 : 0),
            display: (splitView || activeTab === 'code') ? 'flex' : 'none',
            flexDirection: 'column',
            background: 'var(--bg-code)',
            color: '#FAF8F5',
            fontFamily: 'var(--font-mono)',
            padding: '12px',
            fontSize: '12px',
            overflowY: 'auto'
          }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>// CodeMind-Hub 核心接口规范契约 (SDD Contract)</div>
            <div style={{ color: 'var(--code-lime)' }}>export type SessionTier1Type = 'global' | 'project';</div>
            <br />
            <div><span style={{ color: '#F59E0B' }}>export interface</span> SessionItem &#123;</div>
            <div style={{ paddingLeft: '16px' }}>id: <span style={{ color: '#60A5FA' }}>string</span>;</div>
            <div style={{ paddingLeft: '16px' }}>tier1: <span style={{ color: '#60A5FA' }}>SessionTier1Type</span>;</div>
            <div style={{ paddingLeft: '16px' }}>title: <span style={{ color: '#60A5FA' }}>string</span>;</div>
            <div style={{ paddingLeft: '16px' }}>totalTokens: <span style={{ color: '#60A5FA' }}>number</span>;</div>
            <div>&#125;</div>
            <br />
            <div style={{ color: '#10B981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 4px', borderRadius: '3px' }}>
              + // [Atomic Diff Patch] 经 AST 语法校验通过，严防死守语法错漏
            </div>
          </div>

          {/* Right: Multimodal Canvas */}
          <div style={{
            flex: splitView ? 1 : (activeTab === 'canvas' ? 1 : 0),
            display: (splitView || activeTab === 'canvas') ? 'flex' : 'none',
            flexDirection: 'column',
            background: 'var(--bg-base)',
            borderLeft: splitView ? '1px solid var(--border-subtle)' : 'none',
            padding: '16px',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: 'var(--accent)', fontWeight: 600 }}>
              <Sparkles size={16} />
              <span>多模态产物画布</span>
            </div>
            <div style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <p style={{ fontWeight: 600, marginBottom: '8px' }}>四大核心系统底座拓扑</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
                <div style={{ padding: '8px 12px', background: 'rgba(217, 107, 39, 0.1)', borderRadius: '4px', border: '1px solid var(--accent)', fontSize: '11px' }}>
                  总线-子线底座
                </div>
                <div style={{ padding: '8px 12px', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '4px', border: '1px solid #2563EB', fontSize: '11px' }}>
                  极致省 Token
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2.2 Terminal Area (40% height when open, 26px when minimized) */}
        <div style={{
          height: terminalOpen ? '40%' : '26px',
          background: 'var(--bg-code)',
          borderTop: '1px solid var(--border-strong)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden'
        }}>
          {/* Terminal Tab Bar with Create (+) and Open/Close Toggle */}
          <div style={{
            height: '26px',
            background: '#181614',
            borderBottom: '1px solid #2C2825',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 6px'
          }}>
            {/* Terminal Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 4px', color: 'var(--text-muted)', fontSize: '10px' }}>
                <Terminal size={12} color="var(--code-lime)" />
                <span style={{ color: '#DDD', fontWeight: 600 }}>终端 (40%):</span>
              </div>

              {terminalTabs.map(tab => {
                const isActive = tab.id === activeTerminalId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => {
                      setActiveTerminalId(tab.id);
                      if (!terminalOpen) setTerminalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '3px 3px 0 0',
                      background: isActive ? 'var(--bg-code)' : 'transparent',
                      color: isActive ? 'var(--code-lime)' : 'var(--text-muted)',
                      borderTop: isActive ? '2px solid var(--code-lime)' : '2px solid transparent',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <span>{tab.title}</span>
                    {terminalTabs.length > 1 && (
                      <X
                        size={10}
                        style={{ cursor: 'pointer', opacity: 0.7 }}
                        onClick={(e) => handleCloseTerminal(tab.id, e)}
                      />
                    )}
                  </div>
                );
              })}

              {/* New Terminal (+) Button */}
              <button
                onClick={handleNewTerminal}
                title="新建终端进程"
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '3px',
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginLeft: '4px'
                }}
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Terminal Open/Close Toggle Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setTerminalOpen(!terminalOpen)}
                title={terminalOpen ? '收起终端' : '展开终端 (40%)'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <span>{terminalOpen ? '▼ 收起终端' : '▲ 展开终端 (40%)'}</span>
              </button>
            </div>
          </div>

          {/* Active Terminal Content & Input */}
          {terminalOpen && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 10px', overflow: 'hidden' }}>
              <div style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--code-lime)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                {currentTerm.logs.map((log, index) => (
                  <div key={index} style={{ color: log.startsWith('$') ? '#FFF' : 'var(--code-lime)' }}>
                    {log}
                  </div>
                ))}
              </div>

              {/* Terminal command prompt input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px', borderTop: '1px solid #2C2825' }}>
                <span style={{ color: 'var(--code-lime)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>$</span>
                <input
                  type="text"
                  placeholder="输入终端指令 (例如 npm test 或 git commit)..."
                  value={terminalCommandInput}
                  onChange={e => setTerminalCommandInput(e.target.value)}
                  onKeyDown={handleRunCommand}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#FFF',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
};
