import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, FileCode, ArrowRight } from 'lucide-react';
import { filterFilesByQuery, SearchResultFile } from '../../types/contracts';

interface GlobalSearchPanelProps {
  onOpenFileAndLine: (filePath: string, fileName: string, line: number) => void;
}

export const GlobalSearchPanel: React.FC<GlobalSearchPanelProps> = ({ onOpenFileAndLine }) => {
  const [query, setQuery] = useState('GatewayBus');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  // Mock workspace file contents
  const mockFiles = [
    {
      path: 'src/types/contracts.ts',
      content: `export type SessionTier1Type = 'global' | 'project';\nexport interface SessionItem {\nid: string;\ntitle: string;\n}\nexport class GatewayBus {\n  dispatch() {}\n}`
    },
    {
      path: 'src/components/LeftPanel.tsx',
      content: `import { SessionItem } from '../types/contracts';\n// GatewayBus listener attached for real-time events\nexport const LeftPanel = () => {};`
    },
    {
      path: 'docs/PRODUCT_REQUIREMENTS_DOCUMENT.md',
      content: `GatewayBus 核心总线调度中枢\n单例调度总线 GatewayBus`
    }
  ];

  const results: SearchResultFile[] = filterFilesByQuery(query, mockFiles);
  const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          全局跨文件检索
        </span>
        {/* Search Input with options */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'var(--bg-surface)',
          borderRadius: '4px',
          border: '1px solid var(--border-strong)',
          padding: '2px 6px',
          marginTop: '6px'
        }}>
          <Search size={13} color="var(--text-muted)" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索符号、文本或类名..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              fontSize: '11px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          {/* Toggles */}
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            style={{
              background: caseSensitive ? 'var(--accent)' : 'transparent',
              color: caseSensitive ? '#FFF' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '2px',
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 3px',
              cursor: 'pointer'
            }}
          >
            Aa
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            style={{
              background: useRegex ? 'var(--accent)' : 'transparent',
              color: useRegex ? '#FFF' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '2px',
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 3px',
              cursor: 'pointer'
            }}
          >
            .*
          </button>
        </div>

        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{totalMatches} 个匹配结果 ({results.length} 个文件)</span>
        </div>
      </div>

      {/* Search Results List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {results.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
            未找到包含 "{query}" 的匹配项
          </div>
        ) : (
          results.map(fileRes => (
            <div key={fileRes.filePath} style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
                fontSize: '11px',
                color: 'var(--text-primary)',
                padding: '2px 4px',
                background: 'rgba(0,0,0,0.02)',
                borderRadius: '3px'
              }}>
                <FileCode size={12} color="var(--accent)" />
                <span>{fileRes.fileName}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({fileRes.matches.length})</span>
              </div>

              <div style={{ paddingLeft: '12px', marginTop: '2px' }}>
                {fileRes.matches.map(m => (
                  <div
                    key={m.lineNumber}
                    onClick={() => onOpenFileAndLine(fileRes.filePath, fileRes.fileName, m.lineNumber)}
                    style={{
                      padding: '3px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', width: '20px', textAlign: 'right' }}>{m.lineNumber}:</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {m.lineContent}
                    </span>
                    <ArrowRight size={10} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
