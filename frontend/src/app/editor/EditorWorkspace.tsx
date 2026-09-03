import React from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { RotateCcw, Check, FileCode2 } from 'lucide-react'
import { useEditorStore } from '../../core/store/editorStore'
import { useGitStore } from '../../core/store/gitStore'
import { FileTree } from './FileTree'
import { TabBar } from './TabBar'

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

export const EditorWorkspace: React.FC = () => {
  const { activeFile, activeContent, originalContent, isDiffMode, setContent } = useEditorStore()
  const { stageFile, restoreFile } = useGitStore()

  const language = activeFile ? getLanguageFromPath(activeFile) : 'plaintext'

  return (
    <div className="flex-1 flex h-full bg-[#FAF8F5] overflow-hidden">
      {/* 工作区文件树 */}
      <FileTree />

      {/* 右侧主编辑器视口 */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF8F5]">
        {/* 多标签栏 */}
        <TabBar />

        {/* 主编辑或 Diff 内容区域 */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {!activeFile ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#7A726B] gap-2 select-none">
              <div className="w-12 h-12 rounded-xl bg-[#F4EFEA] border border-[#EADFD7] flex items-center justify-center text-[#D96B27]">
                <FileCode2 size={24} />
              </div>
              <span className="text-xs font-medium text-[#2C2825]">未打开任何文件</span>
              <span className="text-[11px] text-[#A89F96]">从左侧文件树中点击文件即可浏览与编辑</span>
            </div>
          ) : isDiffMode ? (
            /* Diff 虚拟化对比审查模式 */
            <div className="flex-1 flex flex-col h-full relative">
              {/* Diff 顶部悬浮工具条 */}
              <div className="h-8 bg-[#FAF2EC] border-b border-[#F0D5C3] px-3 flex items-center justify-between text-xs select-none shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#D96B27] text-[11px]">Diff 审查模式:</span>
                  <span className="font-mono text-[11px] text-[#2C2825]">{activeFile}</span>
                  <span className="text-[10px] text-[#7A726B] bg-white/70 px-1.5 py-0.5 rounded border border-[#EADFD7]">
                    左侧: 原版 (Git HEAD) | 右侧: 最新修改
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      if (activeFile) {
                        await restoreFile(activeFile)
                      }
                    }}
                    title="放弃此文件的所有本地修改"
                    className="flex items-center gap-1 text-[11px] text-[#E04B4B] hover:bg-[#FBEAEA] px-2 py-0.5 rounded border border-[#F5C4C4] transition-colors"
                  >
                    <RotateCcw size={11} />
                    <span>放弃修改</span>
                  </button>

                  <button
                    onClick={async () => {
                      if (activeFile) {
                        await stageFile(activeFile)
                      }
                    }}
                    title="将此文件的修改加入 Git 暂存区"
                    className="flex items-center gap-1 text-[11px] font-medium text-white bg-[#D96B27] hover:bg-[#BF5B1D] px-2.5 py-0.5 rounded shadow-2xs transition-colors"
                  >
                    <Check size={11} />
                    <span>暂存修改</span>
                  </button>
                </div>
              </div>

              {/* Monaco 双栏 Diff 视口 */}
              <div className="flex-1 relative">
                <DiffEditor
                  original={originalContent}
                  modified={activeContent}
                  language={language}
                  theme="vs"
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
              </div>
            </div>
          ) : (
            /* 标准代码编辑模式 */
            <div className="flex-1 relative">
              <Editor
                value={activeContent}
                language={language}
                theme="vs"
                onChange={(val) => setContent(val || '')}
                options={{
                  minimap: { enabled: true },
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  lineNumbers: 'on',
                  cursorBlinking: 'smooth',
                  tabSize: 2,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
