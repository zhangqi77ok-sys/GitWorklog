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
import { ProjectGroup, FileNode, getProjectWorkspaceData } from '../../types/contracts';

interface FileExplorerPanelProps {
  activeProject: ProjectGroup;
  projects: ProjectGroup[];
  onSelectProject: (projectId: string) => void;
  onOpenFile: (filePath: string, fileName: string) => void;
}

export const FileExplorerPanel: React.FC<FileExplorerPanelProps> = ({
  activeProject,
  projects,
  onSelectProject,
  onOpenFile
}) => {
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({
    'proj-1-root': true,
    'proj-2-root': true,
    'p1-src': true,
    'p1-components': true,
    'p1-types': true,
    'p1-docs': true,
    'p2-codemind': true
  });

  const [selectedFile, setSelectedFile] = useState<string>('');
  const [showProjDropdown, setShowProjDropdown] = useState(false);
  const [realTree, setRealTree] = useState<FileNode[] | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);

  // Fetch real disk tree when activeProject changes
  React.useEffect(() => {
    let isMounted = true;
    const fetchTree = async () => {
      if (!activeProject || !activeProject.path) return;
      setIsLoadingTree(true);
      try {
        const res = await fetch(`/api/fs/tree?path=${encodeURIComponent(activeProject.path)}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.tree)) {
          setRealTree(data.tree);
        }
      } catch (err) {
      } finally {
        if (isMounted) setIsLoadingTree(false);
      }
    };
    fetchTree();
    return () => { isMounted = false; };
  }, [activeProject?.path]);

  const workspaceData = getProjectWorkspaceData(activeProject.id);
  const fileTree = realTree || workspaceData.fileTree;

  const toggleDir = (dirId: string) => {
    setExpandedDirs(prev => ({ ...prev, [dirId]: !prev[dirId] }));
  };

  const renderTree = (item: FileNode, level: number = 0) => {
    const isDir = item.type === 'directory';
    const isExpanded = expandedDirs[item.id] ?? false;
    const isSelected = selectedFile === item.path;

    return (
      <div key={item.id}>
        <div
          onClick={() => {
            if (isDir) {
              toggleDir(item.id);
            } else {
              const targetPath = item.path || item.name;
              setSelectedFile(targetPath);
              onOpenFile(targetPath, item.name);
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
              ) : item.name.endsWith('.py') ? (
                <FileCode size={12} color="#F59E0B" />
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
      {/* Explorer Header with Project Selector */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            工程代码文件树
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

        {/* Active Project Switcher Capsule */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setShowProjDropdown(!showProjDropdown)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
              <Folder size={13} color="var(--accent)" />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeProject.name}</span>
              <span style={{ fontSize: '10px', color: 'var(--accent)' }}>({activeProject.gitBranch})</span>
            </div>
            <ChevronDown size={12} color="var(--text-muted)" />
          </div>

          {/* Project Dropdown */}
          {showProjDropdown && (
            <div style={{
              position: 'absolute',
              top: '28px',
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
                    fontWeight: p.id === activeProject.id ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>📁 {p.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({p.gitBranch})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tree Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 2px' }}>
        {Array.isArray(fileTree)
          ? fileTree.map(item => renderTree(item))
          : renderTree(fileTree)}
      </div>
    </div>
  );
};
