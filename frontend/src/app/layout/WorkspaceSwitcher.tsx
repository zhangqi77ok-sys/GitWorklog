import React from 'react'
import { MessageSquare, Columns2, Code2 } from 'lucide-react'
import { useWorkspaceStore, WorkspaceMode } from '../../core/store/workspaceStore'

interface ModeOption {
  mode: WorkspaceMode
  label: string
  icon: React.ElementType
}

const modes: ModeOption[] = [
  { mode: 'chat', label: '沉浸对话', icon: MessageSquare },
  { mode: 'split', label: '双栏协同', icon: Columns2 },
  { mode: 'editor', label: '代码工作区', icon: Code2 }
]

export const WorkspaceSwitcher: React.FC = () => {
  const { mode, setMode } = useWorkspaceStore()

  return (
    <div className="flex items-center bg-[#EADFD7]/60 p-0.5 rounded-lg border border-[#D9D0C7]/70 select-none">
      {modes.map((item) => {
        const Icon = item.icon
        const isSelected = mode === item.mode

        return (
          <button
            key={item.mode}
            onClick={() => setMode(item.mode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
              isSelected
                ? 'bg-white text-[#2C2825] shadow-xs'
                : 'text-[#7A726B] hover:text-[#2C2825] hover:bg-white/40'
            }`}
          >
            <Icon size={13} strokeWidth={isSelected ? 2.2 : 1.8} className={isSelected ? 'text-[#D96B27]' : ''} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
