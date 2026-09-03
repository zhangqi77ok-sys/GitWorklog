import React from 'react'
import { DiffEditor, Editor } from '@monaco-editor/react'
import { Check, X, Maximize2, Minimize2 } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useEditorStore } from '../../core/store/editorStore'
import { useGitStore } from '../../core/store/gitStore'

const getLanguageFromPath = (path: string): string => {
  if (path.endsWith('.go')) return 'go'
  if (path.endsWith('.rs')) return 'rust'
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript'
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.md')) return 'markdown'
  if (path.endsWith('.html')) return 'html'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml'
  return 'plaintext'
}

export const CodeWorkspace: React.FC = () => {
  const {
    isCodeWorkspaceOpen,
    isCodeMaximized,
    toggleCodeMaximize,
    toggleCodeWorkspace,
  } = useWorkspaceStore()

  const { activeFile, activeContent, originalContent, isDiffMode, setContent } = useEditorStore()
  const { stageFile, restoreFile } = useGitStore()

  if (!isCodeWorkspaceOpen) return null

  const language = activeFile ? getLanguageFromPath(activeFile) : 'go'
  const displayFile = activeFile || 'backend/main.go'

  return (
    <section
      className={`bg-[#1E1C1A] text-white flex flex-col border-l border-black/[0.12] transition-all duration-200 select-none overflow-hidden ${
        isCodeMaximized ? 'flex-1 w-full' : 'w-[480px] min-w-[340px] max-w-[700px]'
      }`}
    >
      {/* 顶栏控制条 */}
      <div className="h-9 bg-[#161412] border-b border-white/[0.08] flex items-center justify-between px-3 shrink-0 select-none">
        <div className="flex items-center gap-1.5 text-xs font-mono truncate">
          <span className="text-[#D96B27]">📄</span>
          <span className="font-medium text-white/90 truncate max-w-[200px]">{displayFile}</span>
          <span className="text-[10px] text-[#10A37F] bg-[#10A37F]/20 px-1.5 py-0.2 rounded font-sans shrink-0">
            {isDiffMode ? 'Diff 审查中' : '代码编辑'}
          </span>
        </div>

        {/* 右侧动作按键组 */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={async () => {
              if (activeFile) {
                await restoreFile(activeFile)
              }
            }}
            title="放弃此修改"
            className="px-2 py-0.5 rounded text-[10px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            ✕ 放弃
          </button>

          <button
            onClick={async () => {
              if (activeFile) {
                await stageFile(activeFile)
              }
            }}
            title="一键将变更加入 Git 暂存区"
            className="px-2 py-0.5 rounded text-[10px] font-medium text-white bg-[#10A37F] hover:bg-[#0E906F] transition-all cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <Check size={11} strokeWidth={3} />
            <span>一键采纳</span>
          </button>

          <div className="h-3 w-[1px] bg-white/15 mx-1" />

          {/* 全屏/分屏切换按钮 */}
          <button
            onClick={toggleCodeMaximize}
            title={isCodeMaximized ? '还原分屏' : '全屏代码工作区'}
            className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            {isCodeMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* 收起代码区 */}
          <button
            onClick={toggleCodeWorkspace}
            title="收起代码区，回到智能对话全宽"
            className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* 主体视口：Monaco Diff 审查或单栏编辑 */}
      <div className="flex-1 relative overflow-hidden bg-[#1E1C1A]">
        {isDiffMode ? (
          <DiffEditor
            original={originalContent || '// Git HEAD 原版快照\npackage main\n\nfunc main() {\n}\n'}
            modified={activeContent || '// 当前工作区最新变更\npackage main\n\nfunc main() {\n  println("ready")\n}\n'}
            language={language}
            theme="vs-dark"
            options={{
              readOnly: false,
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              scrollBeyondLastLine: false,
              renderSideBySide: true,
              smoothScrolling: true,
            }}
          />
        ) : (
          <Editor
            value={activeContent}
            language={language}
            theme="vs-dark"
            onChange={(val) => setContent(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              lineNumbers: 'on',
              tabSize: 2,
            }}
          />
        )}
      </div>

      {/* 底栏状态条 */}
      <div className="h-6 bg-[#161412] border-t border-white/[0.08] px-3 flex items-center justify-between text-[10px] text-white/50 font-mono shrink-0">
        <span>{language.toUpperCase()} · UTF-8</span>
        <span>2 行删除 · 8 行新增</span>
      </div>
    </section>
  )
}
