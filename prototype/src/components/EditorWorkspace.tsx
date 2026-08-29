import React, { useState } from 'react';
import { RotateCcw, SplitSquareVertical, Terminal, FileCode, Eye, Sparkles } from 'lucide-react';

export const EditorWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'code' | 'canvas'>('code');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [splitView, setSplitView] = useState(false);

  return (
    <main style={{
      flex: 1,
      height: 'calc(100vh - 38px)',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Top Tab Bar with Ephemeral Preview & Regular Tabs */}
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
          {/* Regular Tab */}
          <div style={{
            padding: '4px 10px',
            borderRadius: '4px 4px 0 0',
            background: activeTab === 'code' ? 'var(--bg-base)' : 'transparent',
            border: activeTab === 'code' ? '1px solid var(--border-subtle)' : 'none',
            borderBottom: 'none',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab('code')}>
            <FileCode size={13} color="var(--accent)" />
            <span>contracts.ts</span>
          </div>

          {/* Ephemeral Preview Tab (Italic) */}
          <div style={{
            padding: '4px 10px',
            fontStyle: 'italic',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}>
            <span>📄 GatewayBus.ts (临时预览)</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Split view toggle */}
          <button
            onClick={() => setSplitView(!splitView)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '4px',
              background: splitView ? 'var(--accent-subtle)' : 'transparent',
              color: splitView ? 'var(--accent)' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            <SplitSquareVertical size={13} />
            <span>◫ 分屏对照</span>
          </button>

          {/* Git Shadow Snapshot Rollback */}
          <button
            title="一键还原至上一个快照"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(217, 107, 39, 0.1)',
              color: 'var(--accent)',
              border: '1px solid rgba(217, 107, 39, 0.3)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={12} />
            <span>↩️ 影子回退</span>
          </button>
        </div>
      </div>

      {/* Editor & Canvas Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Side: Code Editor / Diff */}
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
          <div style={{ color: 'var(--code-lime)' }}>export type SessionTier1Type = 'global' | 'project' | 'file';</div>
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

        {/* Right Side: Multimodal Canvas */}
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
            <span>多模态产物画布 (Mermaid 架构图谱预览)</span>
          </div>
          <div style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '16px',
            textAlign: 'center'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '8px' }}>四大核心系统底座全景拓扑</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px' }}>
              <div style={{ padding: '8px 12px', background: 'rgba(217, 107, 39, 0.1)', borderRadius: '4px', border: '1px solid var(--accent)', fontSize: '11px' }}>
                总线-子线底座
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '4px', border: '1px solid #2563EB', fontSize: '11px' }}>
                极致省 Token 引擎
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(22, 163, 74, 0.1)', borderRadius: '4px', border: '1px solid #16A34A', fontSize: '11px' }}>
                Git 影子快照底座
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Drawer Terminal */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: terminalOpen ? '200px' : '24px',
        background: 'var(--bg-code)',
        borderTop: '1px solid var(--border-strong)',
        transition: 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 30
      }}>
        {/* Terminal Handle */}
        <div
          onClick={() => setTerminalOpen(!terminalOpen)}
          style={{
            height: '24px',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={12} color="var(--code-lime)" />
            <span style={{ color: '#FFF' }}>📟 终端 (zsh / pwsh) · 运行正常</span>
          </div>
          <span>{terminalOpen ? '▼ 收起' : '▲ 展开'}</span>
        </div>

        {/* Terminal logs content */}
        {terminalOpen && (
          <div style={{ flex: 1, padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--code-lime)', overflowY: 'auto' }}>
            <div>$ npm test</div>
            <div>✓ tests/contracts.test.ts (2 tests passed)</div>
            <div>[CodeMind Noise Filter]: 过滤了 42 行编译器打包无用进度条日志</div>
            <div style={{ color: '#FFF' }}>All tests passed. Zero errors.</div>
          </div>
        )}
      </div>
    </main>
  );
};
