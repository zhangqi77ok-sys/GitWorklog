import React, { useState } from 'react';
import { BookOpen, Search, Shield, Sparkles, Code2, Plus, Check, Edit3, Trash2 } from 'lucide-react';
import { MOCK_RULES_MEMORY, RulesMemoryItem } from '../../types/contracts';

export const RulesMemoryPanel: React.FC = () => {
  const [rules, setRules] = useState<RulesMemoryItem[]>(MOCK_RULES_MEMORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'iron_law' | 'lesson' | 'team_rule'>('all');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  const filteredRules = rules.filter(r => {
    if (activeCategory !== 'all' && r.category !== activeCategory) return false;
    if (searchQuery.trim() && !r.title.toLowerCase().includes(searchQuery.toLowerCase()) && !r.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleStartEdit = (r: RulesMemoryItem) => {
    setEditingRuleId(r.id);
    setEditPrompt(r.description);
  };

  const handleSaveEdit = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, description: editPrompt } : r));
    setEditingRuleId(null);
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
          <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
            {rules.filter(r => r.enabled).length}/{rules.length} 条已激活
          </span>
        </div>

        {/* Search Input */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
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
            沉淀经验 (.codemind)
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
        </div>
      </div>

      {/* Rules List */}
      <div style={{ flex: 1, padding: '8px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredRules.map(r => (
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
              </div>
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={() => toggleRule(r.id)}
                style={{ cursor: 'pointer' }}
                title="开启/禁用该规则"
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
              {editingRuleId !== r.id && (
                <button
                  onClick={() => handleStartEdit(r)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
                >
                  <Edit3 size={10} />
                  <span>微调约束</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
