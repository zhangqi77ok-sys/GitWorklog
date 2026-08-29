import React, { useState, useEffect } from 'react';
import { GitBranch, RotateCcw, ShieldCheck, ChevronDown, RefreshCw, GitCommit, Check } from 'lucide-react';
import { ProjectGroup } from '../../types/contracts';

interface GitSnapshotsPanelProps {
  activeProject: ProjectGroup;
  projects: ProjectGroup[];
  onSelectProject: (projectId: string) => void;
}

interface RealGitChange {
  file: string;
  status: string;
  label: string;
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
  onSelectProject
}) => {
  const [branch, setBranch] = useState('main');
  const [gitChanges, setGitChanges] = useState<RealGitChange[]>([]);
  const [commits, setCommits] = useState<RealGitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showProjDropdown, setShowProjDropdown] = useState(false);

  const fetchRealGitData = async () => {
    setIsLoading(true);
    const targetPath = activeProject?.path || 'e:/pro/agent-learning';
    try {
      // 1. Fetch git status
      const resStatus = await fetch(`/api/git/status?path=${encodeURIComponent(targetPath)}`);
      const dataStatus = await resStatus.json();
      if (dataStatus.success) {
        setBranch(dataStatus.branch || 'main');
        setGitChanges(dataStatus.changes || []);
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

  const handleRollback = async (commit: RealGitCommit) => {
    setToastMessage(`✨ 正在基于快照 [${commit.hash}] 准备分支状态...`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          padding: '6px 10px',
          background: 'var(--accent)',
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

      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Git 真实仓库与快照
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--accent-subtle)',
              color: 'var(--accent)',
              fontSize: '11px',
              fontWeight: 600
            }}>
              <GitBranch size={11} />
              <span>{branch}</span>
            </div>
            <button
              onClick={fetchRealGitData}
              title="刷新 Git 状态"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
            >
              <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Project Switcher */}
        <div style={{ position: 'relative', marginBottom: '4px' }}>
          <div
            onClick={() => setShowProjDropdown(!showProjDropdown)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '3px 6px',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              工程仓库: 📁 <strong>{activeProject.name}</strong>
            </span>
            <ChevronDown size={11} color="var(--text-muted)" />
          </div>

          {showProjDropdown && (
            <div style={{
              position: 'absolute',
              top: '26px',
              left: 0,
              right: 0,
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: '4px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
              zIndex: 50,
              padding: '4px'
            }}>
              {projects.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p.id);
                    setShowProjDropdown(false);
                  }}
                  style={{
                    padding: '4px 6px',
                    borderRadius: '3px',
                    fontSize: '10.5px',
                    cursor: 'pointer',
                    color: p.id === activeProject.id ? 'var(--accent)' : 'var(--text-primary)',
                    background: p.id === activeProject.id ? 'var(--accent-subtle)' : 'transparent'
                  }}
                >
                  📁 {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body: Real Working Tree Changes & Real Git Log Snapshots */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Real Modified Files */}
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>工作区未提交变更 (Working Tree)</span>
            <span style={{ color: gitChanges.length > 0 ? 'var(--accent)' : '#16A34A' }}>
              {gitChanges.length > 0 ? `${gitChanges.length} 个文件变动` : '✓ 干净无变动'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {gitChanges.map((c, idx) => (
              <div
                key={idx}
                style={{
                  padding: '4px 6px',
                  borderRadius: '3px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{c.file}</span>
                <span style={{
                  fontSize: '9px',
                  padding: '0 4px',
                  borderRadius: '2px',
                  background: c.status === 'modified' ? 'rgba(217, 107, 39, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                  color: c.status === 'modified' ? 'var(--accent)' : '#16A34A',
                  fontWeight: 600
                }}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Real Git Commit Log Snapshots */}
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            真实 Git 提交历史 (Commit Snapshots)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {commits.map(c => (
              <div
                key={c.hash}
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10.5px', color: 'var(--accent)' }}>
                    #{c.hash}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    {c.date}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {c.message}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>by {c.author}</span>
                  <button
                    onClick={() => handleRollback(c)}
                    style={{
                      padding: '1px 6px',
                      borderRadius: '3px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-secondary)',
                      fontSize: '9.5px',
                      cursor: 'pointer'
                    }}
                  >
                    查看此快照
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
