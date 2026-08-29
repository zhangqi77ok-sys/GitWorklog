import React, { useState } from 'react';
import { Sparkles, ShieldCheck, Check, Copy } from 'lucide-react';

interface MonacoCodeEditorProps {
  activeFileId: string;
  activeDiffTarget?: { fileId: string; filePath: string; targetLine: number } | null;
  onCodeAction?: (action: string, codeSnippet: string) => void;
}

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  activeFileId,
  activeDiffTarget,
  onCodeAction
}) => {
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAction = (actionName: string) => {
    const msg = `⚡ 已针对 SessionItem 接口触发: ${actionName}`;
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
    if (onCodeAction) onCodeAction(actionName, 'export interface SessionItem { ... }');
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      userSelect: 'text',
      position: 'relative'
    }}>
      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '4px 12px',
          borderRadius: '16px',
          background: 'var(--accent)',
          color: '#FFF',
          fontSize: '11px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 50
        }}>
          {toastMessage}
        </div>
      )}

      {/* Editor Main Canvas with Gutter and Line Numbers */}
      <div style={{ flex: 1, display: 'flex', overflow: 'auto', padding: '10px 0' }}>
        {/* Left Gutter: Line numbers & Folding Markers */}
        <div style={{
          width: '42px',
          padding: '0 8px 0 0',
          textAlign: 'right',
          color: 'var(--text-muted)',
          fontSize: '11px',
          lineHeight: '22px',
          userSelect: 'none',
          opacity: 0.6,
          borderRight: '1px solid var(--border-subtle)'
        }}>
          {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
            <div
              key={n}
              style={{
                background: activeDiffTarget?.targetLine === n ? 'rgba(217, 107, 39, 0.25)' : 'transparent',
                fontWeight: activeDiffTarget?.targetLine === n ? 700 : 400,
                color: activeDiffTarget?.targetLine === n ? 'var(--accent)' : 'inherit'
              }}
            >
              {n}
            </div>
          ))}
        </div>

        {/* Right Code Content with Syntax Highlighting & Diff */}
        <div style={{ flex: 1, padding: '0 16px', lineHeight: '22px' }}>
          <div style={{ color: '#6B7280' }}>// Tcode 核心数据契约 (SDD Contract)</div>
          <div>&nbsp;</div>
          <div>
            <span style={{ color: '#9333EA', fontWeight: 600 }}>export type</span> <span style={{ color: '#0284C7' }}>WorkMode</span> = <span style={{ color: '#10B981' }}>'act'</span> | <span style={{ color: '#10B981' }}>'plan'</span> | <span style={{ color: '#10B981' }}>'minimal'</span> | <span style={{ color: '#10B981' }}>'creator'</span>;
          </div>
          <div>&nbsp;</div>

          {/* Selection Floating Quick Bar */}
          <div style={{
            margin: '2px 0 6px 0',
            padding: '2px 8px',
            borderRadius: '16px',
            background: '#18181B',
            border: '1px solid var(--accent)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '10px',
            color: '#FFF',
            zIndex: 10
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Ln 5-11 选中:</span>
            <button
              onClick={() => handleAction('智能重构')}
              style={{ background: 'transparent', border: 'none', color: '#60A5FA', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
            >
              <Sparkles size={10} /> 智能重构
            </button>
            <button
              onClick={() => handleAction('补全单测')}
              style={{ background: 'transparent', border: 'none', color: '#4ADE80', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
            >
              <ShieldCheck size={10} /> 补全单测
            </button>
            <button
              onClick={() => handleAction('追问')}
              style={{ background: 'transparent', border: 'none', color: '#FCD34D', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
            >
              💬 追问
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '9px', userSelect: 'none' }}>⌄</span>
            <span style={{ color: '#9333EA', fontWeight: 600 }}>export interface</span> <span style={{ color: '#0284C7' }}>SessionItem</span> &#123;
          </div>
          <div style={{ paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <div>id: <span style={{ color: '#F59E0B' }}>string</span>;</div>
            <div>tier1: <span style={{ color: '#10B981' }}>'global'</span> | <span style={{ color: '#10B981' }}>'project'</span>;</div>
            <div>title: <span style={{ color: '#F59E0B' }}>string</span>;</div>
            <div>totalTokens: <span style={{ color: '#F59E0B' }}>number</span>;</div>
            <div>forkedFromId?: <span style={{ color: '#F59E0B' }}>string</span>;</div>
          </div>
          <div>&#125;</div>
          <div>&nbsp;</div>

          {/* Dynamic Non-Invasive Live Probe Callout */}
          <div style={{
            margin: '4px 0',
            padding: '4px 8px',
            borderRadius: '4px',
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px dashed #EAB308',
            color: '#CA8A04',
            fontSize: '10.5px'
          }}>
            ⚡ [动态探针捕获] input: &#123; mode: 'act', tokens: 21000 &#125; ➔ 返回: 零侵入式探针 (测试通过自动清除)
          </div>

          {/* Inline Unified Diff Block */}
          <div style={{
            margin: '6px 0',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{
              padding: '2px 8px',
              background: 'rgba(22, 163, 74, 0.12)',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>+ export function solveGeneric&lt;T&gt;(input: T): Promise&lt;T&gt;; // [AST 校验通过]</span>
              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: '#16A34A', color: '#FFF', fontWeight: 600 }}>Tab 接受</span>
            </div>
            <div style={{
              padding: '2px 8px',
              background: 'rgba(220, 38, 38, 0.08)',
              color: '#DC2626',
              textDecoration: 'line-through'
            }}>
              - export function solve(input: any): any;
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
