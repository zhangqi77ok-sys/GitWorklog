import React, { useState } from 'react';
import { GitBranch, RotateCcw, Check, Clock, Plus, ShieldCheck } from 'lucide-react';
import { ShadowSnapshotItem, GitFileChange } from '../../types/contracts';

export const GitSnapshotsPanel: React.FC = () => {
  const [currentBranch, setCurrentBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const modifiedFiles: GitFileChange[] = [
    { path: 'src/components/LeftPanel.tsx', status: 'modified', additions: 42, deletions: 18 },
    { path: 'docs/PRODUCT_REQUIREMENTS_DOCUMENT.md', status: 'modified', additions: 80, deletions: 12 },
    { path: 'src/components/EditorWorkspace.tsx', status: 'modified', additions: 55, deletions: 20 }
  ];

  const [snapshots, setSnapshots] = useState<ShadowSnapshotItem[]>([
    {
      id: 'snap-3',
      timestamp: Date.now() - 300000,
      label: '编写 Store 契约与前置测试 (落盘前自动快照)',
      gitCommitHash: 'a8523ff',
      changedFilesCount: 3,
      isAiGenerated: true
    },
    {
      id: 'snap-2',
      timestamp: Date.now() - 1200000,
      label: '重构 LeftPanel 树形结构与标签管理',
      gitCommitHash: 'b9fa36d',
      changedFilesCount: 4,
      isAiGenerated: true
    },
    {
      id: 'snap-1',
      timestamp: Date.now() - 3600000,
      label: '项目三大铁律永久入库',
      gitCommitHash: 'ec0b17d',
      changedFilesCount: 3,
      isAiGenerated: false
    }
  ]);

  const handleRollback = (snap: ShadowSnapshotItem) => {
    setToastMessage(`✨ 成功还原至影子快照 [${snap.gitCommitHash}]: ${snap.label}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCommit = () => {
    if (!commitMessage.trim()) return;
    const newSnap: ShadowSnapshotItem = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label: commitMessage.trim(),
      gitCommitHash: Math.random().toString(16).substring(2, 9),
      changedFilesCount: modifiedFiles.length,
      isAiGenerated: false
    };
    setSnapshots(prev => [newSnap, ...prev]);
    setCommitMessage('');
    setToastMessage(`✓ 已创建提交并沉淀新检查点: ${newSnap.gitCommitHash}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Toast Notification */}
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
            Git 影子快照与版本感知
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
            <span>{currentBranch}</span>
          </div>
        </div>

        {/* Commit Input Box */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          <input
            type="text"
            placeholder="输入提交信息并打快照..."
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
            onClick={handleCommit}
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

      {/* Content Area: Modified Files + Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* 1. Working Changes */}
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

        {/* 2. Shadow Snapshot Timeline */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            <ShieldCheck size={13} color="var(--accent)" />
            <span>AI 自动影子检查点时间线</span>
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
