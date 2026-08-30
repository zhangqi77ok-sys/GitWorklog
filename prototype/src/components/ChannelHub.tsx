import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Trash2,
  Edit,
  Copy,
  Zap,
  Activity,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import {
  ChannelItem,
  ChannelType,
  CHANNEL_PRESETS,
  loadSavedChannels,
  saveChannelsToStorage,
  getPresetForChannelType,
  resolveApiEndpoint
} from '../types/contracts';
import { ChannelMutateModal } from './ChannelMutateModal';

export const ChannelHub: React.FC = () => {
  const [channels, setChannels] = useState<ChannelItem[]>(() => loadSavedChannels());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'error'>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelItem | null>(null);

  // Toast notification
  const [toast, setToast] = useState<string | null>(null);
  const [probingMap, setProbingMap] = useState<Record<string, boolean>>({});
  const [isProbingAll, setIsProbingAll] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setChannels(loadSavedChannels());
    };
    window.addEventListener('tcode_channels_updated', handleUpdate);
    return () => window.removeEventListener('tcode_channels_updated', handleUpdate);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Filtered channels
  const filteredChannels = useMemo(() => {
    return channels.filter(c => {
      const matchSearch =
        !searchQuery.trim() ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.baseUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.models.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchType = typeFilter === 'all' || String(c.type) === typeFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && c.status === 'active') ||
        (statusFilter === 'disabled' && c.status === 'disabled') ||
        (statusFilter === 'error' && c.status === 'error');

      return matchSearch && matchType && matchStatus;
    });
  }, [channels, searchQuery, typeFilter, statusFilter]);

  // Aggregate stats
  const activeChannelsCount = channels.filter(c => c.status === 'active').length;
  const totalModelsCount = Array.from(new Set(channels.filter(c => c.status === 'active').flatMap(c => c.models))).length;

  const handleOpenAdd = () => {
    setEditingChannel(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: ChannelItem) => {
    setEditingChannel(c);
    setIsModalOpen(true);
  };

  const handleSaveChannel = (saved: ChannelItem) => {
    let updated: ChannelItem[];
    const exists = channels.some(c => c.id === saved.id);
    if (exists) {
      updated = channels.map(c => (c.id === saved.id ? saved : c));
      showToast(`✓ 渠道 [${saved.name}] 更新成功`);
    } else {
      updated = [saved, ...channels];
      showToast(`✓ 新建渠道 [${saved.name}] 成功`);
    }
    setChannels(updated);
    saveChannelsToStorage(updated);
  };

  const handleToggleStatus = (id: string) => {
    const updated = channels.map(c => {
      if (c.id !== id) return c;
      const newStatus: ChannelItem['status'] = c.status === 'active' ? 'disabled' : 'active';
      return { ...c, status: newStatus };
    });
    setChannels(updated);
    saveChannelsToStorage(updated);
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`确定要删除渠道 [${name}] 吗？`)) return;
    const updated = channels.filter(c => c.id !== id);
    setChannels(updated);
    saveChannelsToStorage(updated);
    showToast(`✓ 渠道 [${name}] 已删除`);
  };

  const handleClone = (c: ChannelItem) => {
    const cloned: ChannelItem = {
      ...c,
      id: `chan-${Date.now()}`,
      name: `${c.name} (副本)`,
      status: 'untested',
      responseTime: 0
    };
    const updated = [cloned, ...channels];
    setChannels(updated);
    saveChannelsToStorage(updated);
    showToast(`✓ 已创建 [${c.name}] 的副本`);
  };

  // Test single channel connectivity
  const handleProbeChannel = async (c: ChannelItem) => {
    setProbingMap(prev => ({ ...prev, [c.id]: true }));
    const start = Date.now();
    try {
      let target = c.baseUrl.trim();
      if (target.endsWith('/')) target = target.slice(0, -1);
      const testUrlTarget = target.endsWith('/models') ? target : `${target}/models`;
      const { url: testUrl, headers: proxyHeaders } = resolveApiEndpoint(testUrlTarget);

      const headers: Record<string, string> = { ...proxyHeaders };
      if (c.key.trim()) {
        const firstKey = c.key.trim().split('\n')[0].trim();
        headers['Authorization'] = `Bearer ${firstKey}`;
      }

      const res = await fetch(testUrl, { method: 'GET', headers });
      const duration = Date.now() - start;
      const newStatus: ChannelItem['status'] = res.ok ? 'active' : 'error';
      
      const updated = channels.map(item =>
        item.id === c.id
          ? { ...item, status: newStatus, responseTime: duration, testTime: Date.now() }
          : item
      );
      setChannels(updated);
      saveChannelsToStorage(updated);

      if (res.ok) {
        showToast(`✓ [${c.name}] 探测通过！HTTP ${res.status} OK · 响应时延 ${duration}ms`);
      } else {
        showToast(`✕ [${c.name}] 探测异常: HTTP ${res.status} (${res.statusText}) · ${duration}ms`);
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      const updated = channels.map(item =>
        item.id === c.id
          ? { ...item, status: 'error' as const, responseTime: duration, testTime: Date.now() }
          : item
      );
      setChannels(updated);
      saveChannelsToStorage(updated);
      showToast(`✕ [${c.name}] 连接失败: ${err.message}`);
    } finally {
      setProbingMap(prev => ({ ...prev, [c.id]: false }));
    }
  };

  // Test all active channels
  const handleProbeAll = async () => {
    setIsProbingAll(true);
    const activeList = channels.filter(c => c.status !== 'disabled');
    showToast(`⚡ 正在并发测速 ${activeList.length} 个启用渠道...`);
    await Promise.all(activeList.map(c => handleProbeChannel(c)));
    setIsProbingAll(false);
    showToast(`✓ 全量渠道测速完成！`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      
      {/* Toast */}
      {toast && (
        <div
          style={{
            padding: '7px 12px',
            borderRadius: '6px',
            background: 'var(--accent-subtle)',
            color: 'var(--accent)',
            border: '1px solid rgba(217, 107, 39, 0.3)',
            fontSize: '11.5px',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          {toast}
        </div>
      )}

      {/* Top Controls Bar */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}
      >
        {/* Left Stats Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              模型服务商渠道 (New-API Hub)
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              总渠道: <b>{channels.length}</b>
            </span>
            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', fontWeight: 600 }}>
              已启用: <b>{activeChannelsCount}</b>
            </span>
            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 600 }}>
              聚合模型: <b>{totalModelsCount}</b>
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handleProbeAll}
            disabled={isProbingAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '5px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Activity size={12} color="var(--accent)" className={isProbingAll ? 'animate-spin' : ''} />
            <span>{isProbingAll ? '全网测速中...' : '⚡ 全部测速'}</span>
          </button>

          <button
            onClick={handleOpenAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 12px',
              borderRadius: '5px',
              background: 'var(--accent)',
              border: 'none',
              color: '#FFF',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(217, 107, 39, 0.25)'
            }}
          >
            <Plus size={12} />
            <span>添加渠道</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="搜索渠道名称、Base URL、模型 ID (如 deepseek, gpt, mimo)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '5px 8px 5px 26px',
              borderRadius: '5px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              outline: 'none'
            }}
          />
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            padding: '5px 8px',
            borderRadius: '5px',
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            outline: 'none'
          }}
        >
          <option value="all">所有平台类型</option>
          {CHANNEL_PRESETS.map(p => (
            <option key={p.type} value={String(p.type)}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          style={{
            padding: '5px 8px',
            borderRadius: '5px',
            border: '1px solid var(--border-strong)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            outline: 'none'
          }}
        >
          <option value="all">所有状态</option>
          <option value="active">🟢 正常可用</option>
          <option value="disabled">⚪ 已禁用</option>
          <option value="error">🔴 异常报错</option>
        </select>
      </div>

      {/* Channels List Table / Cards View */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
        {filteredChannels.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', borderRadius: '8px', border: '1px dashed var(--border-strong)', background: 'var(--bg-surface)' }}>
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '6px' }}>🔍</span>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>没有找到匹配的服务商渠道</div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>请尝试调整搜索词，或点击上方「添加渠道」进行挂载</div>
          </div>
        ) : (
          filteredChannels.map(c => {
            const preset = getPresetForChannelType(c.type);
            const isProbing = probingMap[c.id] || false;
            const isEnabled = c.status !== 'disabled';

            // Latency badge style
            let latencyColor = 'var(--text-muted)';
            let latencyBg = 'var(--bg-base)';
            let latencyText = '未测试';

            if (c.responseTime > 0 && c.status === 'active') {
              if (c.responseTime < 300) {
                latencyColor = '#10B981';
                latencyBg = 'rgba(16, 185, 129, 0.12)';
                latencyText = `${c.responseTime}ms`;
              } else if (c.responseTime < 1000) {
                latencyColor = '#F59E0B';
                latencyBg = 'rgba(245, 158, 11, 0.12)';
                latencyText = `${c.responseTime}ms`;
              } else {
                latencyColor = '#EF4444';
                latencyBg = 'rgba(239, 68, 68, 0.12)';
                latencyText = `${c.responseTime}ms`;
              }
            } else if (c.status === 'error') {
              latencyColor = '#EF4444';
              latencyBg = 'rgba(239, 68, 68, 0.12)';
              latencyText = '异常';
            }

            return (
              <div
                key={c.id}
                style={{
                  padding: '10px 14px',
                  borderRadius: '7px',
                  border: isEnabled ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)',
                  background: isEnabled ? 'var(--bg-surface)' : 'var(--bg-base)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: isEnabled ? '0 1px 4px rgba(0,0,0,0.04)' : 'none',
                  opacity: isEnabled ? 1 : 0.65,
                  transition: 'all 0.12s ease'
                }}
              >
                {/* Left: Type Icon + Name + Endpoint info */}
                <div style={{ flex: '1.2 1 0', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '15px' }}>{preset.icon}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      Type: {c.type} ({preset.name.split(' ')[0]})
                    </span>
                    {c.group !== 'default' && (
                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 600 }}>
                        {c.group}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                      {c.baseUrl}
                    </span>
                    <span>·</span>
                    <span>{c.key ? (c.key.includes('\n') ? `多Key (${c.key.split('\n').length}个)` : '单Key') : '免Key'}</span>
                    <span>·</span>
                    <span>优先级: P{c.priority} (W{c.weight})</span>
                  </div>
                </div>

                {/* Middle: Enabled Models Tag Badges */}
                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                  {c.models.slice(0, 3).map(m => (
                    <span
                      key={m}
                      style={{
                        fontSize: '9.5px',
                        fontFamily: 'var(--font-mono)',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {m}
                    </span>
                  ))}
                  {c.models.length > 3 && (
                    <span
                      title={c.models.slice(3).join(', ')}
                      style={{
                        fontSize: '9.5px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent)',
                        fontWeight: 600,
                        cursor: 'help'
                      }}
                    >
                      +{c.models.length - 3}
                    </span>
                  )}
                  {c.modelMapping && Object.keys(c.modelMapping).length > 0 && (
                    <span
                      title={`重映射: ${JSON.stringify(c.modelMapping)}`}
                      style={{
                        fontSize: '9px',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#3B82F6',
                        fontWeight: 600,
                        cursor: 'help'
                      }}
                    >
                      🔀 映射
                    </span>
                  )}
                </div>

                {/* Right: Latency Badge + Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Latency Pill */}
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: latencyBg,
                      color: latencyColor,
                      fontFamily: 'var(--font-mono)',
                      minWidth: '52px',
                      textAlign: 'center'
                    }}
                  >
                    {isProbing ? '探测中...' : latencyText}
                  </span>

                  {/* Actions buttons */}
                  <button
                    onClick={() => handleProbeChannel(c)}
                    title="测试连通性"
                    disabled={isProbing}
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <Activity size={12} color="var(--accent)" className={isProbing ? 'animate-spin' : ''} />
                  </button>

                  <button
                    onClick={() => handleOpenEdit(c)}
                    title="编辑渠道"
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit size={12} />
                  </button>

                  <button
                    onClick={() => handleClone(c)}
                    title="复制渠道"
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    <Copy size={12} />
                  </button>

                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    title="删除渠道"
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-base)',
                      color: '#EF4444',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={12} />
                  </button>

                  {/* Enable / Disable Switch */}
                  <button
                    onClick={() => handleToggleStatus(c.id)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      border: 'none',
                      background: isEnabled ? 'var(--accent)' : 'var(--border-strong)',
                      color: '#FFF',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      minWidth: '54px'
                    }}
                  >
                    {isEnabled ? '已启用' : '已禁用'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal / Drawer for Add / Edit */}
      {isModalOpen && (
        <ChannelMutateModal
          isOpen={isModalOpen}
          channel={editingChannel}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveChannel}
        />
      )}
    </div>
  );
};
