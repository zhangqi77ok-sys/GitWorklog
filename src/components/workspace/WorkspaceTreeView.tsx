import React, { useState } from 'react';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useWorkspaceStore, FileNode } from '../../store/useWorkspaceStore';

interface WorkspaceTreeViewProps {
  rootNode: FileNode | null;
}

export const WorkspaceTreeView: React.FC<WorkspaceTreeViewProps> = ({ rootNode }) => {
  const { openFile } = useWorkspaceStore();

  if (!rootNode) {
    return (
      <div className="p-4 text-xs text-[#8A847C] text-center italic">
        未挂载工作区目录
      </div>
    );
  }

  if (!rootNode.children || rootNode.children.length === 0) {
    return (
      <div className="p-4 text-xs text-[#8A847C] text-center italic">
        该目录为空
      </div>
    );
  }

  return (
    <div className="text-xs select-none space-y-0.5">
      {rootNode.children.map(child => (
        <TreeNode key={child.path} node={child} depth={0} onSelect={openFile} />
      ))}
    </div>
  );
};

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  onSelect: (path: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, onSelect }) => {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const isDir = node.is_dir;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDir) {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className="flex items-center gap-1.5 py-1 pr-2 rounded hover:bg-[#EAE4DC] text-[#3D3A36] hover:text-[#1E1C1A] cursor-pointer transition-colors group"
      >
        {isDir ? (
          <>
            {isOpen ? (
              <ChevronDown className="w-3 h-3 text-[#8A847C] flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#8A847C] flex-shrink-0" />
            )}
            {isOpen ? (
              <FolderOpen className="w-3.5 h-3.5 text-[#D96B27] flex-shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-[#8A847C] group-hover:text-[#D96B27] flex-shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 flex-shrink-0" />
            <FileText className="w-3.5 h-3.5 text-[#6B665F] group-hover:text-[#1E1C1A] flex-shrink-0" />
          </>
        )}
        <span className="truncate flex-1 font-mono text-[11px]">{node.name}</span>
      </div>

      {isDir && isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.path} node={child} depth={depth + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};
