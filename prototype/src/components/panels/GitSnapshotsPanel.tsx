import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  RotateCcw,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  FileCode,
  FileDiff,
  ChevronDown,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  ShieldCheck,
  Check,
  Zap
} from 'lucide-react';
import { ProjectGroup } from '../../types/contracts';

interface GitSnapshotsPanelProps {
  activeProject: ProjectGroup;
  projects: ProjectGroup[];
  onSelectProject: (projectId: string) => void;
  onOpenFile?: (filePath: string, fileName: string) => void;
}

interface RealGitChange {
  file: string;
  status: string; // 'modified' | 'added' | 'deleted' | 'untracked'
  label: string;
  isStaged?: boolean;
}

interface RealGitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export const GitSnapshotsPanel: React.FC<GitSnapshotsPanelProps> = ({
  activeProject,
  projects,
  onSelectProject,
  onOpenFile
}) => {
  const [branch, setBranch] = useState('main');
  const [changes, setChanges] = useState<RealGitChange[]>([]);
  const [stagedChanges, setStagedChanges] = useState<RealGitChange[]>([]);
  const [commits, setCommits] = useState<RealGitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecutingGit, setIsExecutingGit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [commitInput, setCommitInput] = useState('');
  const [isChangesExpanded, setIsChangesExpanded] = useState(true);
  const [isStagedExpanded, setIsStagedExpanded] = useState(true);
  const [isAgentSnapshotsExpanded, setIsAgentSnapshotsExpanded] = useState(false);
  const [showProjDropdown, setShowProjDropdown] = useState(false);
  // Resizable Partitions (Changes, Checkpoints, Commit Log)
  const [changesPercent, setChangesPercent] = useState<number>(50);
  const [checkpointsPercent, setCheckpointsPercent] = useState<number>(20);
  const [commitsPercent, setCommitsPercent] = useState<number>(30);
  const isDraggingDivider1Ref = React.useRef(false);
  const isDraggingDivider2Ref = React.useRef(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleStartDragDivider1 = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingDivider1Ref.current = true;
    const startY = e.clientY;
    const initialChanges = changesPercent;
    const initialCheckpoints = checkpointsPercent;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingDivider1Ref.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaPercent = ((moveEvent.clientY - startY) / rect.height) * 100;
      const newChanges = Math.max(15, Math.min(70, initialChanges + deltaPercent));
      const diff = newChanges - initialChanges;
      const newCheckpoints = Math.max(10, initialCheckpoints - diff);
      setChangesPercent(Math.round(newChanges));
      setCheckpointsPercent(Math.round(newCheckpoints));
    };

    const onMouseUp = () => {
      isDraggingDivider1Ref.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleStartDragDivider2 = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingDivider2Ref.current = true;
    const startY = e.clientY;
    const initialCheckpoints = checkpointsPercent;
    const initialCommits = commitsPercent;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingDivider2Ref.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaPercent = ((moveEvent.clientY - startY) / rect.height) * 100;
      const newCheckpoints = Math.max(10, Math.min(60, initialCheckpoints + deltaPercent));
      const diff = newCheckpoints - initialCheckpoints;
      const newCommits = Math.max(10, initialCommits - diff);
      setCheckpointsPercent(Math.round(newCheckpoints));
      setCommitsPercent(Math.round(newCommits));
    };

    const onMouseUp = () => {
      isDraggingDivider2Ref.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };


  const targetPath = activeProject?.path || 'e:/pro/agent-learning';

  const fetchRealGitData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch real porcelain git status
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'git status --porcelain -b', cwd: targetPath })
      });
      const data = await res.json();

      if (data.success && data.stdout) {
        const lines = data.stdout.split('\n').filter(Boolean);
        const unstagedList: RealGitChange[] = [];
        const stagedList: RealGitChange[] = [];

        let currentBranch = 'main';

        for (const line of lines) {
          if (line.startsWith('## ')) {
            const branchInfo = line.slice(3).split('...')[0].trim();
            currentBranch = branchInfo || 'main';
            continue;
          }

          const indexStatus = line.charAt(0);
          const worktreeStatus = line.charAt(1);
          const filePath = line.slice(3).trim();

          // Staged (index has M, A, D, R)
          if (indexStatus !== ' ' && indexStatus !== '?') {
            stagedList.push({
              file: filePath,
              status: indexStatus === 'A' ? 'added' : indexStatus === 'D' ? 'deleted' : 'modified',
              label: indexStatus === 'A' ? 'A' : indexStatus === 'D' ? 'D' : 'M',
              isStaged: true
            });
          }

          // Unstaged (worktree has M, D, or untracked ??)
          if (worktreeStatus !== ' ' || indexStatus === '?') {
            unstagedList.push({
              file: filePath,
              status: indexStatus === '?' ? 'untracked' : worktreeStatus === 'D' ? 'deleted' : 'modified',
              label: indexStatus === '?' ? 'U' : worktreeStatus === 'D' ? 'D' : 'M',
              isStaged: false
            });
          }
        }

        setBranch(currentBranch);
        setChanges(unstagedList);
        setStagedChanges(stagedList);
      }

      // 2. Fetch real git log
      const resLog = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'git log -n 6 --pretty=format:"%h|%an|%ar|%s"',
          cwd: targetPath
        })
      });
      const dataLog = await resLog.json();
      if (dataLog.success && dataLog.stdout) {
        const parsedCommits = dataLog.stdout
          .split('\n')
          .filter(Boolean)
          .map((line: string) => {
            const parts = line.split('|');
            return {
              hash: parts[0] || 'head',
              author: parts[1] || 'Git',
              date: parts[2] || 'recently',
              message: parts.slice(3).join('|') || 'Commit'
            };
          });
        setCommits(parsedCommits);
      }
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRealGitData();
  }, [activeProject]);

  // Stage single file
  const handleStageFile = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsExecutingGit(true);
    try {
      await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `git add "${filePath}"`, cwd: targetPath })
      });
      setToastMessage(`✓ 已暂存: ${filePath}`);
      fetchRealGitData();
    } catch (e: any) {
      setToastMessage(`❌ 暂存失败: ${e.message}`);
    } finally {
      setIsExecutingGit(false);
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  // Unstage single file
  const handleUnstageFile = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsExecutingGit(true);
    try {
      await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `git restore --staged "${filePath}"`, cwd: targetPath })
      });
      setToastMessage(`✓ 已取消暂存: ${filePath}`);
      fetchRealGitData();
    } catch (e: any) {
      setToastMessage(`❌ 取消暂存失败: ${e.message}`);
    } finally {
      setIsExecutingGit(false);
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  // Discard changes for single file
  const handleDiscardFile = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`确认放弃对 "${filePath}" 的全部修改？此操作不可撤销。`)) return;
    setIsExecutingGit(true);
    try {
      await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `git checkout -- "${filePath}"`, cwd: targetPath })
      });
      setToastMessage(`↩ 已放弃更改: ${filePath}`);
      fetchRealGitData();
    } catch (e: any) {
      setToastMessage(`❌ 放弃更改失败: ${e.message}`);
    } finally {
      setIsExecutingGit(false);
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  // Stage All
  const handleStageAll = async () => {
    setIsExecutingGit(true);
    try {
      await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'git add -A', cwd: targetPath })
      });
      setToastMessage('✓ 已全部暂存');
      fetchRealGitData();
    } catch (e: any) {
      setToastMessage(`❌ 暂存失败: ${e.message}`);
    } finally {
      setIsExecutingGit(false);
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  // Unstage All
  const handleUnstageAll = async () => {
    setIsExecutingGit(true);
    try {
      await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'git restore --staged .', cwd: targetPath })
      });
      setToastMessage('✓ 已全部取消暂存');
      fetchRealGitData();
    } catch (e: any) {
      setToastMessage(`❌ 取消暂存失败: ${e.message}`);
    } finally {
      setIsExecutingGit(false);
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  // Commit Staged or All
  const handleCommit = async () => {
    if (!commitInput.trim() || isExecutingGit) return;
    setIsExecutingGit(true);
    const msg = commitInput.trim();
    try {
      // If nothing staged, auto stage all
      const cmd = stagedChanges.length > 0
        ? `git commit -m "${msg.replace(/"/g, '\\"')}"`
        : `git add -A && git commit -m "${msg.replace(/"/g, '\\"')}"`;

      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: targetPath })
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`✓ 成功提交: "${msg}"`);
        setCommitInput('');
        fetchRealGitData();
      } else {
        setToastMessage(`❌ 提交失败: ${data.error || data.stderr}`);
      }
    } catch (e: any) {
      setToastMessage(`❌ 提交异常: ${e.message}`);
    } finally {
      setIsExecutingGit(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handlePull = async () => {
    setIsExecutingGit(true);
    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'git pull', cwd: targetPath })
      });
      const data = await res.json();
      setToastMessage(data.success ? '✓ 成功拉取远端更新 (git pull)' : `❌ 拉取失败: ${data.error || data.stderr}`);
      fetchRealGitData();
    } catch (e: any) {
      setToastMessage(`❌ 拉取异常: ${e.message}`);
    } finally {
      setIsExecutingGit(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handlePush = async () => {
    setIsExecutingGit(true);
    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `git push origin ${branch}`, cwd: targetPath })
      });
      const data = await res.json();
      setToastMessage(data.success ? `✓ 成功推送至 origin/${branch}` : `❌ 推送失败: ${data.error || data.stderr}`);
      fetchRealGitData();
    } catch (e: any) {
      setToastMessage(`❌ 推送异常: ${e.message}`);
    } finally {
      setIsExecutingGit(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', userSelect: 'none' }}>
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '6px',
          left: '6px',
          right: '6px',
          padding: '6px 10px',
          background: toastMessage.startsWith('✓') ? '#16A34A' : '#DC2626',
          color: '#FFF',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 100
        }}>
          {toastMessage}
        </div>
      )}

      {/* VS Code / Kiro Style Header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            源代码管理 (Source Control)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={handlePull}
              title="拉取最新代码 (git pull)"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
            >
              <ArrowDown size={13} color="#16A34A" />
            </button>
            <button
              onClick={handlePush}
              title="推送本地提交 (git push)"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
            >
              <ArrowUp size={13} color="var(--accent)" />
            </button>
            <button
              onClick={fetchRealGitData}
              title="刷新 Git 状态"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Branch Pill & Project Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '10px',
            background: 'var(--accent-subtle)',
            color: 'var(--accent)',
            fontSize: '11px',
            fontWeight: 600
          }}>
            <GitBranch size={11} />
            <span>{branch}</span>
          </div>

          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            📁 {activeProject?.name || 'project'}
          </div>
        </div>

        {/* Commit Message Textarea & Action Button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <textarea
            placeholder="输入提交信息 (Ctrl+Enter 提交)..."
            value={commitInput}
            onChange={e => setCommitInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleCommit();
              }
            }}
            rows={2}
            style={{
              width: '100%',
              padding: '6px',
              fontSize: '11.5px',
              borderRadius: '4px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit'
            }}
          />
          <button
            onClick={handleCommit}
            disabled={isExecutingGit || !commitInput.trim()}
            style={{
              padding: '5px 8px',
              borderRadius: '4px',
              background: commitInput.trim() ? 'var(--accent)' : 'var(--border-subtle)',
              border: 'none',
              color: '#FFF',
              fontSize: '11px',
              fontWeight: 600,
              cursor: commitInput.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <Check size={12} />
            <span>提交 (Commit)</span>
          </button>
        </div>
      </div>

      {/* Main File Changes Tree with 3 Resizable Partitions */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', padding: '4px 8px', display: 'flex', flexDirection: 'column' }}>
        
        {/* PARTITION 1: Changes Section */}
        <div style={{ height: `${changesPercent}%`, minHeight: '60px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '4px' }}>
        
        {/* 1. Staged Changes Section */}
        {stagedChanges.length > 0 && (
          <div>
            <div
              onClick={() => setIsStagedExpanded(!isStagedExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '3px 4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-secondary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isStagedExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>已暂存的更改 (Staged Changes)</span>
                <span style={{ fontSize: '10px', color: '#16A34A' }}>({stagedChanges.length})</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleUnstageAll(); }}
                title="全部取消暂存"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
              >
                <Minus size={12} />
              </button>
            </div>

            {isStagedExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', paddingLeft: '12px' }}>
                {stagedChanges.map(c => (
                  <div
                    key={c.file}
                    onClick={() => onOpenFile && onOpenFile(c.file, c.file.split(/[/\\]/).pop() || c.file)}
                    style={{
                      padding: '3px 6px',
                      borderRadius: '3px',
                      background: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <FileCode size={12} color="#16A34A" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.file}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#16A34A' }}>{c.label}</span>
                      <button
                        onClick={(e) => handleUnstageFile(c.file, e)}
                        title="取消暂存"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
                      >
                        <Minus size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Unstaged Changes Section */}
        <div>
          <div
            onClick={() => setIsChangesExpanded(!isChangesExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '3px 4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-secondary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isChangesExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>更改 (Changes)</span>
              <span style={{ fontSize: '10px', color: changes.length > 0 ? 'var(--accent)' : '#16A34A' }}>
                ({changes.length})
              </span>
            </div>

            {changes.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleStageAll(); }}
                  title="全部暂存"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>

          {isChangesExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', paddingLeft: '12px' }}>
              {changes.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 4px' }}>
                  ✓ 工作区无任何未提交更改
                </div>
              ) : (
                changes.map(c => (
                  <div
                    key={c.file}
                    onClick={() => onOpenFile && onOpenFile(c.file, c.file.split(/[/\\]/).pop() || c.file)}
                    style={{
                      padding: '3px 6px',
                      borderRadius: '3px',
                      background: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <FileDiff size={12} color="var(--accent)" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.file}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{
                        fontSize: '9.5px',
                        fontWeight: 700,
                        color: c.label === 'M' ? 'var(--accent)' : c.label === 'U' ? '#16A34A' : '#DC2626'
                      }}>
                        {c.label}
                      </span>
                      <button
                        onClick={(e) => handleStageFile(c.file, e)}
                        title="暂存更改 (+)"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
                      >
                        <Plus size={11} />
                      </button>
                      <button
                        onClick={(e) => handleDiscardFile(c.file, e)}
                        title="放弃更改 (不可恢复)"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
                      >
                        <RotateCcw size={10} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        </div>

        {/* ↕ RESIZE DIVIDER 1 */}
        <div
          onMouseDown={handleStartDragDivider1}
          style={{
            height: '6px',
            margin: '2px 0',
            cursor: 'row-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            borderTop: '1px solid var(--border-subtle)'
          }}
          title="上下拖动调整【更改】与【安全快照】分区比例"
        >
          <div style={{ width: '24px', height: '2px', borderRadius: '1px', background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* PARTITION 2: Checkpoints Section */}
        <div style={{ height: `${checkpointsPercent}%`, minHeight: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
          <div
            onClick={() => setIsAgentSnapshotsExpanded(!isAgentSnapshotsExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '3px 4px',
              cursor: 'pointer',
              fontSize: '10.5px',
              fontWeight: 700,
              color: 'var(--text-muted)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isAgentSnapshotsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <ShieldCheck size={12} color="#16A34A" />
              <span>Agent 安全快照 (Checkpoints)</span>
            </div>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>保护中</span>
          </div>

          {isAgentSnapshotsExpanded && (
            <div style={{ padding: '6px 8px', fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>每次 Agent Run 发起前会自动建立影子快照，您可在聊天记录中点击“↩ 回到这里”无损回滚。</div>
            </div>
          )}
        </div>

        </div>

        {/* ↕ RESIZE DIVIDER 2 */}
        <div
          onMouseDown={handleStartDragDivider2}
          style={{
            height: '6px',
            margin: '2px 0',
            cursor: 'row-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            borderTop: '1px solid var(--border-subtle)'
          }}
          title="上下拖动调整【安全快照】与【提交历史】分区比例"
        >
          <div style={{ width: '24px', height: '2px', borderRadius: '1px', background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* PARTITION 3: Commit Log Section */}
        <div style={{ height: `${commitsPercent}%`, minHeight: '60px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
              提交历史 (Commit Log)
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', padding: '1px 4px', borderRadius: '3px', background: 'var(--bg-surface)' }}>
              {commitsPercent}%
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {commits.map(c => (
              <div
                key={c.hash}
                style={{
                  padding: '4px 6px',
                  borderRadius: '3px',
                  background: 'var(--bg-surface)',
                  fontSize: '10.5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: '10px' }}>
                    #{c.hash}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{c.date}</span>
                </div>
                <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.message}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
