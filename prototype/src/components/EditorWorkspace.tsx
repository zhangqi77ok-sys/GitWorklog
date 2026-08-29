import React, { useState } from 'react';
import {
  X,
  FileCode,
  Terminal,
  Play,
  RotateCcw,
  Sparkles,
  Plus,
  ShieldCheck
} from 'lucide-react';
import {
  TerminalTab,
  createTerminalTab,
  closeTerminalTab,
  INITIAL_OPENED_FILES,
  OpenedEditorFile,
  closeEditorFile,
  clampTerminalHeightPercent
} from '../types/contracts';

interface EditorWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_TERMINALS_STATE: TerminalTab[] = [
  { id: 'term-1', title: 'zsh (1)', shell: 'zsh', logs: [] },
  { id: 'term-2', title: 'pwsh (2)', shell: 'pwsh', logs: [] }
];

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const [openedFiles, setOpenedFiles] = useState<OpenedEditorFile[]>(INITIAL_OPENED_FILES);
  const [activeFileId, setActiveFileId] = useState<string>('file-contracts');
  const [showInlineEdit, setShowInlineEdit] = useState(false);
  const [inlineInput, setInlineInput] = useState('');
  const [inlineToast, setInlineToast] = useState<string | null>(null);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('term-1');
  const [terminals, setTerminals] = useState<TerminalTab[]>(INITIAL_TERMINALS_STATE);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '$ npm test',
    '✓ tests/contracts.test.ts (40 tests passed in 12ms)',
    '[CodeMind Noise Filter]: 过滤了 42 行无用编译器转轮进度日志',
    'All tests passed. Zero errors.'
  ]);
  const [cmdInput, setCmdInput] = useState('');

  // Vertical Resizable Split for Editor vs Terminal
  const [terminalHeightPercent, setTerminalHeightPercent] = useState<number>(40);
  const [isDraggingVert, setIsDraggingVert] = useState(false);

  React.useEffect(() => {
    const handleVertMove = (e: MouseEvent) => {
      if (isDraggingVert) {
        const container = document.getElementById('workbench-split-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const newPercent = ((rect.bottom - e.clientY) / rect.height) * 100;
          setTerminalHeightPercent(clampTerminalHeightPercent(newPercent));
        }
      }
    };

    const handleVertUp = () => {
      setIsDraggingVert(false);
    };

    if (isDraggingVert) {
      window.addEventListener('mousemove', handleVertMove);
      window.addEventListener('mouseup', handleVertUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleVertMove);
      window.removeEventListener('mouseup', handleVertUp);
    };
  }, [isDraggingVert]);

  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    const newLogs = [...terminalLogs, `$ ${cmdInput}`];

    if (cmdInput.toLowerCase().includes('rm -rf') || cmdInput.toLowerCase().includes('drop table')) {
      newLogs.push('🛡️ [终端安全沙箱拦截]: 监测到高危破坏性写盘指令，已自动阻断并保护工作区！');
    } else {
      newLogs.push(`[${terminals.find(t => t.id === activeTerminalId)?.title || 'term'}]: 执行成功 (AST 状态健康)`);
    }

    setTerminalLogs(newLogs);
    setCmdInput('');
  };

  const codeLines = [
    { num: 1, text: '// CodeMind-Hub 核心数据契约 (SDD Contract)', type: 'comment' },
    { num: 2, text: '', type: 'normal' },
    { num: 3, text: 'export type WorkMode = \'act\' | \'plan\' | \'minimal\' | \'creator\';', type: 'type_def' },
    { num: 4, text: '', type: 'normal' },
    { num: 5, text: 'export interface SessionItem {', type: 'interface' },
    { num: 6, text: '  id: string;', type: 'field' },
    { num: 7, text: '  tier1: \'global\' | \'project\';', type: 'field' },
    { num: 8, text: '  title: string;', type: 'field' },
    { num: 9, text: '  totalTokens: number;', type: 'field' },
    { num: 10, text: '  forkedFromId?: string;', type: 'field' },
    { num: 11, text: '}', type: 'interface' },
    { num: 12, text: '', type: 'normal' }
  ];

  return (
    <aside style={{
      width: '100%',
      height: '100%',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: isDraggingVert ? 'none' : 'auto'
    }}>
      {/* 1. TOP TAB BAR & CONTROLS */}
      <div style={{
        height: '36px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px'
      }}>
        {/* Dynamic Multi-File Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', overflowX: 'auto' }}>
          {openedFiles.map(file => {
            const isActive = activeFileId === file.id;
            return (
              <div
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px 4px 0 0',
                  background: isActive ? 'var(--bg-base)' : 'transparent',
                  border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
                  borderBottom: 'none',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)'
                }}
              >
                <FileCode size={12} color={isActive ? 'var(--accent)' : 'var(--text-muted)'} />
                <span>{file.name}</span>
                {file.isDirty && (
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />
                )}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    const res = closeEditorFile(openedFiles, file.id);
                    setOpenedFiles(res.remainingFiles);
                    if (res.activeFileId) setActiveFileId(res.activeFileId);
                  }}
                  style={{ fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: '2px' }}
                >
                  ✕
                </span>
              </div>
            );
          })}
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setShowInlineEdit(!showInlineEdit)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 7px',
              borderRadius: '4px',
              background: showInlineEdit ? 'rgba(147, 51, 234, 0.15)' : 'var(--bg-base)',
              color: showInlineEdit ? '#9333EA' : 'var(--text-secondary)',
              border: showInlineEdit ? '1px solid #9333EA' : '1px solid var(--border-subtle)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="行内重构 (Ctrl+K)"
          >
            <Sparkles size={11} color={showInlineEdit ? '#9333EA' : 'var(--accent)'} />
            <span>⚡ 行内重构</span>
          </button>

          <button
            title="一键还原至上个影子快照"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(217, 107, 39, 0.08)',
              color: 'var(--accent)',
              border: '1px solid rgba(217, 107, 39, 0.25)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={11} />
            <span>↩️ 影子快照</span>
          </button>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 2. SPLIT BODY: RESIZABLE EDITOR (TOP) + TERMINAL (BOTTOM) */}
      <div id="workbench-split-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* TOP: CODE EDITOR AREA (Dynamic Height) */}
        <div style={{
          flex: 1,
          height: `${100 - terminalHeightPercent}%`,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-base)',
          overflow: 'hidden',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px'
        }}>
          {/* Ctrl+K Floating Input Widget */}
          {showInlineEdit && (
            <div style={{
              margin: '8px 12px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid #9333EA',
              boxShadow: '0 4px 16px rgba(147, 51, 234, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 30
            }}>
              <Sparkles size={13} color="#9333EA" />
              <input
                type="text"
                value={inlineInput}
                onChange={e => setInlineInput(e.target.value)}
                placeholder="输入行内重构指令（例如：为 solveGeneric 添加泛型约束与单元测试）..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '11px',
                  color: 'var(--text-primary)'
                }}
              />
              <button
                onClick={() => {
                  setShowInlineEdit(false);
                  setInlineToast('✓ 行内重构已自动接入 AST 静态检查');
                  setTimeout(() => setInlineToast(null), 3000);
                }}
                style={{
                  padding: '2px 8px',
                  borderRadius: '3px',
                  background: '#9333EA',
                  border: 'none',
                  color: '#FFF',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                生成
              </button>
            </div>
          )}

          {/* Toast */}
          {inlineToast && (
            <div style={{
              position: 'absolute',
              top: '45px',
              right: '15px',
              padding: '3px 8px',
              background: '#16A34A',
              color: '#FFF',
              borderRadius: '3px',
              fontSize: '10.5px',
              fontWeight: 600,
              zIndex: 50
            }}>
              {inlineToast}
            </div>
          )}

          {/* Editor Body with Gutter (Line Numbers) & Rich Syntax Coloring */}
          <div style={{ flex: 1, display: 'flex', overflowY: 'auto', padding: '8px 0' }}>
            {/* Gutter Line Numbers */}
            <div style={{
              width: '38px',
              padding: '0 8px 0 0',
              textAlign: 'right',
              color: 'var(--text-muted)',
              opacity: 0.5,
              userSelect: 'none',
              borderRight: '1px solid var(--border-subtle)',
              fontSize: '11px',
              lineHeight: '20px'
            }}>
              {codeLines.map(l => (
                <div key={l.num}>{l.num}</div>
              ))}
              <div>13</div>
              <div>14</div>
            </div>

            {/* Code Content Area */}
            <div style={{ flex: 1, padding: '0 12px', lineHeight: '20px' }}>
              <div><span style={{ color: '#6B7280' }}>// CodeMind-Hub 核心数据契约 (SDD Contract)</span></div>
              <div>&nbsp;</div>
              <div>
                <span style={{ color: '#9333EA', fontWeight: 600 }}>export type</span> <span style={{ color: '#0284C7' }}>WorkMode</span> = <span style={{ color: '#16A34A' }}>'act'</span> | <span style={{ color: '#16A34A' }}>'plan'</span> | <span style={{ color: '#16A34A' }}>'minimal'</span> | <span style={{ color: '#16A34A' }}>'creator'</span>;
              </div>
              <div>&nbsp;</div>
              <div>
                <span style={{ color: '#9333EA', fontWeight: 600 }}>export interface</span> <span style={{ color: '#0284C7' }}>SessionItem</span> &#123;
              </div>
              <div style={{ paddingLeft: '16px' }}>
                <span style={{ color: 'var(--text-primary)' }}>id:</span> <span style={{ color: '#D97706' }}>string</span>;
              </div>
              <div style={{ paddingLeft: '16px' }}>
                <span style={{ color: 'var(--text-primary)' }}>tier1:</span> <span style={{ color: '#16A34A' }}>'global'</span> | <span style={{ color: '#16A34A' }}>'project'</span>;
              </div>
              <div style={{ paddingLeft: '16px' }}>
                <span style={{ color: 'var(--text-primary)' }}>title:</span> <span style={{ color: '#D97706' }}>string</span>;
              </div>
              <div style={{ paddingLeft: '16px' }}>
                <span style={{ color: 'var(--text-primary)' }}>totalTokens:</span> <span style={{ color: '#D97706' }}>number</span>;
              </div>
              <div style={{ paddingLeft: '16px' }}>
                <span style={{ color: 'var(--text-primary)' }}>forkedFromId?:</span> <span style={{ color: '#D97706' }}>string</span>;
              </div>
              <div>&#125;</div>

              {/* Live Inline Diff Block */}
              <div style={{
                marginTop: '4px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '2px 8px',
                  background: 'rgba(22, 163, 74, 0.12)',
                  borderLeft: '3px solid #16A34A',
                  color: '#16A34A',
                  fontSize: '11px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <code>+ export function solveGeneric&lt;T&gt;(input: T): Promise&lt;T&gt;; // [AST 校验通过]</code>
                  <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: '#16A34A', color: '#FFF', fontWeight: 600 }}>Tab 接受</span>
                </div>
                <div style={{
                  padding: '2px 8px',
                  background: 'rgba(220, 38, 38, 0.08)',
                  borderLeft: '3px solid #DC2626',
                  color: '#DC2626',
                  fontSize: '11px',
                  textDecoration: 'line-through'
                }}>
                  <code>- export function solve(input: any): any;</code>
                </div>
              </div>
            </div>
          </div>

          {/* IDE Mini Status Bar */}
          <div style={{
            height: '22px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px',
            fontSize: '10px',
            color: 'var(--text-muted)',
            userSelect: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>TypeScript</span>
              <span>UTF-8</span>
              <span>Ln 14, Col 28</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#16A34A', fontWeight: 600 }}>🟢 AST Verified</span>
              <span>·</span>
              <span>Prettier</span>
            </div>
          </div>
        </div>

        {/* VERTICAL DRAGGABLE DIVIDER (Row-Resize) */}
        <div
          onMouseDown={() => setIsDraggingVert(true)}
          title="上下拖拽调整编辑器与终端高度"
          style={{
            height: '5px',
            background: isDraggingVert ? 'var(--accent)' : 'var(--bg-surface)',
            borderTop: '1px solid var(--border-subtle)',
            borderBottom: '1px solid var(--border-subtle)',
            cursor: 'row-resize',
            zIndex: 40,
            transition: 'background 0.15s ease'
          }}
        />

        {/* BOTTOM: INTEGRATED TERMINAL DRAWER (Dynamic Height) */}
        <div style={{
          height: `${terminalHeightPercent}%`,
          background: '#18181B',
          color: '#F4F4F5',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px'
        }}>
          {/* Terminal Drawer Header */}
          <div style={{
            height: '30px',
            background: '#27272A',
            borderBottom: '1px solid #3F3F46',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {terminals.map(t => {
                const isActive = activeTerminalId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveTerminalId(t.id)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '3px',
                      background: isActive ? '#18181B' : 'transparent',
                      color: isActive ? '#FFF' : '#A1A1AA',
                      cursor: 'pointer',
                      fontSize: '10.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{t.title}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        const rem = closeTerminalTab(terminals, t.id);
                        setTerminals(rem);
                        if (rem.length > 0) setActiveTerminalId(rem[rem.length - 1].id);
                      }}
                      style={{ fontSize: '9px', opacity: 0.6 }}
                    >
                      ✕
                    </span>
                  </div>
                );
              })}

              <button
                onClick={() => {
                  const newT = createTerminalTab(terminals);
                  setTerminals(prev => [...prev, newT]);
                  setActiveTerminalId(newT.id);
                }}
                style={{ background: 'transparent', border: 'none', color: '#A1A1AA', cursor: 'pointer' }}
              >
                <Plus size={11} />
              </button>
            </div>

            {/* Terminal Safety Guard Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '1px 6px',
              borderRadius: '3px',
              background: 'rgba(22, 163, 74, 0.2)',
              border: '1px solid #16A34A',
              color: '#4ADE80',
              fontSize: '9.5px',
              fontWeight: 600
            }}>
              <ShieldCheck size={11} />
              <span>🛡️ 沙箱防护中</span>
            </div>
          </div>

          {/* Terminal Console Logs */}
          <div style={{ flex: 1, padding: '8px 10px', overflowY: 'auto', lineHeight: '18px' }}>
            {terminalLogs.map((log, idx) => (
              <div key={idx} style={{
                color: log.startsWith('$')
                  ? '#38BDF8'
                  : log.includes('✓')
                  ? '#4ADE80'
                  : log.includes('过滤')
                  ? '#F59E0B'
                  : log.includes('🛡️')
                  ? '#F87171'
                  : '#D4D4D8'
              }}>
                {log}
              </div>
            ))}
          </div>

          {/* Terminal Command Input Form */}
          <form onSubmit={handleRunCommand} style={{
            padding: '6px 10px',
            borderTop: '1px solid #27272A',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#18181B'
          }}>
            <span style={{ color: '#4ADE80', fontWeight: 600 }}>❯</span>
            <input
              type="text"
              value={cmdInput}
              onChange={e => setCmdInput(e.target.value)}
              placeholder="输入终端指令 (例如: npm test 或 git status)..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#FFF',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)'
              }}
            />
            <button
              type="submit"
              style={{ background: 'transparent', border: 'none', color: '#A1A1AA', cursor: 'pointer' }}
            >
              <Play size={11} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
};
