import React, { useEffect, useState } from 'react'
import { Folder, FolderOpen, FileCode, FileText, FileJson, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react'
import { useEditorStore, FileNode } from '../../core/store/editorStore'

interface TreeNodeProps {
  node: FileNode
  depth: number
}

const getFileIcon = (name: string) => {
  if (name.endsWith('.go') || name.endsWith('.rs') || name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.js')) {
    return <FileCode size={13} className="text-[#D96B27]" />
  }
  if (name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml')) {
    return <FileJson size={13} className="text-[#6D8A96]" />
  }
  return <FileText size={13} className="text-[#7A726B]" />
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth }) => {
  const [open, setOpen] = useState(depth === 0)
  const { activeFile, openFile } = useEditorStore()

  const isSelected = activeFile === node.path

  if (node.is_dir) {
    return (
      <div>
        <div
          onClick={() => setOpen(!open)}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          className="flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer text-[#2C2825] hover:bg-[#EAE2DA] text-xs transition-colors group select-none"
        >
          <span className="text-[#7A726B]">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          {open ? (
            <FolderOpen size={13} className="text-[#D96B27]" />
          ) : (
            <Folder size={13} className="text-[#D96B27]" />
          )}
          <span className="truncate font-mono text-[11px] font-medium">{node.name}</span>
        </div>

        {open && node.children && (
          <div className="flex flex-col">
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => openFile(node.path)}
      style={{ paddingLeft: `${depth * 12 + 18}px` }}
      className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer text-xs transition-colors select-none ${
        isSelected
          ? 'bg-[#FAF2EC] text-[#D96B27] font-semibold border-r-2 border-[#D96B27]'
          : 'text-[#2C2825] hover:bg-[#EAE2DA]'
      }`}
    >
      {getFileIcon(node.name)}
      <span className="truncate font-mono text-[11px]">{node.name}</span>
    </div>
  )
}

export const FileTree: React.FC = () => {
  const { fileTree, isTreeLoading, fetchTree } = useEditorStore()

  useEffect(() => {
    fetchTree()
  }, [fetchTree])

  return (
    <div className="w-56 bg-[#F4EFEA] border-r border-[#EADFD7] flex flex-col h-full select-none shrink-0">
      {/* 顶部标题与刷新 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#EADFD7]">
        <span className="text-[11px] font-semibold uppercase text-[#7A726B] tracking-wider">
          工作区资源树 (EXPLORER)
        </span>
        <button
          onClick={() => fetchTree()}
          title="刷新文件树"
          className="p-1 text-[#7A726B] hover:text-[#D96B27] rounded hover:bg-[#EADFD7]"
        >
          <RefreshCw size={12} className={isTreeLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 目录树展示 */}
      <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5">
        {fileTree.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[11px] text-[#7A726B]">
            {isTreeLoading ? '加载中...' : '空工作区'}
          </div>
        ) : (
          fileTree.map((n) => <TreeNode key={n.path} node={n} depth={0} />)
        )}
      </div>
    </div>
  )
}
