import React, { useState, useEffect } from 'react';
import { Search, FileCode, ArrowRight, ChevronDown, RefreshCw } from 'lucide-react';
import { ProjectGroup } from '../../types/contracts';

interface GlobalSearchPanelProps {
  activeProject: ProjectGroup;
  projects: ProjectGroup[];
  onSelectProject: (projectId: string) => void;
  onOpenFileAndLine: (filePath: string, fileName: string, line: number) => void;
}

interface RealSearchResult {
  file: string;
  fullPath: string;
  matches: Array<{
    lineNumber: number;
    lineContent: string;
    matchRange: [number, number];
  }>;
}

export const GlobalSearchPanel: React.FC<GlobalSearchPanelProps> = ({
  activeProject,
  projects,
  onSelectProject,
  onOpenFileAndLine
}) => {
  const [query, setQuery] = useState('Tcode');
  const [results, setResults] = useState<RealSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showProjDropdown, setShowProjDropdown] = useState(false);

  const performRealSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const targetPath = activeProject?.path || 'e:/pro/agent-learning';
      const res = await fetch(`/api/fs/search?q=${encodeURIComponent(searchTerm)}&path=${encodeURIComponent(targetPath)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch (e) {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performRealSearch(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, activeProject]);

  const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            全局跨文件检索 (Real Search)
          </span>
          <button
            onClick={() => performRealSearch(query)}
            title="刷新搜索结果"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <RefreshCw size={11} className={isSearching ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Scope Dropdown */}
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
              范围: 📁 <strong>{activeProject.name}</strong>
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
                  📁 {p.name} ({p.gitBranch})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: '7px', top: '7px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="搜索代码、符号、字符串 (真实检索)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 6px 4px 24px',
              fontSize: '11px',
              borderRadius: '4px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {isSearching ? '正在扫描磁盘文件...' : `命中 ${results.length} 个文件 · ${totalMatches} 处匹配`}
        </div>
      </div>

      {/* Results List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {results.map(r => (
          <div key={r.fullPath} style={{ marginBottom: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 4px',
              fontSize: '10.5px',
              fontWeight: 600,
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)'
            }}>
              <FileCode size={11} />
              <span>{r.file}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '12px' }}>
              {r.matches.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => onOpenFileAndLine(r.fullPath, r.file.split('/').pop() || r.file, m.lineNumber)}
                  style={{
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                >
                  <span style={{ color: 'var(--accent)', minWidth: '20px' }}>:{m.lineNumber}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.lineContent}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
