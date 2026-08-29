import React, { useState } from 'react';
import { Cpu, CheckCircle2, Zap, Server, Plus, RefreshCw, Layers } from 'lucide-react';
import { ProviderHealth, McpServerInfo } from '../../types/contracts';

export const GatewayCockpitPanel: React.FC = () => {
  const [providers, setProviders] = useState<ProviderHealth[]>([
    { id: 'anthropic', name: 'Anthropic (Claude)', status: 'healthy', latencyMs: 128, endpoint: 'api.anthropic.com', activeModel: 'Claude 3.5 Sonnet' },
    { id: 'deepseek', name: 'DeepSeek', status: 'healthy', latencyMs: 85, endpoint: 'api.deepseek.com', activeModel: 'DeepSeek-V3' },
    { id: 'openai', name: 'OpenAI', status: 'healthy', latencyMs: 142, endpoint: 'api.openai.com', activeModel: 'GPT-4o' },
    { id: 'local-ollama', name: '本地 Ollama (私有)', status: 'healthy', latencyMs: 0, endpoint: 'localhost:11434', activeModel: 'Qwen 2.5 Coder 32B' }
  ]);

  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([
    { id: 'fs', name: 'filesystem-mcp', status: 'connected', toolsCount: 8, tools: ['read_file', 'write_file', 'list_dir', 'grep'] },
    { id: 'git', name: 'git-mcp', status: 'connected', toolsCount: 5, tools: ['commit', 'diff', 'status', 'rollback'] },
    { id: 'search', name: 'web-search-mcp', status: 'connected', toolsCount: 2, tools: ['search_bing', 'search_arxiv'] }
  ]);

  const [isTesting, setIsTesting] = useState(false);

  const handleTestAll = () => {
    setIsTesting(true);
    setTimeout(() => {
      setProviders(prev => prev.map(p => ({ ...p, latencyMs: Math.floor(Math.random() * 80) + 60 })));
      setIsTesting(false);
    }, 600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          模型网关与 MCP 驾驶舱
        </span>
        <button
          onClick={handleTestAll}
          title="测试全渠道连通性"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
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
          <span>{isTesting ? '测试中...' : '测试连通性'}</span>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* 1. Multi-Provider Health Status */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            模型厂商渠道状态
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {providers.map(p => (
              <div
                key={p.id}
                style={{
                  padding: '6px 8px',
                  borderRadius: '5px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '11px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                  <span style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: 'rgba(22, 163, 74, 0.1)',
                    color: '#16A34A',
                    fontWeight: 600
                  }}>
                    {p.latencyMs === 0 ? '本地直连 · 0ms' : `${p.latencyMs}ms`}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  活跃模型: {p.activeModel}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. MCP Tool Servers */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              MCP 工具服务器 ({mcpServers.length})
            </span>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <Plus size={11} />
              <span>添加 MCP</span>
            </button>
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
                  <span style={{ color: '#16A34A', fontSize: '10px' }}>● 已连接</span>
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
