import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Play, RotateCcw, Search, ChevronRight, ChevronDown, Bug, FileCode, Terminal } from 'lucide-react';

export interface TestCaseItem {
  id: string;
  name: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  durationMs?: number;
  filePath?: string;
  lineNumber?: number;
  errorMessage?: string;
  stackTrace?: string;
}

export interface TestExplorerProps {
  testCases: TestCaseItem[];
  isRunningAll?: boolean;
  onRunAllTests?: () => void;
  onRunFailedTests?: () => void;
  onRunSingleTest?: (test: TestCaseItem) => void;
  onNavigateToCode?: (filePath: string, lineNumber?: number) => void;
  onAutoFixTest?: (test: TestCaseItem) => void;
}

export const TestExplorer: React.FC<TestExplorerProps> = ({
  testCases,
  isRunningAll = false,
  onRunAllTests,
  onRunFailedTests,
  onRunSingleTest,
  onNavigateToCode,
  onAutoFixTest
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'failed' | 'passed'>('all');
  const [expandedTestIds, setExpandedTestIds] = useState<Record<string, boolean>>({});

  const passedCount = testCases.filter(t => t.status === 'passed').length;
  const failedCount = testCases.filter(t => t.status === 'failed').length;
  const skippedCount = testCases.filter(t => t.status === 'skipped').length;
  const totalCount = testCases.length;

  const filteredTests = testCases
    .filter(t => {
      if (selectedFilter === 'passed') return t.status === 'passed';
      if (selectedFilter === 'failed') return t.status === 'failed';
      return true;
    })
    .filter(t => !filterQuery || t.name.toLowerCase().includes(filterQuery.toLowerCase()) || (t.filePath && t.filePath.toLowerCase().includes(filterQuery.toLowerCase())));

  const toggleExpand = (id: string) => {
    setExpandedTestIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px'
    }}>
      {/* 1. Header Toolbar */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--text-primary)' }}>
            🧪 测试资源管理器
          </span>
          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: failedCount > 0 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(22, 163, 74, 0.1)', color: failedCount > 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
            {passedCount}/{totalCount} 通过
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {failedCount > 0 && onRunFailedTests && (
            <button
              onClick={onRunFailedTests}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'rgba(220, 38, 38, 0.12)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                color: '#DC2626',
                fontSize: '10.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="单独重新运行所有失败用例"
            >
              <RotateCcw size={11} />
              <span>重跑失败用例 ({failedCount})</span>
            </button>
          )}

          {onRunAllTests && (
            <button
              onClick={onRunAllTests}
              disabled={isRunningAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--accent)',
                border: 'none',
                color: '#FFF',
                fontSize: '10.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Play size={11} />
              <span>{isRunningAll ? '执行中...' : '运行全部测试'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter & Search Strip */}
      <div style={{
        padding: '6px 12px',
        background: 'var(--bg-surface-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={12} style={{ position: 'absolute', left: '6px', top: '6px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="过滤测试用例名称或文件路径..."
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '3px 6px 3px 22px',
              fontSize: '11px',
              borderRadius: '4px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-base)', padding: '2px', borderRadius: '4px' }}>
          <button
            onClick={() => setSelectedFilter('all')}
            style={{
              padding: '2px 6px',
              border: 'none',
              borderRadius: '3px',
              background: selectedFilter === 'all' ? 'var(--accent-subtle)' : 'transparent',
              color: selectedFilter === 'all' ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '10px',
              fontWeight: selectedFilter === 'all' ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            全部 ({totalCount})
          </button>
          <button
            onClick={() => setSelectedFilter('failed')}
            style={{
              padding: '2px 6px',
              border: 'none',
              borderRadius: '3px',
              background: selectedFilter === 'failed' ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
              color: selectedFilter === 'failed' ? '#DC2626' : 'var(--text-muted)',
              fontSize: '10px',
              fontWeight: selectedFilter === 'failed' ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            失败 ({failedCount})
          </button>
          <button
            onClick={() => setSelectedFilter('passed')}
            style={{
              padding: '2px 6px',
              border: 'none',
              borderRadius: '3px',
              background: selectedFilter === 'passed' ? 'rgba(22, 163, 74, 0.15)' : 'transparent',
              color: selectedFilter === 'passed' ? '#16A34A' : 'var(--text-muted)',
              fontSize: '10px',
              fontWeight: selectedFilter === 'passed' ? 700 : 500,
              cursor: 'pointer'
            }}
          >
            通过 ({passedCount})
          </button>
        </div>
      </div>

      {/* 3. Test Cases List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {filteredTests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
            没有匹配的测试用例
          </div>
        ) : (
          filteredTests.map(tc => {
            const isExp = !!expandedTestIds[tc.id];
            const isFailed = tc.status === 'failed';

            return (
              <div
                key={tc.id}
                style={{
                  borderRadius: '6px',
                  border: isFailed ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid var(--border-subtle)',
                  background: isFailed ? 'rgba(220, 38, 38, 0.03)' : 'var(--bg-surface)',
                  overflow: 'hidden',
                  transition: 'all 0.12s ease'
                }}
              >
                <div
                  onClick={() => toggleExpand(tc.id)}
                  style={{
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
                    {tc.status === 'passed' && <CheckCircle2 size={13} color="#16A34A" />}
                    {tc.status === 'failed' && <XCircle size={13} color="#DC2626" />}
                    {tc.status === 'skipped' && <Clock size={13} color="var(--text-muted)" />}
                    {tc.status === 'running' && <Play size={13} color="var(--accent)" className="animate-spin" />}

                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '11.5px', color: isFailed ? '#DC2626' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tc.name}
                      </div>
                      {tc.filePath && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {tc.filePath}{tc.lineNumber ? `:${tc.lineNumber}` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {tc.durationMs !== undefined && (
                      <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                        {tc.durationMs}ms
                      </span>
                    )}

                    {onRunSingleTest && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRunSingleTest(tc);
                        }}
                        style={{
                          padding: '2px 5px',
                          borderRadius: '3px',
                          background: 'transparent',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontSize: '9.5px'
                        }}
                        title="单跑此测试"
                      >
                        <Play size={9} />
                        <span>重跑</span>
                      </button>
                    )}

                    {isExp ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />}
                  </div>
                </div>

                {/* Expanded Error Details and Quick Navigation Actions */}
                {isExp && (
                  <div style={{
                    padding: '8px 10px',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-base)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {tc.errorMessage && (
                      <div style={{ color: '#DC2626', fontWeight: 600, marginBottom: '6px' }}>
                        ✕ {tc.errorMessage}
                      </div>
                    )}

                    {tc.stackTrace && (
                      <pre style={{
                        margin: '4px 0 8px',
                        padding: '6px',
                        borderRadius: '4px',
                        background: 'rgba(0,0,0,0.06)',
                        color: 'var(--text-secondary)',
                        fontSize: '10px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxHeight: '140px',
                        overflowY: 'auto'
                      }}>
                        {tc.stackTrace}
                      </pre>
                    )}

                    {/* Action Bar: Navigate to Code / Auto-Fix with Agent */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      {tc.filePath && onNavigateToCode && (
                        <button
                          onClick={() => onNavigateToCode(tc.filePath!, tc.lineNumber)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'var(--bg-surface-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <FileCode size={11} color="var(--accent)" />
                          <span>定位测试代码 ({tc.filePath.split(/[\\/]/).pop()}:{tc.lineNumber || 1})</span>
                        </button>
                      )}

                      {isFailed && onAutoFixTest && (
                        <button
                          onClick={() => onAutoFixTest(tc)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'rgba(217, 107, 39, 0.12)',
                            border: '1px solid var(--accent)',
                            color: 'var(--accent)',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Bug size={11} />
                          <span>让 Agent 定位根因并修复</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
