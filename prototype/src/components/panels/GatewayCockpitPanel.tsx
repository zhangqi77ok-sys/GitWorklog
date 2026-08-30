import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Server, Plus, Check, ChevronDown, CheckSquare, Square, RefreshCw, Settings, ShieldCheck, Key, AlertCircle } from 'lucide-react';
import {
  ChannelItem,
  loadSavedChannels,
  saveChannelsToStorage,
  resolveApiEndpoint
} from '../../types/contracts';

export const GatewayCockpitPanel: React.FC = () => {
  const [channels, setChannels] = useState<ChannelItem[]>(() => loadSavedChannels());
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>(() => {
    const list = loadSavedChannels();
    return list.filter(c => c.status !== 'disabled').map(c => c.id);
  });
  const [probingMap, setProbingMap] = useState<Record<string, boolean>>({});
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // 🔄 Real-time Bi-directional Synchronization with Settings Modal and Storage
  useEffect(() => {
    const syncChannels = () => {
      const latest = loadSavedChannels();
      setChannels(latest);
      setSelectedChannelIds(prev => {
        const validIds = new Set(latest.map(c => c.id));
        return prev.filter(id => validIds.has(id));
      });
    };

    window.addEventListener('tcode_channels_updated', syncChannels);
    window.addEventListener('tcode_providers_updated', syncChannels);
    window.addEventListener('storage', syncChannels);

    // Initial sync
    syncChannels();

    return () => {
      window.removeEventListener('tcode_channels_updated', syncChannels);
      window.removeEventListener('tcode_providers_updated', syncChannels);
      window.removeEventListener('storage', syncChannels);
    };
  }, []);

  const toggleSelectChannel = (id: string) => {
    setSelectedChannelIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedChannelIds.length === channels.length) {
      setSelectedChannelIds([]);
    } else {
      setSelectedChannelIds(channels.map(c => c.id));
    }
  };

  // Perform REAL HTTP Ping to channel endpoint
  const pingChannel = async (c: ChannelItem): Promise<{ latencyMs: number; status: 'active' | 'error'; errorMsg?: string }> => {
    const startTime = performance.now();
    let target = c.baseUrl.trim();
    if (target.endsWith('/')) target = target.slice(0, -1);
    const testUrlTarget = target.endsWith('/models') ? target : `${target}/models`;
    const { url: requestUrl, headers: proxyHeaders } = resolveApiEndpoint(testUrlTarget);

    try {
      const headers: Record<string, string> = { ...proxyHeaders };
      if (c.key?.trim()) {
        const firstKey = c.key.trim().split('\n')[0].trim();
        headers['Authorization'] = `Bearer ${firstKey}`;
      }

      const res = await fetch(requestUrl, {
        method: 'GET',
        headers
      });
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        return { latencyMs: latency, status: 'active' };
      }
      return { latencyMs: latency, status: 'error', errorMsg: `HTTP ${res.status} (${res.statusText})` };
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      return { latencyMs: latency, status: 'error', errorMsg: err.message || '网络连接超时' };
    }
  };

  // Test selected channels with real network roundtrip
  const handleTestSelected = async () => {
    if (selectedChannelIds.length === 0) {
      setToastNotice('请先勾选需要测试连通性的厂商渠道！');
      setTimeout(() => setToastNotice(null), 2500);
      return;
    }

    const newTestingMap: Record<string, boolean> = {};
    selectedChannelIds.forEach(id => {
      newTestingMap[id] = true;
    });
    setProbingMap(newTestingMap);

    const updated = [...channels];
    for (let i = 0; i < updated.length; i++) {
      const c = updated[i];
      if (selectedChannelIds.includes(c.id)) {
        const result = await pingChannel(c);
        updated[i] = {
          ...c,
          status: result.status,
          responseTime: result.latencyMs,
          testTime: Date.now()
        };
      }
    }

    setChannels(updated);
    saveChannelsToStorage(updated);
    setProbingMap({});
    setToastNotice(`✓ 已完成对 ${selectedChannelIds.length} 个渠道的实时真机测速！`);
    setTimeout(() => setToastNotice(null), 3000);
  };

  // Test a single channel directly
  const handleTestSingle = async (c: ChannelItem) => {
    setProbingMap(prev => ({ ...prev, [c.id]: true }));
    const result = await pingChannel(c);
    const updated = channels.map(item =>
      item.id === c.id
        ? { ...item, status: result.status, responseTime: result.latencyMs, testTime: Date.now() }
        : item
    );
    setChannels(updated);
    saveChannelsToStorage(updated);
    setProbingMap(prev => ({ ...prev, [c.id]: false }));

    if (result.status === 'active') {
      setToastNotice(`✓ [${c.name}] 真实连通延迟: ${result.latencyMs}ms`);
    } else {
      setToastNotice(`✕ [${c.name}] 连通异常: ${result.errorMsg} (${result.latencyMs}ms)`);
    }
    setTimeout(() => setToastNotice(null), 3000);
  };

  // Open Settings Modal on Channels tab
  const handleOpenSettingsChannels = () => {
    window.dispatchEvent(new CustomEvent('tcode_open_settings', { detail: { tab: 'channels' } }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {toastNotice && (
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          padding: '6px 10px',
          background: 'var(--accent)',
          color: '#FFF',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 100
        }}>
          {toastNotice}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            模型网关驾驶舱 (实时真机)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => {
                const latest = loadSavedChannels();
                setChannels(latest);
                setToastNotice('✓ 已同步最新渠道设置');
                setTimeout(() => setToastNotice(null), 2000);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 6px',
                borderRadius: '4px',
                background: 'var(--bg-surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                fontSize: '10px',
                cursor: 'pointer'
              }}
              title="手动从全局存储重新加载渠道"
            >
              <RefreshCw size={10} />
            </button>
            <button
              onClick={handleTestSelected}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--accent)',
                color: '#FFF',
                border: 'none',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="真实发送 HTTP 请求到选中的大模型网关"
            >
              <Zap size={11} />
              <span>测速选定厂商 ({selectedChannelIds.length})</span>
            </button>
          </div>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>已实时同步全局设置 · 支持即时网络 Ping</span>
          <span
            onClick={handleSelectAll}
            style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
          >
            {selectedChannelIds.length === channels.length ? '全不选' : '全选'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Real Channels List */}
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>大模型厂商渠道 ({channels.length})</span>
            <button
              onClick={handleOpenSettingsChannels}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '10.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: 0
              }}
            >
              <Settings size={11} />
              <span>管理渠道</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {channels.map(c => {
              const isSelected = selectedChannelIds.includes(c.id);
              const isTesting = probingMap[c.id] || false;
              const hasKey = !!c.key && c.key.trim().length > 0;
              const isFreeNoKey = c.type === 4 || c.id === 'chan-opencode' || c.id === 'chan-ollama';

              return (
                <div
                  key={c.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'border 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                      <div
                        onClick={() => toggleSelectChannel(c.id)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        {isSelected ? (
                          <CheckSquare size={14} color="var(--accent)" />
                        ) : (
                          <Square size={14} color="var(--text-muted)" />
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {/* Latency badge */}
                      {c.responseTime && c.responseTime > 0 ? (
                        <span style={{
                          fontSize: '10px',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: c.responseTime < 800 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                          color: c.responseTime < 800 ? '#22C55E' : '#EAB308',
                          fontWeight: 700
                        }}>
                          {c.responseTime}ms
                        </span>
                      ) : null}

                      {/* Key badge */}
                      {hasKey ? (
                        <span style={{
                          fontSize: '9.5px',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: 'rgba(34, 197, 94, 0.12)',
                          color: '#22C55E',
                          fontWeight: 600
                        }}>
                          已配Key
                        </span>
                      ) : isFreeNoKey ? (
                        <span style={{
                          fontSize: '9.5px',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#38BDF8',
                          fontWeight: 600
                        }}>
                          免配Key
                        </span>
                      ) : (
                        <span
                          onClick={handleOpenSettingsChannels}
                          style={{
                            fontSize: '9.5px',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#EF4444',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="点击打开设置以配置该厂商 API Key"
                        >
                          未配Key
                        </span>
                      )}

                      {/* Ping Button */}
                      <button
                        onClick={() => handleTestSingle(c)}
                        disabled={isTesting}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          background: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '10px',
                          cursor: isTesting ? 'wait' : 'pointer'
                        }}
                      >
                        <Zap size={9} color={isTesting ? 'var(--accent)' : 'var(--text-muted)'} />
                        <span>{isTesting ? '测速中...' : '测速'}</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      {c.baseUrl.replace(/^https?:\/\//, '')}
                    </span>
                    <span>{c.models?.length || 0} 个可用模型</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Settings Shortcut */}
        <div style={{
          padding: '10px',
          borderRadius: '6px',
          background: 'var(--bg-surface)',
          border: '1px dashed var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
            <Settings size={13} color="var(--accent)" />
            <span>渠道配置中心</span>
          </div>
          <p style={{ margin: 0, fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            支持自定义添加 OpenAI / Anthropic / DeepSeek / Ollama 等任意私有中转站及多 Key 负载均衡。
          </p>
          <button
            onClick={handleOpenSettingsChannels}
            style={{
              padding: '5px 10px',
              borderRadius: '4px',
              background: 'var(--accent)',
              color: '#FFF',
              border: 'none',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              marginTop: '4px'
            }}
          >
            <Settings size={12} />
            <span>打开模型服务商设置</span>
          </button>
        </div>
      </div>
    </div>
  );
};
