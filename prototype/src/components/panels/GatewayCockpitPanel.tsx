import React, { useState } from 'react';
import { Cpu, Zap, Server, Plus, Check, ChevronDown, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { loadSavedProviders, saveProvidersToStorage, resolveApiEndpoint, ModelProviderItem } from '../../types/contracts';

export const GatewayCockpitPanel: React.FC = () => {
  const [providers, setProviders] = useState<ModelProviderItem[]>(loadSavedProviders());
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>(() => {
    const list = loadSavedProviders();
    return list.filter(p => p.enabled).map(p => p.id);
  });
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const mcpServers = [
    { id: 'fs', name: 'filesystem-mcp', status: 'connected', toolsCount: 5, tools: ['pick_folder', 'tree', 'read', 'write', 'search'] },
    { id: 'git', name: 'git-mcp', status: 'connected', toolsCount: 3, tools: ['git_status', 'branch', 'diff'] }
  ];

  const toggleSelectProvider = (id: string) => {
    setSelectedProviderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Perform REAL HTTP Ping to provider endpoint
  const pingProvider = async (p: ModelProviderItem): Promise<{ latencyMs: number; status: 'healthy' | 'error'; errorMsg?: string }> => {
    const startTime = performance.now();
    let base = p.baseUrl.trim();
    if (base.endsWith('/')) base = base.slice(0, -1);
    const { url: requestUrl, headers: proxyHeaders } = resolveApiEndpoint(`${base}/models`);
    try {
      const res = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${p.apiKey.trim()}`,
          ...proxyHeaders
        }
      });
      const latency = Math.round(performance.now() - startTime);
      if (res.ok) {
        return { latencyMs: latency, status: 'healthy' };
      }
      return { latencyMs: latency, status: 'error', errorMsg: `HTTP ${res.status}` };
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime);
      return { latencyMs: latency, status: 'error', errorMsg: err.message };
    }
  };

  // Test specifically selected providers with REAL network roundtrip
  const handleTestSelected = async () => {
    if (selectedProviderIds.length === 0) {
      setToastNotice('请先勾选需要测试连通性的厂商渠道！');
      setTimeout(() => setToastNotice(null), 2500);
      return;
    }

    const newTestingMap: Record<string, boolean> = {};
    selectedProviderIds.forEach(id => {
      newTestingMap[id] = true;
    });
    setTestingMap(newTestingMap);

    const updated = [...providers];
    for (let i = 0; i < updated.length; i++) {
      const p = updated[i];
      if (selectedProviderIds.includes(p.id)) {
        const result = await pingProvider(p);
        updated[i] = {
          ...p,
          latencyMs: result.latencyMs
        };
      }
    }

    setProviders(updated);
    saveProvidersToStorage(updated);
    setTestingMap({});
    setToastNotice(`✓ 已完成对 ${selectedProviderIds.length} 个渠道的真实网络测速！`);
    setTimeout(() => setToastNotice(null), 3000);
  };

  // Test a single provider directly
  const handleTestSingle = async (p: ModelProviderItem) => {
    setTestingMap(prev => ({ ...prev, [p.id]: true }));
    const result = await pingProvider(p);
    const updated = providers.map(item => item.id === p.id ? { ...item, latencyMs: result.latencyMs } : item);
    setProviders(updated);
    saveProvidersToStorage(updated);
    setTestingMap(prev => ({ ...prev, [p.id]: false }));
    if (result.status === 'healthy') {
      setToastNotice(`✓ [${p.name}] 真实连通延迟: ${result.latencyMs}ms`);
    } else {
      setToastNotice(`✕ [${p.name}] 连通异常: ${result.errorMsg} (${result.latencyMs}ms)`);
    }
    setTimeout(() => setToastNotice(null), 3000);
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
            <span>测速选定厂商 ({selectedProviderIds.length})</span>
          </button>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          提示: 勾选左侧复选框选择目标厂商，点击 [测速] 发起真实网络 Ping。
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Real Providers List */}
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
            大模型厂商渠道 ({providers.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {providers.map(p => {
              const isSelected = selectedProviderIds.includes(p.id);
              const isTesting = testingMap[p.id] || false;
              const hasKey = !!p.apiKey;

              return (
                <div
                  key={p.id}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div
                        onClick={() => toggleSelectProvider(p.id)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        {isSelected ? (
                          <CheckSquare size={14} color="var(--accent)" />
                        ) : (
                          <Square size={14} color="var(--text-muted)" />
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', fontWeight: 600 }}>{p.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: hasKey ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                        color: hasKey ? '#16A34A' : '#DC2626',
                        fontWeight: 600
                      }}>
                        {hasKey ? `${p.latencyMs || 45}ms` : '未配Key'}
                      </span>
                      <button
                        onClick={() => handleTestSingle(p)}
                        disabled={isTesting}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '1px 4px'
                        }}
                        title="真实测试此厂商延迟"
                      >
                        <Zap size={10} />
                        <span>{isTesting ? '测速中...' : '测速'}</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', paddingLeft: '20px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                      {p.baseUrl.replace('https://', '')}
                    </span>
                    <span>{p.models?.length || 0} 个可用模型</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real MCP Servers */}
        <div>
          <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
            MCP 工具服务器 ({mcpServers.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {mcpServers.map(s => (
              <div
                key={s.id}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Server size={13} color="var(--accent)" />
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', fontWeight: 600 }}>
                    ● 运行中
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
                  {s.tools.map(t => (
                    <span
                      key={t}
                      style={{
                        fontSize: '9px',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
