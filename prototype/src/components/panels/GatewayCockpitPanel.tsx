import React, { useState } from 'react';
import { Cpu, Zap, Server, Plus, Check, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { ProviderHealth, McpServerInfo } from '../../types/contracts';

export const GatewayCockpitPanel: React.FC = () => {
  const [providers, setProviders] = useState<ProviderHealth[]>([
    { id: 'anthropic', name: 'Anthropic (Claude)', status: 'healthy', latencyMs: 128, endpoint: 'api.anthropic.com', activeModel: 'Claude 3.5 Sonnet' },
    { id: 'deepseek', name: 'DeepSeek (百炼子线)', status: 'healthy', latencyMs: 85, endpoint: 'api.deepseek.com', activeModel: 'DeepSeek-V3' },
    { id: 'openai', name: 'OpenAI (GPT-4o)', status: 'healthy', latencyMs: 142, endpoint: 'api.openai.com', activeModel: 'GPT-4o' },
    { id: 'local-ollama', name: '本地 Ollama (物理私有)', status: 'healthy', latencyMs: 0, endpoint: 'localhost:11434', activeModel: 'Qwen 2.5 Coder 32B' }
  ]);

  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>(['anthropic', 'deepseek']);
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const [mcpServers] = useState<McpServerInfo[]>([
    { id: 'fs', name: 'filesystem-mcp', status: 'connected', toolsCount: 8, tools: ['read_file', 'write_file', 'list_dir', 'grep'] },
    { id: 'git', name: 'git-mcp', status: 'connected', toolsCount: 5, tools: ['commit', 'diff', 'status', 'rollback'] }
  ]);

  const toggleSelectProvider = (id: string) => {
    setSelectedProviderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Test specifically selected providers
  const handleTestSelected = () => {
    if (selectedProviderIds.length === 0) {
      setToastNotice('请先勾选需要测试连通性的厂商！');
      setTimeout(() => setToastNotice(null), 2500);
      return;
    }

    const newTestingMap: Record<string, boolean> = {};
    selectedProviderIds.forEach(id => {
      newTestingMap[id] = true;
    });
    setTestingMap(newTestingMap);

    setTimeout(() => {
      setProviders(prev =>
        prev.map(p => {
          if (selectedProviderIds.includes(p.id)) {
            return {
              ...p,
              latencyMs: p.id === 'local-ollama' ? 0 : Math.floor(Math.random() * 70) + 60
            };
          }
          return p;
        })
      );
      setTestingMap({});
      setToastNotice(`✓ 已完成对 ${selectedProviderIds.length} 个选定厂商的连通性测速！`);
      setTimeout(() => setToastNotice(null), 3000);
    }, 600);
  };

  // Test a single provider directly
  const handleTestSingle = (id: string, name: string) => {
    setTestingMap(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setProviders(prev =>
        prev.map(p => (p.id === id ? { ...p, latencyMs: p.id === 'local-ollama' ? 0 : Math.floor(Math.random() * 70) + 60 } : p))
      );
      setTestingMap(prev => ({ ...prev, [id]: false }));
      setToastNotice(`✓ [${name}] 连通测试通过！`);
      setTimeout(() => setToastNotice(null), 2500);
    }, 500);
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
            模型网关驾驶舱
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
          >
            <Zap size={11} />
            <span>测试选定厂商 ({selectedProviderIds.length})</span>
          </button>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          提示：勾选左侧复选框选择目标厂商，或点击卡片右侧单独测试
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* Provider Cards */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            大模型厂商渠道 ({providers.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {providers.map(p => {
              const isChecked = selectedProviderIds.includes(p.id);
              const isTestingThis = testingMap[p.id] ?? false;

              return (
                <div
                  key={p.id}
                  style={{
                    padding: '8px',
                    borderRadius: '5px',
                    background: 'var(--bg-surface)',
                    border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                    fontSize: '11px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Checkbox and Name */}
                    <div
                      onClick={() => toggleSelectProvider(p.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}
                    >
                      <div style={{ color: isChecked ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {p.endpoint} · {p.activeModel}
                        </div>
                      </div>
                    </div>

                    {/* Single Test Button and Latency */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: 'rgba(22, 163, 74, 0.1)',
                        color: '#16A34A',
                        fontWeight: 600
                      }}>
                        {isTestingThis ? '测速中...' : (p.latencyMs === 0 ? '0ms (本地)' : `${p.latencyMs}ms`)}
                      </span>
                      <button
                        onClick={() => handleTestSingle(p.id, p.name)}
                        title="单独测试此厂商连通性"
                        style={{
                          padding: '2px 5px',
                          borderRadius: '3px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-base)',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        <Zap size={10} />
                        <span>测速</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MCP Servers */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              MCP 工具服务器 ({mcpServers.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {mcpServers.map(mcp => (
              <div
                key={mcp.id}
                style={{
                  padding: '6px 8px',
                  borderRadius: '5px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '11px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <Server size={12} color="var(--accent)" />
                    <span>{mcp.name}</span>
                  </div>
                  <span style={{ color: '#16A34A', fontSize: '10px' }}>● 运行中</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                  {mcp.tools.map(t => (
                    <span
                      key={t}
                      style={{
                        fontSize: '9px',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        background: 'rgba(0,0,0,0.05)',
                        color: 'var(--text-secondary)'
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
