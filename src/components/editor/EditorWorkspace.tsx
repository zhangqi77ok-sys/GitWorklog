import React, { useState } from 'react';
import { FileCode, Play, Save, CheckCircle2 } from 'lucide-react';

interface EditorWorkspaceProps {
  activeFile?: string;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({ activeFile = 'src/App.tsx' }) => {
  const [content, setContent] = useState<string>(`// Tcode Next-Gen Workspace
// Integrated with Rust Core & Pluggable Capability Rails

export function App() {
  return (
    <div className="workbench">
      <h1>Tcode Next-Gen IDE</h1>
    </div>
  );
}
`);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-base)',
        borderLeft: '1px solid var(--border-subtle)',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          height: '36px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          gap: '4px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px 6px 0 0',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          <FileCode size={13} color="var(--accent)" />
          <span>{activeFile}</span>
        </div>
      </div>

      {/* Editor Body */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--chat-code-bg)',
            color: '#F3F4F6',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: 1.6,
            padding: '16px',
            border: 'none',
            outline: 'none',
            resize: 'none',
          }}
        />
      </div>

      {/* Editor Status Bar */}
      <div
        style={{
          height: '24px',
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={12} color="var(--status-safe)" />
          <span>LSP: Ready</span>
          <span>UTF-8</span>
          <span>TypeScript / React</span>
        </div>
        <div>
          <span>Lines: {content.split('\n').length}</span>
        </div>
      </div>
    </div>
  );
};
