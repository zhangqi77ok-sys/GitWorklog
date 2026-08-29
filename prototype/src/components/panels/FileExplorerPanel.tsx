import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FilePlus
} from 'lucide-react';

interface FileExplorerPanelProps {
  currentProject: string;
  onOpenFile: (filePath: string, fileName: string) => void;
}

interface TreeItem {
  id: string;
  name: string;
  type: 'file' | 'dir';
  path: string;
  children?: TreeItem[];
}

export const FileExplorerPanel: React.FC<FileExplorerPanelProps> = ({
  currentProject,
  onOpenFile
}) => {
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({
    'root': true,
    'src': true,
    'src/components': true,
    'src/types': true,
    'docs': true
  });

  const [selectedFile, setSelectedFile] = useState<string>('src/types/contracts.ts');

  const fileTree: TreeItem = {
    id: 'root',
    name: currentProject,
    type: 'dir',
    path: '',
    children: [
      {
        id: 'docs',
        name: 'docs',
        type: 'dir',
        path: 'docs',
        children: [
          { id: 'prd', name: 'PRODUCT_REQUIREMENTS_DOCUMENT.md', type: 'file', path: 'docs/PRODUCT_REQUIREMENTS_DOCUMENT.md' },
          { id: 'arch', name: 'ARCHITECTURE.md', type: 'file', path: 'docs/ARCHITECTURE.md' }
        ]
      },
      {
        id: 'src',
        name: 'src',
        type: 'dir',
        path: 'src',
        children: [
          {
            id: 'src-components',
            name: 'components',
            type: 'dir',
            path: 'src/components',
            children: [
              { id: 'c-titlebar', name: 'Titlebar.tsx', type: 'file', path: 'src/components/Titlebar.tsx' },
              { id: 'c-leftpanel', name: 'LeftPanel.tsx', type: 'file', path: 'src/components/LeftPanel.tsx' },
              { id: 'c-chat', name: 'ChatColumn.tsx', type: 'file', path: 'src/components/ChatColumn.tsx' },
              { id: 'c-editor', name: 'EditorWorkspace.tsx', type: 'file', path: 'src/components/EditorWorkspace.tsx' },
              { id: 'c-options', name: 'OptionsCard.tsx', type: 'file', path: 'src/components/OptionsCard.tsx' }
            ]
          },
          {
            id: 'src-types',
            name: 'types',
            type: 'dir',
            path: 'src/types',
            children: [
              { id: 't-contracts', name: 'contracts.ts', type: 'file', path: 'src/types/contracts.ts' }
            ]
          },
          {
            id: 'src-styles',
            name: 'styles',
            type: 'dir',
            path: 'src/styles',
            children: [
              { id: 's-theme', name: 'theme.css', type: 'file', path: 'src/styles/theme.css' }
            ]
          },
          { id: 'app', name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
          { id: 'main', name: 'main.tsx', type: 'file', path: 'src/main.tsx' }
        ]
      },
      {
        id: 'tests',
        name: 'tests',
        type: 'dir',
        path: 'tests',
        children: [
          { id: 't-test', name: 'contracts.test.ts', type: 'file', path: 'tests/contracts.test.ts' }
        ]
      },
      { id: 'pkg', name: 'package.json', type: 'file', path: 'package.json' },
      { id: 'tsconf', name: 'tsconfig.json', type: 'file', path: 'tsconfig.json' },
      { id: 'viteconf', name: 'vite.config.ts', type: 'file', path: 'vite.config.ts' }
    ]
  };

  const toggleDir = (dirPath: string) => {
    setExpandedDirs(prev => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const renderTree = (item: TreeItem, level: number = 0) => {
    const isDir = item.type === 'dir';
    const isExpanded = expandedDirs[item.id] ?? false;
    const isSelected = selectedFile === item.path;

    return (
      <div key={item.id}>
        <div
          onClick={() => {
            if (isDir) {
              toggleDir(item.id);
            } else {
              setSelectedFile(item.path);
              onOpenFile(item.path, item.name);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 6px',
            paddingLeft: `${level * 12 + 6}px`,
            borderRadius: '4px',
            cursor: 'pointer',
            background: isSelected ? 'var(--accent-subtle)' : 'transparent',
            color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
            fontSize: '11px',
            fontWeight: isSelected ? 600 : (isDir ? 600 : 400),
            transition: 'background 0.1s'
          }}
        >
          {isDir ? (
            <>
              {isExpanded ? <ChevronDown size={11} color="var(--text-muted)" /> : <ChevronRight size={11} color="var(--text-muted)" />}
              {isExpanded ? <FolderOpen size={13} color="var(--accent)" /> : <Folder size={13} color="var(--accent)" />}
              <span>{item.name}</span>
            </>
          ) : (
            <>
              <span style={{ width: '11px' }} />
              {item.name.endsWith('.md') ? (
                <FileText size={12} color="#10B981" />
              ) : (
                <FileCode size={12} color={item.name.endsWith('.tsx') ? '#60A5FA' : 'var(--accent)'} />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name}
              </span>
            </>
          )}
        </div>

        {isDir && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Explorer Header Actions */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          项目代码文件树
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button title="新建文件" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
            <FilePlus size={13} />
          </button>
          <button title="新建文件夹" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
            <FolderPlus size={13} />
          </button>
          <button title="刷新树" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 2px' }}>
        {renderTree(fileTree)}
      </div>
    </div>
  );
};
