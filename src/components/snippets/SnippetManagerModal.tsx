import React, { useState, useRef, useMemo } from 'react';
import {
  Code2,
  Search,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Upload,
  Terminal,
  Tag,
  Clock,
  Sparkles,
  X,
  FileCode,
  Layers,
} from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { ConfirmModal } from '../common/ConfirmModal';
import { toast } from '../common/Toast';
import { useSnippetStore } from '../../stores/useSnippetStore';
import { searchSnippets, type Snippet, type SnippetInput } from '../../lib/snippets';
import { downloadBackup, parseBackupFile } from '../../lib/backup';

interface SnippetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SnippetManagerModal: React.FC<SnippetManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    snippets,
    query,
    selectedId,
    setQuery,
    selectSnippet,
    addSnippet,
    updateSnippetById,
    deleteSnippetById,
    duplicateSnippetById,
    replaceAll,
  } = useSnippetStore();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLanguage, setEditLanguage] = useState('typescript');
  const [editTags, setEditTags] = useState('');

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSnippets = useMemo(() => {
    return searchSnippets(snippets, query);
  }, [snippets, query]);

  const activeSnippet = useMemo(() => {
    return snippets.find((s) => s.id === selectedId) || filteredSnippets[0] || null;
  }, [snippets, selectedId, filteredSnippets]);

  const handleStartCreate = () => {
    setIsEditing(true);
    setEditTitle('');
    setEditContent('');
    setEditLanguage('typescript');
    setEditTags('demo');
  };

  const handleStartEdit = (s: Snippet) => {
    selectSnippet(s.id);
    setIsEditing(true);
    setEditTitle(s.title);
    setEditContent(s.content);
    setEditLanguage(s.language);
    setEditTags(s.tags.join(', '));
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) {
      toast.error('代码片段内容不能为空');
      return;
    }

    const tagsArray = editTags
      .split(/[,，\s]+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    if (activeSnippet && isEditing && editTitle) {
      updateSnippetById(activeSnippet.id, {
        title: editTitle.trim(),
        content: editContent,
        language: editLanguage.trim() || 'text',
        tags: tagsArray,
      });
      toast.success('片段已更新');
    } else {
      const created = addSnippet({
        title: editTitle.trim(),
        content: editContent,
        language: editLanguage.trim() || 'text',
        tags: tagsArray,
      });
      if (created) {
        toast.success('已创建新代码片段');
      }
    }
    setIsEditing(false);
  };

  const handleCopy = (snippet: Snippet) => {
    navigator.clipboard.writeText(snippet.content);
    setCopiedId(snippet.id);
    toast.success(`已复制片段「${snippet.title}」`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = () => {
    downloadBackup(snippets);
    toast.success(`已导出 ${snippets.length} 个代码片段备份`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imported = await parseBackupFile(file);
      replaceAll(imported);
      toast.success(`成功导入 ${imported.length} 个代码片段`);
    } catch (err: any) {
      toast.error(`导入失败: ${err.message || String(err)}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <Dialog isOpen={isOpen} onClose={onClose} title="代码片段与知识沉淀管理" maxWidth="max-w-4xl">
        <div className="flex h-[520px] bg-[#FAF8F5] -m-4 overflow-hidden select-none">
          {/* Left Column: Snippet List & Search */}
          <div className="w-72 border-r border-[#E6DFD5] bg-[#F4EFEA] flex flex-col">
            {/* Search & Actions Bar */}
            <div className="p-3 border-b border-[#E6DFD5] space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8A847C] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索标题、内容或标签..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg text-xs text-[#1E1C1A] placeholder-[#8A847C] outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新建片段</span>
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  title="导出全部片段 JSON 备份"
                  className="p-1.5 bg-white hover:bg-[#FAF8F5] text-[#6B665F] hover:text-[#1E1C1A] border border-[#E6DFD5] rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="导入片段 JSON 备份"
                  className="p-1.5 bg-white hover:bg-[#FAF8F5] text-[#6B665F] hover:text-[#1E1C1A] border border-[#E6DFD5] rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredSnippets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center text-xs text-[#8A847C]">
                  <FileCode className="w-8 h-8 mb-2 text-[#D96B27]/40" />
                  <p className="font-semibold text-[#1E1C1A]">暂无片段</p>
                  <p className="text-[11px] mt-1">点击上方按钮新建或导入备份</p>
                </div>
              ) : (
                filteredSnippets.map((snippet) => {
                  const isSelected = (activeSnippet?.id === snippet.id) && !isEditing;
                  return (
                    <div
                      key={snippet.id}
                      onClick={() => {
                        selectSnippet(snippet.id);
                        setIsEditing(false);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-white border-[#D96B27] shadow-xs'
                          : 'bg-white/60 hover:bg-white border-[#E6DFD5]/80 hover:border-[#D96B27]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-[#1E1C1A] truncate max-w-[170px]">
                          {snippet.title}
                        </span>
                        <span className="text-[10px] font-mono text-[#8A847C] bg-[#FAF8F5] px-1.5 py-0.5 rounded border border-[#E6DFD5]">
                          {snippet.language}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[#8A847C]">
                        <div className="flex items-center gap-1 overflow-hidden truncate">
                          {snippet.tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-[#D96B27] bg-[#D96B27]/10 px-1 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                        <span>{new Date(snippet.updatedAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Preview or Edit View */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {isEditing ? (
              <div className="flex-1 flex flex-col p-4 space-y-3 overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-[#E6DFD5]">
                  <span className="font-bold text-xs text-[#1E1C1A]">
                    {activeSnippet ? '编辑代码片段' : '新建代码片段'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="p-1 text-[#8A847C] hover:text-[#1E1C1A] rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#6B665F]">标题 (可选，留空推断)</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="如：FastAPI 代理路由"
                      className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg text-xs text-[#1E1C1A] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#6B665F]">语言类型</label>
                    <input
                      type="text"
                      value={editLanguage}
                      onChange={(e) => setEditLanguage(e.target.value)}
                      placeholder="typescript / python / rust / json"
                      className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg text-xs text-[#1E1C1A] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1 flex-1 flex flex-col">
                  <label className="text-[11px] font-semibold text-[#6B665F]">代码内容</label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="在此粘贴或编写代码片段..."
                    className="w-full flex-1 min-h-[200px] p-3 font-mono text-xs text-[#1E1C1A] bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-xl outline-none leading-relaxed resize-none overflow-y-auto"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#6B665F]">标签 (逗号分隔)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="react, router, auth"
                    className="w-full px-2.5 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg text-xs text-[#1E1C1A] outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6DFD5]">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 bg-white border border-[#E6DFD5] hover:bg-[#FAF8F5] text-[#6B665F] rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-4 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    保存片段
                  </button>
                </div>
              </div>
            ) : activeSnippet ? (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E6DFD5]">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-[#1E1C1A] truncate">{activeSnippet.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[#8A847C]">
                      <span className="font-mono bg-[#FAF8F5] px-1.5 py-0.5 rounded border border-[#E6DFD5]">
                        {activeSnippet.language}
                      </span>
                      <span>·</span>
                      <span>更新于 {new Date(activeSnippet.updatedAt).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 select-none">
                    <button
                      type="button"
                      onClick={() => handleCopy(activeSnippet)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      {copiedId === activeSnippet.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === activeSnippet.id ? '已复制' : '复制代码'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(activeSnippet)}
                      className="px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F4EFEA] text-[#1E1C1A] border border-[#E6DFD5] rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateSnippetById(activeSnippet.id)}
                      className="px-2.5 py-1.5 bg-[#FAF8F5] hover:bg-[#F4EFEA] text-[#6B665F] border border-[#E6DFD5] rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      克隆副本
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(activeSnippet.id)}
                      className="p-1.5 bg-[#FAF8F5] hover:bg-red-50 text-[#8A847C] hover:text-red-600 border border-[#E6DFD5] rounded-lg transition-colors cursor-pointer"
                      title="删除此片段"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tags Bar */}
                {activeSnippet.tags.length > 0 && (
                  <div className="flex items-center gap-1 py-2 overflow-x-auto">
                    {activeSnippet.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F4EFEA] border border-[#E6DFD5] rounded-md text-[10px] text-[#6B665F]"
                      >
                        <Tag className="w-2.5 h-2.5 text-[#D96B27]" />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Code Block Preview */}
                <div className="flex-1 mt-2 rounded-xl overflow-hidden border border-[#E6DFD5] bg-[#1E1C1A] text-white flex flex-col">
                  <div className="px-3 py-1.5 bg-[#2D2A26] border-b border-[#3D3A36] flex items-center justify-between text-[11px] text-[#8A847C] font-mono">
                    <span className="flex items-center gap-1.5 text-[#D5CCC0]">
                      <Terminal className="w-3.5 h-3.5 text-[#D96B27]" />
                      <span>{activeSnippet.language}</span>
                    </span>
                    <span>{activeSnippet.content.split('\n').length} 行</span>
                  </div>
                  <pre className="p-3.5 flex-1 overflow-x-auto overflow-y-auto text-[11px] font-mono text-[#E6DFD5] leading-relaxed select-text">
                    <code>{activeSnippet.content}</code>
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-[#8A847C]">
                <Layers className="w-10 h-10 mb-2 text-[#D96B27]/40" />
                <p className="font-semibold text-[#1E1C1A]">请从左侧选择代码片段</p>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Delete Confirm Modal (Iron Rule 5 compliant) */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="删除代码片段"
        message="确定删除该代码片段吗？此操作不可撤销。"
        isDanger={true}
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteSnippetById(deleteConfirmId);
            setDeleteConfirmId(null);
            toast.success('已删除代码片段');
          }
        }}
        onClose={() => setDeleteConfirmId(null)}
      />
    </>
  );
};
