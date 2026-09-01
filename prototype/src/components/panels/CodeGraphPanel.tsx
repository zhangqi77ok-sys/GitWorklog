import React, { useState, useEffect, useRef } from 'react';
import {
  codeGraphService,
  GraphNode,
  GraphEdge,
  BlastRadiusResponse,
} from '../../services/codeGraphService';
import {
  Share2,
  RefreshCw,
  Activity,
  Layers,
  FileCode,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Flame,
} from 'lucide-react';

interface CodeGraphPanelProps {
  onOpenFile?: (path: string, fileName?: string, line?: number) => void;
}

const KIND_FILTERS = ['All', 'Class', 'Function', 'Method', 'Interface'];

export const CodeGraphPanel: React.FC<CodeGraphPanelProps> = ({ onOpenFile }) => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKind, setSelectedKind] = useState('All');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [blastHops, setBlastHops] = useState<number>(2);
  const [blastData, setBlastData] = useState<BlastRadiusResponse | null>(null);
  const [loadingBlast, setLoadingBlast] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    loadGraph(selectedKind);
  }, [selectedKind]);

  const loadGraph = async (k: string) => {
    setLoading(true);
    const data = await codeGraphService.fetchWorkspaceGraph(k === 'All' ? undefined : k, 60);
    const width = 340;
    const height = 240;
    const initialNodes = (data.nodes || []).map((n, i, arr) => {
      const angle = (i / (arr.length || 1)) * 2 * Math.PI;
      const radius = 65 + (i % 3) * 25;
      return {
        ...n,
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      };
    });
    setNodes(initialNodes);
    setEdges(data.edges || []);
    setLoading(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background fine grid dots
    ctx.fillStyle = 'rgba(217, 107, 39, 0.04)';
    for (let x = 10; x < canvas.width; x += 15) {
      for (let y = 10; y < canvas.height; y += 15) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    const nodeMap = new Map<number, GraphNode>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    // 1. Draw Edges
    edges.forEach((edge) => {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (src && tgt && src.x && src.y && tgt.x && tgt.y) {
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = '#D5CEC7';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Arrow head
        const headlen = 5;
        const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        ctx.beginPath();
        ctx.moveTo(tgt.x, tgt.y);
        ctx.lineTo(tgt.x - headlen * Math.cos(angle - Math.PI / 6), tgt.y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(tgt.x - headlen * Math.cos(angle + Math.PI / 6), tgt.y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.fillStyle = '#D96B27';
        ctx.fill();
      }
    });

    // 2. Draw Blast Radius Ripple for selected node
    if (selectedNode && selectedNode.x && selectedNode.y && blastData) {
      const radiusStep = 28;
      for (let h = 1; h <= blastHops; h++) {
        ctx.beginPath();
        ctx.arc(selectedNode.x, selectedNode.y, radiusStep * h + 10, 0, 2 * Math.PI);
        ctx.strokeStyle = h === 1 ? 'rgba(217, 107, 39, 0.45)' : 'rgba(217, 107, 39, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 3. Draw Nodes
    const impactedIds = new Set((blastData?.impacted_nodes || []).map((n) => n.symbol_id));

    nodes.forEach((n) => {
      if (!n.x || !n.y) return;
      const isSelected = selectedNode?.id === n.id;
      const isImpacted = impactedIds.has(n.id);

      ctx.beginPath();
      ctx.arc(n.x, n.y, isSelected ? 8 : isImpacted ? 6 : 5, 0, 2 * Math.PI);

      if (isSelected) {
        ctx.fillStyle = '#D96B27';
      } else if (isImpacted) {
        ctx.fillStyle = '#E88B52';
      } else if (n.kind === 'Class') {
        ctx.fillStyle = '#D96B27';
      } else if (n.kind === 'Interface') {
        ctx.fillStyle = '#7C3AED';
      } else {
        ctx.fillStyle = '#2563EB';
      }
      ctx.fill();
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Label
      if (isSelected || isImpacted || nodes.length < 25) {
        ctx.font = isSelected ? 'bold 10px monospace' : '9px monospace';
        ctx.fillStyle = isSelected ? '#1E1C1A' : '#57534E';
        ctx.fillText(n.name, n.x + 8, n.y + 3);
      }
    });
  }, [nodes, edges, selectedNode, blastData, blastHops]);

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clicked = nodes.find((n) => {
      if (!n.x || !n.y) return false;
      const dist = Math.sqrt((n.x - clickX) ** 2 + (n.y - clickY) ** 2);
      return dist <= 14;
    });

    if (clicked) {
      setSelectedNode(clicked);
      setLoadingBlast(true);
      const bData = await codeGraphService.fetchBlastRadius(clicked.id, blastHops);
      setBlastData(bData);
      setLoadingBlast(false);
    } else {
      setSelectedNode(null);
      setBlastData(null);
    }
  };

  const handleHopsChange = async (h: number) => {
    setBlastHops(h);
    if (selectedNode) {
      setLoadingBlast(true);
      const bData = await codeGraphService.fetchBlastRadius(selectedNode.id, h);
      setBlastData(bData);
      setLoadingBlast(false);
    }
  };

  const handleOpenFileClick = (filePath: string, line: number) => {
    if (onOpenFile) {
      const fileName = filePath.split('/').pop() || filePath;
      onOpenFile(filePath, fileName, line);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
        userSelect: 'none',
        fontSize: '12px',
        color: 'var(--text-primary)',
      }}
    >
      {/* 顶部 Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
            <Share2 size={15} color="var(--accent-orange)" />
            <span>代码语义拓扑图谱</span>
          </div>
          <button
            onClick={() => loadGraph(selectedKind)}
            disabled={loading}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              background: 'var(--bg-base)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>刷新</span>
          </button>
        </div>

        {/* 分类 Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
          {KIND_FILTERS.map((k) => {
            const active = selectedKind === k;
            return (
              <button
                key={k}
                onClick={() => setSelectedKind(k)}
                style={{
                  padding: '2px 8px',
                  fontSize: '10.5px',
                  borderRadius: '12px',
                  border: active ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
                  background: active ? 'rgba(217, 107, 39, 0.12)' : 'var(--bg-base)',
                  color: active ? 'var(--accent-orange)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {k}
              </button>
            );
          })}
        </div>

        {/* 爆炸半径控制条 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            background: 'var(--bg-base)',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <Activity size={12} color="var(--accent-orange)" />
            <span>爆炸半径分析:</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            {[1, 2, 3].map((h) => (
              <button
                key={h}
                onClick={() => handleHopsChange(h)}
                style={{
                  padding: '1px 6px',
                  fontSize: '10px',
                  borderRadius: '4px',
                  border: blastHops === h ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
                  background: blastHops === h ? 'var(--accent-orange)' : 'var(--bg-surface)',
                  color: blastHops === h ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {h} Hop{h > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 画布区域 */}
      <div
        style={{
          height: '240px',
          width: '100%',
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {loading ? (
          <div style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>构建语义拓扑中...</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={340}
            height={240}
            onClick={handleCanvasClick}
            style={{ cursor: 'pointer', width: '100%', height: '100%' }}
          />
        )}
      </div>

      {/* 底部详情与受波及列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {selectedNode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* 选中节点详情卡 */}
            <div
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--accent-orange)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    padding: '1px 5px',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    borderRadius: '3px',
                    background: 'rgba(217, 107, 39, 0.12)',
                    color: 'var(--accent-orange)',
                  }}
                >
                  {selectedNode.kind}
                </span>
                <span
                  onClick={() => handleOpenFileClick(selectedNode.file_path, selectedNode.range_start_line)}
                  style={{
                    fontSize: '10px',
                    color: 'var(--accent-orange)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <span>打开代码</span>
                  <ExternalLink size={10} />
                </span>
              </div>
              <h4 style={{ margin: 0, fontSize: '12px', fontWeight: 700, fontFamily: 'monospace' }}>
                {selectedNode.name}
              </h4>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                {selectedNode.file_path}:L{selectedNode.range_start_line}
              </div>
            </div>

            {/* 爆炸半径波及列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Flame size={12} color="var(--accent-orange)" />
                  <span>受波及下游模块 ({blastData?.total_impacted || 0})</span>
                </div>
                {loadingBlast && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>计算中...</span>}
              </div>

              {blastData?.impacted_nodes.map((imp, idx) => (
                <div
                  key={idx}
                  onClick={() => handleOpenFileClick(imp.file_path, imp.range_start_line)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '5px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'monospace' }}>{imp.name}</span>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-tertiary)' }}>
                      {imp.file_path}:L{imp.range_start_line}
                    </span>
                  </div>
                  <span
                    style={{
                      padding: '1px 5px',
                      fontSize: '9.5px',
                      fontWeight: 700,
                      borderRadius: '3px',
                      background:
                        imp.severity === 'CRITICAL'
                          ? 'rgba(239, 68, 68, 0.12)'
                          : imp.severity === 'HIGH'
                          ? 'rgba(217, 107, 39, 0.12)'
                          : 'rgba(120, 113, 108, 0.1)',
                      color:
                        imp.severity === 'CRITICAL'
                          ? '#DC2626'
                          : imp.severity === 'HIGH'
                          ? 'var(--accent-orange)'
                          : '#57534E',
                    }}
                  >
                    {imp.severity} ({imp.hop}H)
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '30px 12px',
              color: 'var(--text-tertiary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={20} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: '11.5px' }}>点击上方拓扑节点</span>
            <span style={{ fontSize: '10.5px' }}>实时计算重构爆炸半径与上下游依赖</span>
          </div>
        )}
      </div>
    </div>
  );
};
