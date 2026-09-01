import React, { useEffect, useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import {
  X,
  Save,
  Check,
  Ban,
  FileCode,
  SplitSquareVertical,
  Columns,
  AlignJustify,
  FolderOpen,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';

export const MonacoEditorWorkspace: React.FC = () => {
  const {
    openTabs,
    activeTabPath,
    openFile,
    closeTab,
    updateTabContent,
    saveActiveFile,
    acceptDiffPatch,
    rejectDiffPatch,
  } = useWorkspaceStore();

  const [isSideBySide, setIsSideBySide] = useState(true);
  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveActiveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveActiveFile]);

  if (!activeTab) {
    return (
      <div className="flex-1 h-full bg-[#1E1C1A] flex flex-col items-center justify-center text-[#8A847C] select-none p-6 text-center">
        <FileCode className="w-12 h-12 mb-3 text-[#3D3A36]" />
        <h3 className="text-sm font-medium text-[#D5CEBF] mb-1">未打开任何文件</h3>
        <p className="text-xs text-[#8A847C] max-w-xs">
          请在左侧文件树中点击文件进行浏览与编辑，或在对话中让 Agent 编写并生成代码补丁。
        </p>
      </div>
    );
  }

  // Format breadcrumbs from path
  const breadcrumbParts = activeTab.path.replace(/\\/g, '/').split('/').filter(Boolean);
  const displayBreadcrumbs = breadcrumbParts.slice(-4).join(' > ');

  return (
    <div className="flex-1 h-full bg-[#1E1C1A] flex flex-col overflow-hidden">
      {/* 1. Multi-Tabs Bar */}
      <div className="h-9 bg-[#161412] border-b border-[#2D2A26] flex items-center justify-between px-2 overflow-x-auto no-scrollbar select-none">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {openTabs.map((tab) => {
            const isActive = tab.path === activeTabPath;
            return (
              <div
                key={tab.path}
                onClick={() => openFile(tab.path)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-t text-xs font-mono cursor-pointer transition-all border-b-2 ${
                  isActive
                    ? 'bg-[#1E1C1A] text-[#FAF8F5] border-[#D96B27]'
                    : 'bg-[#161412] text-[#8A847C] hover:text-[#D5CEBF] hover:bg-[#1E1C1A]/50 border-transparent'
                }`}
              >
                {tab.isDiff ? (
                  <SplitSquareVertical className="w-3.5 h-3.5 text-[#D96B27]" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-[#8A847C]" />
                )}
                <span>{tab.name}</span>
                {tab.isDirty && (
                  <span className="w-2 h-2 rounded-full bg-[#D96B27]" title="未保存修改" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
                  className="p-0.5 rounded hover:bg-[#2D2A26] text-[#8A847C] hover:text-white opacity-60 group-hover:opacity-100 transition-opacity"
                  title="关闭标签"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Tab Actions */}
        <div className="flex items-center gap-2 pl-2">
          {!activeTab.isDiff && (
            <button
              onClick={saveActiveFile}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#2D2A26] hover:bg-[#3D3A36] text-[#FAF8F5] hover:text-[#D96B27] rounded text-xs font-medium transition-colors"
              title="保存当前文件 (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存文件</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Breadcrumb Navigation Bar */}
      <div className="h-6 bg-[#1A1816] border-b border-[#2D2A26] px-3 flex items-center justify-between text-[11px] text-[#8A847C] font-mono select-none">
        <div className="flex items-center gap-1 truncate">
          <FolderOpen className="w-3 h-3 text-[#D96B27]/80" />
          <span className="truncate">{displayBreadcrumbs}</span>
        </div>

        {activeTab.isDiff && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setIsSideBySide(true)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                isSideBySide
                  ? 'bg-[#2D2A26] text-[#FAF8F5] font-semibold'
                  : 'text-[#8A847C] hover:text-[#FAF8F5]'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>双栏对比</span>
            </button>
            <button
              onClick={() => setIsSideBySide(false)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                !isSideBySide
                  ? 'bg-[#2D2A26] text-[#FAF8F5] font-semibold'
                  : 'text-[#8A847C] hover:text-[#FAF8F5]'
              }`}
            >
              <AlignJustify className="w-3 h-3" />
              <span>行内比对</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Editor Body */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab.isDiff ? (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1">
              <DiffEditor
                original={activeTab.originalContent || ''}
                modified={activeTab.proposedContent || ''}
                language={activeTab.language}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  renderSideBySide: isSideBySide,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
                }}
              />
            </div>

            {/* Floating Diff Review Bar */}
            <div className="h-12 bg-[#161412] border-t border-[#2D2A26] px-4 flex items-center justify-between z-10 select-none">
              <div className="flex items-center gap-2 text-xs text-[#D5CEBF]">
                <SplitSquareVertical className="w-4 h-4 text-[#D96B27]" />
                <span>💡 Agent 提议代码变更已就绪，请审查左（原）右（新）代码补丁</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => rejectDiffPatch(activeTab.path)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#2D2A26] hover:bg-[#3D3A36] text-[#FAF8F5] hover:text-[#C62828] rounded text-xs font-medium transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>放弃变更</span>
                </button>
                <button
                  onClick={() => acceptDiffPatch(activeTab.path)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded text-xs font-medium transition-colors shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>接受并应用补丁</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <Editor
            value={activeTab.content}
            language={activeTab.language}
            theme="vs-dark"
            onChange={(val) => updateTabContent(activeTab.path, val || '')}
            options={{
              fontSize: 13,
              fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
              tabSize: 2,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              lineNumbers: 'on',
            }}
          />
        )}
      </div>
    </div>
  );
};
