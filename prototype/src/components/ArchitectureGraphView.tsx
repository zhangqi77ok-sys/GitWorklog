import React, { useState } from 'react';
import { Boxes, ArrowRight, ShieldCheck, AlertTriangle, Wrench, RefreshCw, Layers } from 'lucide-react';
import { MOCK_TOPOLOGY_NODES, ArchitectureTopologyNode } from '../types/contracts';

export const ArchitectureGraphView: React.FC = () => {
  const [nodes, setNodes] = useState<ArchitectureTopologyNode[]>(MOCK_TOPOLOGY_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('pkg-web');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCascadeFix = (nodeId: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, status: 'healthy', impactCount: 0 } : n));
    setToastMessage('✓ 已自动为 @codemind/web 补全上层接口适配层，3处波及已全部修复！');
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      userSelect: 'none',
      position: 'relative'
    }}>
      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 14px',
          borderRadius: '20px',
          background: '#16A34A',
          color: '#FFF',
          fontSize: '11px',
          fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 50
        }}>
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Boxes size={15} color="var(--accent)" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Monorepo 语义架构依赖与影响面图谱
          </span>
          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', fontWeight: 600 }}>
            4 个模块 · 0 循环依赖
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10.5px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A' }} /> 正常
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontWeight: 600 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DC2626' }} /> 受波及 (1)
          </span>
        </div>
      </div>

      {/* Graph Visual Canvas */}
      <div style={{ flex: 1, padding: '20px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Tier 1: Core Package */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            onClick={() => setSelectedNodeId('pkg-core')}
            style={{
              width: '280px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              border: selectedNodeId === 'pkg-core' ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>@codemind/core</span>
              <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(217, 107, 39, 0.12)', color: 'var(--accent)', fontWeight: 600 }}>
                ✏️ 本次修改源
              </span>
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              核心数据契约与纯函数库 (contracts.ts)
            </div>
          </div>
        </div>

        {/* Downward Flow Connectors */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 80px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#DC2626' }}>
            <span style={{ fontSize: '9px', fontWeight: 600 }}>破坏性引用 ➔</span>
            <div style={{ width: '2px', height: '24px', background: '#DC2626' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#16A34A' }}>
            <span style={{ fontSize: '9px', fontWeight: 600 }}>契约兼容 ➔</span>
            <div style={{ width: '2px', height: '24px', background: '#16A34A' }} />
          </div>
        </div>

        {/* Tier 2: Dependent Applications */}
        <div style={{ display: 'flex', justifyContent: 'space-around', gap: '16px' }}>
          {/* Web App Node (Impacted) */}
          <div
            onClick={() => setSelectedNodeId('pkg-web')}
            style={{
              width: '260px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              border: nodes.find(n => n.id === 'pkg-web')?.status === 'impacted' ? '2px solid #EF4444' : '1px solid #16A34A',
              boxShadow: '0 4px 16px rgba(239, 68, 68, 0.12)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>@codemind/web (UI)</span>
              {nodes.find(n => n.id === 'pkg-web')?.status === 'impacted' ? (
                <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: '#EF4444', color: '#FFF', fontWeight: 600 }}>
                  🔴 3 处波及
                </span>
              ) : (
                <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: '#16A34A', color: '#FFF', fontWeight: 600 }}>
                  ✓ 已修复
                </span>
              )}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              前端视图应用 (ChatColumn.tsx, OptionsCard.tsx)
            </div>
            {nodes.find(n => n.id === 'pkg-web')?.status === 'impacted' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCascadeFix('pkg-web');
                }}
                style={{
                  marginTop: '4px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: '#EF4444',
                  border: 'none',
                  color: '#FFF',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <Wrench size={11} />
                <span>一键执行跨包级联修复</span>
              </button>
            )}
          </div>

          {/* API Gateway Node (Healthy) */}
          <div
            onClick={() => setSelectedNodeId('pkg-api')}
            style={{
              width: '260px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              border: selectedNodeId === 'pkg-api' ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)' }}>@codemind/api</span>
              <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(22, 163, 74, 0.1)', color: '#16A34A', fontWeight: 600 }}>
                🟢 契约兼容
              </span>
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              后端模型路由与网关服务 (Gateway.ts)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
