import React, { useState } from 'react'
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, RefreshCw, FolderPlus } from 'lucide-react'
import { useWorkspaceStore, FileNode } from '../../core/store/workspaceStore'

interface FileTreeItemProps {
  node: FileNode
  depth?: number
  onSelectFile?: (file: FileNode) => void
}

function getFileIcon(name: string) {
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return <span className="text-[#3178C6] font-mono font-bold text-[10px]">TS</span>
  if (name.endsWith('.js') || name.endsWith('.jsx')) return <span className="text-[#F7DF1E] font-mono font-bold text-[10px]">JS</span>
  if (name.endsWith('.py')) return <span className="text-[#3776AB] font-mono font-bold text-[10px]">PY</span>
  if (name.endsWith('.json')) return <span className="text-amber-600 font-mono font-bold text-[10px]">{}</span>
  if (name.endsWith('.md')) return <span className="text-blue-500 font-mono font-bold text-[10px]">M↓</span>
  if (name.endsWith('.css')) return <span className="text-sky-500 font-mono font-bold text-[10px]">#</span>
  return <FileText size={13} className="text-[#71717A]" />
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, depth = 0, onSelectFile }) => {
  const [isOpen, setIsOpen] = useState(false)

  if (node.isDirectory) {
    return (
      <div className="select-none">
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className="flex items-center gap-1.5 py-1 pr-2 rounded hover:bg-black/[0.04] cursor-pointer text-xs text-[#27272A] group transition-colors"
        >
          {isOpen ? (
            <ChevronDown size={13} className="text-[#71717A] shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-[#71717A] shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen size={14} className="text-[#D96B27] shrink-0" />
          ) : (
            <Folder size={14} className="text-[#D96B27] shrink-0" />
          )}
          <span className="truncate font-medium group-hover:text-[#18181B]">{node.name}</span>
        </div>
        {isOpen && node.children && node.children.length > 0 && (
          <div className="border-l border-black/[0.04] ml-3">
            {node.children.map((child) => (
              <FileTreeItem key={child.path} node={child} depth={depth + 1} onSelectFile={onSelectFile} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => onSelectFile?.(node)}
      style={{ paddingLeft: `${depth * 14 + 20}px` }}
      className="flex items-center gap-1.5 py-1 pr-2 rounded hover:bg-white hover:shadow-2xs cursor-pointer text-xs text-[#52525B] hover:text-[#18181B] group transition-all"
    >
      <div className="w-3.5 flex items-center justify-center shrink-0">
        {getFileIcon(node.name)}
      </div>
      <span className="truncate font-mono text-[11px] group-hover:font-semibold">{node.name}</span>
    </div>
  )
}

export const FileTreeView: React.FC = () => {
  const { projectName, projectPath, fileTree, isFolderPickerLoading, openNativeFolderPicker, fetchWorkspaceInfo } =
    useWorkspaceStore()

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none">
      {/* 文件抽屉顶栏 */}
      <div className="p-2.5 border-b border-black/[0.06] bg-[#EFEAE4] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#18181B] flex items-center gap-1.5">
            <span>📁</span>
            <span>资源管理器</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openNativeFolderPicker()}
              disabled={isFolderPickerLoading}
              title="打开本地项目文件夹 (Windows 原生对话框)"
              className="p-1 rounded text-[#71717A] hover:text-[#D96B27] hover:bg-black/[0.05] transition-all cursor-pointer disabled:opacity-50"
            >
              <FolderPlus size={13} />
            </button>
            <button
              onClick={() => fetchWorkspaceInfo()}
              title="刷新文件资源树"
              className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.05] transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={isFolderPickerLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* 当前项目与原生打开胶囊 */}
        <div
          onClick={() => openNativeFolderPicker()}
          title={`当前目录: ${projectPath}\n点击唤起 Windows 资源管理器选择新目录`}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white hover:border-[#D96B27]/50 border border-black/[0.08] shadow-2xs text-xs cursor-pointer transition-all group"
        >
          <div className="flex items-center gap-1.5 truncate">
            <FolderOpen size={13} className="text-[#D96B27] shrink-0" />
            <span className="font-mono font-semibold text-[#18181B] truncate group-hover:text-[#D96B27] transition-colors">
              {projectName || '未打开项目'}
            </span>
          </div>
          <span className="text-[10px] text-[#71717A] group-hover:text-[#D96B27] shrink-0">更换 ▾</span>
        </div>
      </div>

      {/* 目录列表 */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {isFolderPickerLoading ? (
          <div className="p-4 text-center text-xs text-[#71717A] space-y-2">
            <div className="animate-spin w-4 h-4 border-2 border-[#D96B27] border-t-transparent rounded-full mx-auto" />
            <p>正在唤起 Windows 原生文件夹选择器...</p>
          </div>
        ) : fileTree.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#71717A] space-y-3">
            <div className="text-2xl">📂</div>
            <p className="text-[11px] leading-relaxed">当前目录无文件或尚未载入项目</p>
            <button
              onClick={() => openNativeFolderPicker()}
              className="px-3 py-1.5 rounded-lg bg-[#18181B] text-white text-[11px] font-medium hover:bg-[#D96B27] transition-all cursor-pointer shadow-2xs"
            >
              选择本地项目文件夹
            </button>
          </div>
        ) : (
          fileTree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              onSelectFile={(file) => {
                console.log('Selected file:', file.relPath)
              }}
            />
          ))
        )}
      </div>

      {/* 底部当前物理绝对路径 */}
      <div className="p-2 border-t border-black/[0.06] bg-[#EFEAE4] text-[10px] font-mono text-[#71717A] truncate">
        <span className="truncate" title={projectPath}>
          {projectPath}
        </span>
      </div>
    </div>
  )
}
