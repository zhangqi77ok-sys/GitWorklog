import React, { useState } from 'react';
import { GitBranch, RotateCcw, ShieldCheck, ChevronDown } from 'lucide-react';
import { ProjectGroup, getProjectWorkspaceData, ShadowSnapshotItem } from '../../types/contracts';

interface GitSnapshotsPanelProps {
  activeProject: ProjectGroup;
  projects: ProjectGroup[];
  onSelectProject: (projectId: string) => void;
}

export const GitSnapshotsPanel: React.FC<GitSnapshotsPanelProps> = ({
  activeProject,
  projects,
  onSelectProject
}) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showProjDropdown, setShowProjDropdown] = useState(false);

  const workspaceData = getProjectWorkspaceData(activeProject.id);
  const modifiedFiles = workspaceData.gitChanges;
  const snapshots = workspaceData.snapshots;

  const handleRollback = (snap: ShadowSnapshotItem) => {
    setToastMessage(`✨ 成功还原 [${activeProject.name}] 至影子快照 [${snap.gitCommitHash}]: ${snap.label}`);
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
            Git 影子快照中心
          </span>
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
            <span>{activeProject.gitBranch}</span>
          </div>
        </div>

        {/* Project Switcher */}
        <div style={{ position: 'relative', marginBottom: '6px' }}>
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
                    padding: '4px 8px',
                    borderRadius: '3px',
                    background: p.id === activeProject.id ? 'var(--accent-subtle)' : 'transparent',
                    color: p.id === activeProject.id ? 'var(--accent)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  📁 {p.name} ({p.gitBranch})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commit Input Box */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            type="text"
            placeholder={`提交 ${activeProject.name} 变更并打快照...`}
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 6px',
              fontSize: '11px',
              borderRadius: '3px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <button
            onClick={() => {
              if (commitMessage.trim()) {
                setToastMessage(`✓ 已为 ${activeProject.name} 提交变更并固化检查点`);
                setCommitMessage('');
                setTimeout(() => setToastMessage(null), 3000);
              }
            }}
            disabled={!commitMessage.trim()}
            style={{
              padding: '4px 8px',
              borderRadius: '3px',
              border: 'none',
              background: 'var(--accent)',
              color: '#FFF',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            提交
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* Working Changes */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            未提交变更 ({modifiedFiles.length})
          </div>
          {modifiedFiles.map(f => (
            <div key={f.path} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '3px 4px',
              fontSize: '11px',
              borderRadius: '3px'
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {f.path.split('/').pop()}
              </span>
              <span style={{ fontSize: '10px', color: '#10B981' }}>+{f.additions}</span>
              <span style={{ fontSize: '10px', color: '#DC2626', marginLeft: '4px' }}>-{f.deletions}</span>
              <span style={{
                fontSize: '9px',
                padding: '0 3px',
                borderRadius: '2px',
                background: 'rgba(217, 107, 39, 0.15)',
                color: 'var(--accent)',
                marginLeft: '6px',
                fontWeight: 600
              }}>
                M
              </span>
            </div>
          ))}
        </div>

        {/* Shadow Timeline */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <ShieldCheck size={13} color="var(--accent)" />
            <span>{activeProject.name} 影子快照时间线</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {snapshots.map(snap => (
              <div
                key={snap.id}
                style={{
                  padding: '8px',
                  borderRadius: '5px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '11px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                    {snap.label}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    background: snap.isAiGenerated ? 'rgba(217, 107, 39, 0.15)' : 'rgba(0,0,0,0.06)',
                    color: snap.isAiGenerated ? 'var(--accent)' : 'var(--text-muted)'
                  }}>
                    {snap.isAiGenerated ? 'AI快照' : 'Commit'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>
                  <span>{snap.gitCommitHash} · {snap.changedFilesCount} 个文件</span>
                  <button
                    onClick={() => handleRollback(snap)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: 'var(--accent-subtle)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(217, 107, 39, 0.3)',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: 600
                    }}
                  >
                    <RotateCcw size={10} />
                    <span>一键还原</span>
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
