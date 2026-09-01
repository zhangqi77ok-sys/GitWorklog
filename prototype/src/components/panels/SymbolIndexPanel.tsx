import React, { useState, useEffect, useTransition } from 'react';
import {
  semanticIndexService,
  SymbolItem,
  SymbolSubgraphResponse,
  IndexStatusResponse,
} from '../../services/semanticIndexService';
import {
  Network,
  Search,
  RefreshCw,
  FileCode,
  CornerDownRight,
  GitFork,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Database,
  Hash,
} from 'lucide-react';

interface SymbolIndexPanelProps {
  onOpenFile?: (path: string, fileName?: string, line?: number) => void;
}

const KIND_OPTIONS = ['All', 'Class', 'Function', 'Method', 'Interface', 'Type'];

export const SymbolIndexPanel: React.FC<SymbolIndexPanelProps> = ({ onOpenFile }) => {
  const [query, setQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState('All');
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<IndexStatusResponse | null>(null);
  const [activeSubgraphId, setActiveSubgraphId] = useState<number | null>(null);
  const [subgraphData, setSubgraphData] = useState<SymbolSubgraphResponse | null>(null);
  const [loadingSubgraph, setLoadingSubgraph] = useState(false);

  const [, startTransition] = useTransition();

  useEffect(() => {
    refreshStatus();
    loadSymbols('', 'All');
  }, []);

  const refreshStatus = async () => {
    const st = await semanticIndexService.getStatus();
    setStatus(st);
  };

  const loadSymbols = async (q: string, k: string) => {
    setLoading(true);
    const results = await semanticIndexService.searchSymbols(q || 'a', k === 'All' ? undefined : k, 40);
    startTransition(() => {
      setSymbols(results);
      setLoading(false);
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    loadSymbols(val, selectedKind);
  };

  const handleKindSelect = (k: string) => {
    setSelectedKind(k);
    loadSymbols(query, k);
  };

  const handleSync = async () => {
    setSyncing(true);
    await semanticIndexService.syncWorkspaceIndex(false);
    await refreshStatus();
    await loadSymbols(query, selectedKind);
    setSyncing(false);
  };

  const toggleSubgraph = async (sym: SymbolItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeSubgraphId === sym.id) {
      setActiveSubgraphId(null);
      setSubgraphData(null);
      return;
    }
    setActiveSubgraphId(sym.id);
    setLoadingSubgraph(true);
    const data = await semanticIndexService.fetchSubgraph(sym.id, 2);
    setSubgraphData(data);
    setLoadingSubgraph(false);
  };

  const handleSymbolClick = (sym: SymbolItem) => {
    if (onOpenFile) {
      const fileName = sym.file_path.split('/').pop() || sym.file_path;
      onOpenFile(sym.file_path, fileName, sym.range_start_line);
    }
  };

  const handleCallerCalleeClick = (filePath: string, line: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenFile) {
      const fileName = filePath.split('/').pop() || filePath;
      onOpenFile(filePath, fileName, line);
    }
  };

  const getKindColor = (kind: string) => {
    switch (kind.toLowerCase()) {
      case 'class':
        return { bg: 'rgba(217, 107, 39, 0.12)', text: 'var(--accent-orange)', border: 'rgba(217, 107, 39, 0.3)' };
      case 'function':
      case 'method':
        return { bg: 'rgba(37, 99, 235, 0.1)', text: '#2563EB', border: 'rgba(37, 99, 235, 0.25)' };
      case 'interface':
      case 'type':
        return { bg: 'rgba(124, 58, 237, 0.1)', text: '#7C3AED', border: 'rgba(124, 58, 237, 0.25)' };
      default:
        return { bg: 'rgba(120, 113, 108, 0.1)', text: '#57534E', border: 'rgba(120, 113, 108, 0.2)' };
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
        userSelect: 'none',
        fontSize: '12px',
        color: 'var(--text-primary)',
      }}
    >
      {/* 顶部 Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
            <Network size={15} color="var(--accent-orange)" />
            <span>LSP 语义拓扑索引</span>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              background: 'var(--accent-orange)',
              color: '#FFFFFF',
              border: 'none',
              cursor: syncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: syncing ? 0.6 : 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
            title="增量扫描工作区文件并更新 SQLite 符号索引"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? '扫描中...' : '增量同步'}</span>
          </button>
        </div>

        {/* 统计概览微型卡片 */}
        {status && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '4px',
              padding: '6px 8px',
              background: 'var(--bg-base)',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-tertiary)' }}>文件</span>
              <strong style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{status.total_files}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-tertiary)' }}>符号</span>
              <strong style={{ fontSize: '11px', color: 'var(--accent-orange)' }}>{status.total_symbols}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-tertiary)' }}>引用</span>
              <strong style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{status.total_references}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-tertiary)' }}>库容</span>
              <strong style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                {(status.db_size_bytes / 1024).toFixed(0)}KB
              </strong>
            </div>
          </div>
        )}

        {/* 搜索框 */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search
            size={13}
            color="var(--text-tertiary)"
            style={{ position: 'absolute', left: '8px', top: '7px' }}
          />
          <input
            type="text"
            value={query}
            onChange={handleSearchChange}
            placeholder="全文检索符号 / 类 / 函数 (FTS5)..."
            style={{
              width: '100%',
              padding: '5px 8px 5px 26px',
              fontSize: '11.5px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '5px',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 分类过滤 Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
          {KIND_OPTIONS.map((k) => {
            const active = selectedKind === k;
            return (
              <button
                key={k}
                onClick={() => handleKindSelect(k)}
                style={{
                  padding: '2px 8px',
                  fontSize: '10.5px',
                  borderRadius: '12px',
                  border: active ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
                  background: active ? 'rgba(217, 107, 39, 0.12)' : 'var(--bg-base)',
                  color: active ? 'var(--accent-orange)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>

      {/* 符号列表内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '11px' }}>
            正在检索 FTS5 语义符号库...
          </div>
        )}

        {!loading && symbols.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '30px 12px',
              color: 'var(--text-tertiary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Database size={24} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: '11.5px' }}>未检索到匹配符号</span>
            <span style={{ fontSize: '10.5px' }}>点击上方「增量同步」建立当前项目代码索引</span>
          </div>
        )}

        {!loading &&
          symbols.map((sym) => {
            const kindStyle = getKindColor(sym.kind);
            const isExpanded = activeSubgraphId === sym.id;

            return (
              <div
                key={sym.id}
                onClick={() => handleSymbolClick(sym)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: isExpanded ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span
                      style={{
                        padding: '1px 5px',
                        fontSize: '9.5px',
                        fontWeight: 700,
                        borderRadius: '3px',
                        background: kindStyle.bg,
                        color: kindStyle.text,
                        border: `1px solid ${kindStyle.border}`,
                        flexShrink: 0,
                      }}
                    >
                      {sym.kind}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '11.5px',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sym.name}
                    </span>
                  </div>

                  <button
                    onClick={(e) => toggleSubgraph(sym, e)}
                    style={{
                      padding: '2px 5px',
                      fontSize: '10px',
                      borderRadius: '3px',
                      border: '1px solid var(--border-subtle)',
                      background: isExpanded ? 'rgba(217, 107, 39, 0.12)' : 'var(--bg-base)',
                      color: isExpanded ? 'var(--accent-orange)' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title="查看 1~2 Hop 递归调用拓扑"
                  >
                    <GitFork size={10} />
                    <span>拓扑</span>
                  </button>
                </div>

                {/* 签名摘要 */}
                {sym.signature && (
                  <div
                    style={{
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-base)',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sym.signature}
                  </div>
                )}

                {/* 文件路径与行号直达 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sym.file_path}
                  </span>
                  <span style={{ fontFamily: 'monospace', flexShrink: 0 }}>L{sym.range_start_line}</span>
                </div>

                {/* 展开的 2-Hop 依赖子图 */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: '4px',
                      paddingTop: '6px',
                      borderTop: '1px dashed var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {loadingSubgraph && (
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        递归解析调用拓扑中...
                      </div>
                    )}

                    {!loadingSubgraph && subgraphData && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {/* Callers 上游调用者 */}
                        <div>
                          <div
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: 'var(--accent-orange)',
                              marginBottom: '2px',
                            }}
                          >
                            ▲ 上游调用方 ({subgraphData.callers.length})
                          </div>
                          {subgraphData.callers.length === 0 ? (
                            <div style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', paddingLeft: '8px' }}>
                              暂无上游直接调用
                            </div>
                          ) : (
                            subgraphData.callers.map((c, i) => (
                              <div
                                key={i}
                                onClick={(e) => handleCallerCalleeClick(c.file_path, c.range_start_line, e)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  fontFamily: 'monospace',
                                  color: 'var(--text-primary)',
                                  background: 'var(--bg-base)',
                                  borderRadius: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  marginBottom: '2px',
                                }}
                              >
                                <span>{c.name}</span>
                                <span style={{ color: 'var(--text-tertiary)', fontSize: '9px' }}>
                                  L{c.range_start_line}
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Callees 下游依赖 */}
                        <div>
                          <div
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#2563EB',
                              marginBottom: '2px',
                            }}
                          >
                            ▼ 下游调用 ({subgraphData.callees.length})
                          </div>
                          {subgraphData.callees.length === 0 ? (
                            <div style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', paddingLeft: '8px' }}>
                              暂无下游调用
                            </div>
                          ) : (
                            subgraphData.callees.map((c, i) => (
                              <div
                                key={i}
                                onClick={(e) => handleCallerCalleeClick(c.file_path, c.range_start_line, e)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  fontFamily: 'monospace',
                                  color: 'var(--text-primary)',
                                  background: 'var(--bg-base)',
                                  borderRadius: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  marginBottom: '2px',
                                }}
                              >
                                <span>{c.name}</span>
                                <span style={{ color: 'var(--text-tertiary)', fontSize: '9px' }}>
                                  L{c.range_start_line}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};
