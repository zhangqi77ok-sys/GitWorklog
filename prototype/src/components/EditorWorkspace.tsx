import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Play,
  Terminal,
  FolderGit2,
  FileCode,
  FileText,
  Sparkles,
  ChevronRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  Check,
  Search,
  Code,
  GitBranch,
  RefreshCw
} from 'lucide-react';
import { TerminalTab, OpenedEditorFile } from '../types/contracts';

interface EditorWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  activeDiffTarget?: { fileId: string; filePath: string; targetLine: number } | null;
  activeFile?: { path: string; name: string; line?: number } | null;
  activeProject?: { name: string; path: string; gitBranch: string } | null;
}

const INITIAL_TERMINALS: TerminalTab[] = [
  {
    id: 'term-1',
    title: 'PowerShell (1)',
    shell: 'pwsh',
    cwd: 'e:/pro/agent-learning',
    logs: [
      'Windows PowerShell',
      '版权所有 (C) Microsoft Corporation。保留所有权利。',
      '已接入真实本地宿主执行引擎。',
      ''
    ]
  }
];

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  isOpen,
  onClose,
  activeDiffTarget,
  activeFile,
  activeProject
}) => {
  // Universal ESC key support
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Real Opened Files State (Empty by default if no file opened)
  const [openedFiles, setOpenedFiles] = useState<OpenedEditorFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeFile?.line && codeContainerRef.current) {
      const targetElement = document.getElementById(`editor-line-${activeFile.line}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeFile?.line, fileContent]);

  // Load real file content when activeFile changes
  useEffect(() => {
    if (activeFile && activeFile.path) {
      const existing = openedFiles.find(f => f.path === activeFile.path);
      if (!existing) {
        const newFile: OpenedEditorFile = {
          id: `file-${Date.now()}`,
          name: activeFile.name,
          path: activeFile.path,
          language: activeFile.name.endsWith('.tsx') || activeFile.name.endsWith('.ts') ? 'typescript' : activeFile.name.endsWith('.py') ? 'python' : 'markdown',
          isModified: false,
          astStatus: 'verified'
        };
        setOpenedFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
      } else {
        setActiveFileId(existing.id);
      }

      // Fetch file content from backend
      setIsLoadingFile(true);
      fetch(`/api/fs/read?path=${encodeURIComponent(activeFile.path)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && typeof data.content === 'string') {
            setFileContent(data.content);
          } else {
            setFileContent(`// ${activeFile.name}\n// 无法读取文件内容或文件为空`);
          }
        })
        .catch(() => {
          setFileContent(`// ${activeFile.name}\n// 读取本地文件失败`);
        })
        .finally(() => setIsLoadingFile(false));
    }
  }, [activeFile]);

  // Terminal State: 100% Independent Tabs
  const [terminals, setTerminals] = useState<TerminalTab[]>(INITIAL_TERMINALS);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('term-1');
  const [cmdInput, setCmdInput] = useState<string>('');
  const [isExecutingCmd, setIsExecutingCmd] = useState<boolean>(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  // 📐 Stable Pixel Height: Default 260px (Bounds: 160px ~ 520px) with Self-Healing
  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('codemind_terminal_height_px');
      const val = saved ? parseInt(saved, 10) : 260;
      if (isNaN(val) || val < 160 || val > 520) return 260;
      return val;
    } catch (e) {
      return 260;
    }
  });
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);

  const activeTerminal = terminals.find(t => t.id === activeTerminalId) || terminals[0];
  const terminalLogsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTerminal?.logs]);

  // Pointer Events with setPointerCapture for reliable drag over Monaco/Terminal
  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingSplit(true);
  };

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSplit) return;
    const container = document.getElementById('workbench-split-container');
    if (container) {
      const rect = container.getBoundingClientRect();
      const rawHeight = rect.bottom - e.clientY;
      const clampedHeight = Math.max(160, Math.min(520, Math.round(rawHeight)));
      setTerminalHeight(clampedHeight);
      try {
        localStorage.setItem('codemind_terminal_height_px', clampedHeight.toString());
      } catch (err) {}
    }
  };

  const handleSplitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setIsDraggingSplit(false);
  };

  const handleResetSplitHeight = () => {
    setTerminalHeight(260);
    try {
      localStorage.setItem('codemind_terminal_height_px', '260');
    } catch (err) {}
  };

  // Terminal Tab Operations
  const handleAddTerminal = () => {
    const nextIdx = terminals.length + 1;
    const newTab: TerminalTab = {
      id: `term-${Date.now()}`,
      title: `PowerShell (${nextIdx})`,
      shell: 'pwsh',
      cwd: activeProject?.path || 'e:/pro/agent-learning',
      logs: [
        'Windows PowerShell',
        '版权所有 (C) Microsoft Corporation。保留所有权利。',
        `[新终端实例 #${nextIdx} 已就绪]`,
        ''
      ]
    };
    setTerminals(prev => [...prev, newTab]);
    setActiveTerminalId(newTab.id);
  };

  const handleCloseTerminal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (terminals.length <= 1) return; // Keep at least one
    const remaining = terminals.filter(t => t.id !== id);
    setTerminals(remaining);
    if (activeTerminalId === id) {
      setActiveTerminalId(remaining[0].id);
    }
  };

  // Real PowerShell Command Execution
  const handleExecuteTerminalCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cmdInput.trim();
    if (!cmd || isExecutingCmd) return;

    setCmdInput('');
    setCommandHistory(prev => [cmd, ...prev.filter(c => c !== cmd)]);
    setHistoryIndex(-1);

    const cwdPath = activeTerminal.cwd || activeProject?.path || 'e:/pro/agent-learning';

    if (cmd.toLowerCase() === 'cls' || cmd.toLowerCase() === 'clear') {
      setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, logs: [] } : t));
      return;
    }

    // Append command to active tab's independent log
    setTerminals(prev => prev.map(t => {
      if (t.id === activeTerminalId) {
        return {
          ...t,
          logs: [...t.logs, `PS ${cwdPath}> ${cmd}`]
        };
      }
      return t;
    }));

    setIsExecutingCmd(true);

    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: cwdPath })
      });
      const data = await res.json();
      if (data.success) {
        const outLines = (data.stdout || '').split('\n').filter(Boolean);
        const errLines = (data.stderr || '').split('\n').filter(Boolean);
        setTerminals(prev => prev.map(t => {
          if (t.id === activeTerminalId) {
            return {
              ...t,
              logs: [...t.logs, ...outLines, ...errLines, '']
            };
          }
          return t;
        }));
      } else {
        setTerminals(prev => prev.map(t => {
          if (t.id === activeTerminalId) {
            return {
              ...t,
              logs: [...t.logs, `❌ 执行失败: ${data.error || '未知错误'}`, '']
            };
          }
          return t;
        }));
      }
    } catch (err: any) {
      setTerminals(prev => prev.map(t => {
        if (t.id === activeTerminalId) {
          return {
            ...t,
            logs: [...t.logs, `❌ 连接本地宿主终端失败: ${err.message || 'Network error'}`, '']
          };
        }
        return t;
      }));
    } finally {
      setIsExecutingCmd(false);
    }
  };

  if (!isOpen) return null;

  const currentFile = openedFiles.find(f => f.id === activeFileId);
  const codeLines = fileContent.split('\n');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--bg-base)',
      borderLeft: '1px solid var(--border-subtle)',
      userSelect: 'none',
      position: 'relative'
    }}>
      {/* 1. TOP TITLEBAR */}
      <div style={{
        height: '38px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px 0 12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            工作台 · 高精代码与终端
          </span>
          {currentFile && (
            <span style={{ fontSize: '11.5px', color: 'var(--accent)', fontWeight: 600 }}>
              📁 {currentFile.name}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          title="关闭工作台 (ESC)"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
        >
          <X size={15} />
        </button>
      </div>

      {/* 2. MAIN SPLIT BODY (Flex column with 1fr Top Editor and fixed px Bottom Terminal) */}
      <div id="workbench-split-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* TOP: CODE EDITOR AREA (Flex 1 takes all remaining vertical space) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-base)',
          overflow: 'hidden',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          minHeight: '120px'
        }}>
          {/* File Tabs Strip */}
          {openedFiles.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-subtle)',
              overflowX: 'auto',
              height: '32px'
            }}>
              {openedFiles.map(f => (
                <div
                  key={f.id}
                  onClick={() => setActiveFileId(f.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 10px',
                    height: '100%',
                    background: f.id === activeFileId ? 'var(--bg-base)' : 'transparent',
                    borderRight: '1px solid var(--border-subtle)',
                    borderTop: f.id === activeFileId ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: f.id === activeFileId ? 'var(--accent)' : 'var(--text-secondary)'
                  }}
                >
                  <FileCode size={12} />
                  <span>{f.name}</span>
                  <X
                    size={11}
                    onClick={(e) => {
                      e.stopPropagation();
                      const remaining = openedFiles.filter(item => item.id !== f.id);
                      setOpenedFiles(remaining);
                      if (activeFileId === f.id && remaining.length > 0) {
                        setActiveFileId(remaining[0].id);
                      }
                    }}
                    style={{ cursor: 'pointer', opacity: 0.7 }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Editor Body: Clean Empty State OR Real Code Lines */}
          {openedFiles.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              gap: '10px'
            }}>
              <FileCode size={36} color="var(--border-strong)" />
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                未打开任何代码文件
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                从左侧【项目代码】或按 <kbd style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>Ctrl+P</kbd> 选择文件打开编辑
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', overflowY: 'auto', padding: '8px 0' }}>
              {/* Line Numbers Gutter */}
              <div style={{
                width: '42px',
                padding: '0 6px 0 0',
                textAlign: 'right',
                color: 'var(--text-muted)',
                opacity: 0.7,
                userSelect: 'none',
                borderRight: '1px solid var(--border-subtle)',
                fontSize: '11px',
                lineHeight: '20px'
              }}>
                {codeLines.map((_, idx) => (
                  <div key={idx}>{idx + 1}</div>
                ))}
              </div>

              {/* Real Code Content (With Line Highlighting & Smooth Auto-Scroll) */}
              <div ref={codeContainerRef} style={{ flex: 1, padding: '0 12px', lineHeight: '20px', userSelect: 'text', WebkitUserSelect: 'text' }}>
                {isLoadingFile ? (
                  <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>正在从磁盘加载文件...</div>
                ) : (
                  codeLines.map((line, idx) => {
                    const lineNum = idx + 1;
                    const isTargetLine = activeFile?.line === lineNum;
                    return (
                      <div
                        id={`editor-line-${lineNum}`}
                        key={idx}
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          background: isTargetLine ? 'rgba(217, 107, 39, 0.18)' : 'transparent',
                          borderLeft: isTargetLine ? '3px solid var(--accent)' : '3px solid transparent',
                          paddingLeft: '4px',
                          borderRadius: '2px',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        {line || ' '}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* DRAGGABLE RESIZE DIVIDER (Pointer Events + Double Click Reset) */}
        <div
          onPointerDown={handleSplitPointerDown}
          onPointerMove={handleSplitPointerMove}
          onPointerUp={handleSplitPointerUp}
          onDoubleClick={handleResetSplitHeight}
          title="上下拖拽调节高度 (双击恢复默认 260px)"
          style={{
            height: '6px',
            background: isDraggingSplit ? 'var(--accent)' : 'var(--border-subtle)',
            cursor: 'row-resize',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            touchAction: 'none',
            userSelect: 'none'
          }}
        >
          {isDraggingSplit && (
            <div style={{
              position: 'absolute',
              right: '12px',
              padding: '1px 6px',
              borderRadius: '3px',
              background: 'var(--accent)',
              color: '#FFF',
              fontSize: '9.5px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'none',
              zIndex: 40
            }}>
              终端 {terminalHeight}px
            </div>
          )}
        </div>

        {/* BOTTOM: INDEPENDENT TERMINAL AREA (Stable Pixel Height) */}
        <div style={{
          height: `${terminalHeight}px`,
          minHeight: '160px',
          maxHeight: '520px',
          display: 'flex',
          flexDirection: 'column',
          background: '#0D1117',
          color: '#C9D1D9',
          fontFamily: 'Consolas, Monaco, monospace',
          fontSize: '11.5px',
          overflow: 'hidden'
        }}>
          {/* Terminal Tabs Strip */}
          <div style={{
            height: '28px',
            background: '#161B22',
            borderBottom: '1px solid #30363D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', overflowX: 'auto' }}>
              {terminals.map(term => {
                const isActive = term.id === activeTerminalId;
                return (
                  <div
                    key={term.id}
                    onClick={() => setActiveTerminalId(term.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '2px 8px',
                      borderRadius: '3px 3px 0 0',
                      background: isActive ? '#0D1117' : 'transparent',
                      color: isActive ? 'var(--accent)' : '#8B949E',
                      fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer',
                      fontSize: '10.5px'
                    }}
                  >
                    <Terminal size={11} />
                    <span>{term.title}</span>
                    {terminals.length > 1 && (
                      <X
                        size={10}
                        onClick={(e) => handleCloseTerminal(term.id, e)}
                        style={{ cursor: 'pointer', opacity: 0.7 }}
                      />
                    )}
                  </div>
                );
              })}

              <button
                onClick={handleAddTerminal}
                title="新建独立 PowerShell 终端"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#8B949E',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Plus size={12} />
              </button>
            </div>

            <div style={{ fontSize: '9.5px', color: '#8B949E' }}>
              宿主引擎 · 原生 PowerShell
            </div>
          </div>

          {/* Active Terminal Logs Stream (100% Isolated per tab) */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px',
            lineHeight: 1.45,
            userSelect: 'text',
            WebkitUserSelect: 'text'
          }}>
            {activeTerminal.logs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  color: log.startsWith('PS ') ? 'var(--accent)' : log.startsWith('❌') ? '#F85149' : '#C9D1D9',
                  fontWeight: log.startsWith('PS ') ? 600 : 400,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {log}
              </div>
            ))}
            <div ref={terminalLogsEndRef} />
          </div>

          {/* Terminal Input Prompt */}
          <form
            onSubmit={handleExecuteTerminalCommand}
            style={{
              padding: '6px 12px',
              borderTop: '1px solid #30363D',
              background: '#161B22',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>❯</span>
            <input
              type="text"
              value={cmdInput}
              onChange={e => setCmdInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
                    const next = historyIndex + 1;
                    setHistoryIndex(next);
                    setCmdInput(commandHistory[next]);
                  }
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (historyIndex > 0) {
                    const prev = historyIndex - 1;
                    setHistoryIndex(prev);
                    setCmdInput(commandHistory[prev]);
                  } else if (historyIndex === 0) {
                    setHistoryIndex(-1);
                    setCmdInput('');
                  }
                }
              }}
              placeholder="输入系统终端指令 (例如: dir, git status, git log, npm test)..."
              disabled={isExecutingCmd}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#C9D1D9',
                fontFamily: 'inherit',
                fontSize: '11px'
              }}
            />
            {isExecutingCmd && <span style={{ color: 'var(--accent)', fontSize: '10px' }}>执行中...</span>}
          </form>
        </div>
      </div>
    </div>
  );
};
