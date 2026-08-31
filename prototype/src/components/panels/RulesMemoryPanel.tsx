import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Shield, Sparkles, Code2, Plus, Check, Edit3, Trash2, Globe, FolderGit2 } from 'lucide-react';
import { ManagedRule } from '../../types/contracts';
import { loadSavedRules, saveRulesToStorage, toggleRuleState, addManagedRule, updateManagedRule, deleteManagedRule } from '../../services/rulesStore';
import { loadSavedMemories, deleteMemory, MemoryEntry } from '../../services/memoryStore';

export const RulesMemoryPanel: React.FC = () => {
  const [rules, setRules] = useState<ManagedRule[]>(loadSavedRules());
  const [memories, setMemories] = useState<MemoryEntry[]>(loadSavedMemories());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'iron_law' | 'lesson' | 'team_rule' | 'global' | 'learned_memory'>('all');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<'team_rule' | 'lesson' | 'global'>('team_rule');
  const [newScope, setNewScope] = useState<'project' | 'global'>('project');
  const [newSource, setNewSource] = useState('.cursorrules');

  useEffect(() => {
    const handleRulesUpdated = (e: any) => {
      if (e.detail) setRules(e.detail);
    };
    const handleMemoriesUpdated = (e: any) => {
      if (e.detail) setMemories(e.detail);
    };
    window.addEventListener('codemind_rules_updated', handleRulesUpdated);
    window.addEventListener('tcode_memories_updated', handleMemoriesUpdated);
    return () => {
      window.removeEventListener('codemind_rules_updated', handleRulesUpdated);
      window.removeEventListener('tcode_memories_updated', handleMemoriesUpdated);
    };
  }, []);

  const filteredRules = rules.filter(r => {
    if (activeCategory !== 'all' && r.category !== activeCategory) return false;
    if (searchQuery.trim() && !r.title.toLowerCase().includes(searchQuery.toLowerCase()) && !r.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleToggle = (id: string) => {
    const updated = toggleRuleState(id);
    setRules(updated);
  };

  const handleStartEdit = (r: ManagedRule) => {
    setEditingRuleId(r.id);
    setEditPrompt(r.description);
  };

  const handleSaveEdit = (id: string) => {
    const updated = updateManagedRule(id, { description: editPrompt });
    setRules(updated);
    setEditingRuleId(null);
  };

  const handleDelete = (id: string) => {
    const updated = deleteManagedRule(id);
    setRules(updated);
  };

  const handleCreateRule = () => {
    if (!newTitle.trim() || !newDesc.trim()) return;
    const updated = addManagedRule({
      title: newTitle.trim(),
      description: newDesc.trim(),
      category: newCategory,
      scope: newScope,
      sourceFile: newSource,
      enabled: true,
      priority: newCategory === 'lesson' ? 80 : 70
    });
    setRules(updated);
    setNewTitle('');
    setNewDesc('');
    setShowAddModal(false);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      userSelect: 'none'
    }}>
      {/* Panel Top Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            <BookOpen size={14} color="var(--accent)" />
            <span>规则与经验记忆中心</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
              {rules.filter(r => r.enabled).length}/{rules.length} 条生效
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'var(--accent)',
                color: '#FFF',
                border: 'none',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title="新增自定义规则或沉淀经验"
            >
              <Plus size={11} />
              <span>新建</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={12} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="搜索规则、铁律或沉淀经验..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 8px 4px 26px',
              borderRadius: '4px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={{
              padding: '2px 7px',
              borderRadius: '3px',
              border: activeCategory === 'all' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
              background: activeCategory === 'all' ? 'rgba(217, 107, 39, 0.12)' : 'transparent',
              color: activeCategory === 'all' ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            全部 ({rules.length})
          </button>
          <button
            onClick={() => setActiveCategory('iron_law')}
            style={{
              padding: '2px 7px',
              borderRadius: '3px',
              border: activeCategory === 'iron_law' ? '1px solid #DC2626' : '1px solid var(--border-subtle)',
              background: activeCategory === 'iron_law' ? 'rgba(220, 38, 38, 0.1)' : 'transparent',
              color: activeCategory === 'iron_law' ? '#DC2626' : 'var(--text-muted)',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            三大铁律
          </button>
          <button
            onClick={() => setActiveCategory('lesson')}
            style={{
              padding: '2px 7px',
              borderRadius: '3px',
              border: activeCategory === 'lesson' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
              background: activeCategory === 'lesson' ? 'rgba(217, 107, 39, 0.12)' : 'transparent',
              color: activeCategory === 'lesson' ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            经验沉淀 (.codemind)
          </button>
          <button
            onClick={() => setActiveCategory('team_rule')}
            style={{
              padding: '2px 7px',
              borderRadius: '3px',
              border: activeCategory === 'team_rule' ? '1px solid #2563EB' : '1px solid var(--border-subtle)',
              background: activeCategory === 'team_rule' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              color: activeCategory === 'team_rule' ? '#2563EB' : 'var(--text-muted)',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            团队规范
          </button>
          <button
            onClick={() => setActiveCategory('learned_memory')}
            style={{
              padding: '2px 7px',
              borderRadius: '3px',
              border: activeCategory === 'learned_memory' ? '1px solid #16A34A' : '1px solid var(--border-subtle)',
              background: activeCategory === 'learned_memory' ? 'rgba(22, 163, 74, 0.12)' : 'transparent',
              color: activeCategory === 'learned_memory' ? '#16A34A' : 'var(--text-muted)',
              fontSize: '10px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            🧠 长期记忆 ({memories.length})
          </button>
        </div>
      </div>

      {/* Rules & Memories List */}
      <div style={{ flex: 1, padding: '8px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {activeCategory === 'learned_memory' ? (
          memories.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
              暂无已学习的跨会话长期记忆。Agent 将在会话结束时自动沉淀您的习惯与约定。
            </div>
          ) : (
            memories.map(m => (
              <div
                key={m.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={12} color="#16A34A" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {m.summary}
                    </span>
                    <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A' }}>
                      {m.category} · {(m.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <button
                    onClick={() => deleteMemory(m.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                    title="删除该条记忆"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {m.detail}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  沉淀时间: {new Date(m.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )
        ) : (
          filteredRules.map(r => (
          <div
            key={r.id}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'var(--bg-surface)',
              border: r.enabled ? '1px solid var(--border-subtle)' : '1px dashed var(--border-subtle)',
              opacity: r.enabled ? 1 : 0.6,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {r.category === 'iron_law' ? (
                  <Shield size={12} color="#DC2626" />
                ) : r.category === 'lesson' ? (
                  <Sparkles size={12} color="var(--accent)" />
                ) : (
                  <Code2 size={12} color="#2563EB" />
                )}
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {r.title}
                </span>
                <span style={{
                  fontSize: '9px',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)'
                }}>
                  {r.scope === 'global' ? '全局' : '工程'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={() => handleToggle(r.id)}
                style={{ cursor: 'pointer' }}
                title="开启/禁用该规则 (实时写入持久化并在下轮请求生效)"
              />
            </div>

            {/* Description / Prompt */}
            {editingRuleId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                <textarea
                  value={editPrompt}
                  onChange={e => setEditPrompt(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--accent)',
                    color: 'var(--text-primary)',
                    fontSize: '10.5px'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                  <button
                    onClick={() => setEditingRuleId(null)}
                    style={{ padding: '1px 6px', fontSize: '9.5px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleSaveEdit(r.id)}
                    style={{ padding: '1px 8px', fontSize: '9.5px', background: 'var(--accent)', border: 'none', color: '#FFF', fontWeight: 600, cursor: 'pointer' }}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {r.description}
              </div>
            )}

            {/* Meta bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '9.5px', color: 'var(--text-muted)' }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>📄 {r.sourceFile}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {editingRuleId !== r.id && !r.readonly && (
                  <button
                    onClick={() => handleStartEdit(r)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
                  >
                    <Edit3 size={10} />
                    <span>编辑</span>
                  </button>
                )}
                {!r.readonly && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
                    title="删除该规则"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )))}
      </div>

      {/* Create New Rule Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            width: '380px',
            borderRadius: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              ➕ 新建规则 / 经验条目
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>规则标题:</label>
              <input
                type="text"
                placeholder="例如: 团队规范: 禁止在组件内写内联样式"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>规则约束详情 (注入 Agent System Prompt):</label>
              <textarea
                rows={3}
                placeholder="详细说明触发条件与行为约束要求..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>分类:</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as any)}
                  style={{ width: '100%', padding: '5px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '11px' }}
                >
                  <option value="team_rule">团队规范 (Team Rule)</option>
                  <option value="lesson">经验沉淀 (Lesson)</option>
                  <option value="global">全局准则 (Global)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>作用域:</label>
                <select
                  value={newScope}
                  onChange={e => setNewScope(e.target.value as any)}
                  style={{ width: '100%', padding: '5px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '11px' }}
                >
                  <option value="project">当前工程 (Project)</option>
                  <option value="global">全局生效 (Global)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>来源文件标识:</label>
              <input
                type="text"
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ padding: '5px 12px', borderRadius: '4px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleCreateRule}
                disabled={!newTitle.trim() || !newDesc.trim()}
                style={{
                  padding: '5px 14px',
                  borderRadius: '4px',
                  background: 'var(--accent)',
                  color: '#FFF',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: (!newTitle.trim() || !newDesc.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (!newTitle.trim() || !newDesc.trim()) ? 0.6 : 1
                }}
              >
                保存并激活
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
