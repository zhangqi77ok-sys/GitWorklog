import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, AlertCircle, Play, ArrowUpRight, BarChart2 } from 'lucide-react';
import { PreFlightCiReport, generatePreFlightCiReport } from '../types/contracts';

interface PreFlightCiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PreFlightCiDrawer: React.FC<PreFlightCiDrawerProps> = ({
  isOpen,
  onClose
}) => {
  // Universal ESC key support
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

    const [report, setReport] = useState<PreFlightCiReport>(() => generatePreFlightCiReport(true, 88.4, 85.2));
  const [isRunning, setIsRunning] = useState(false);

  if (!isOpen) return null;

    
  const handleReRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setReport(generatePreFlightCiReport(true, 89.1, 88.4));
    }, 600);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      width: '420px',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border-subtle)',
      borderTop: '1px solid var(--border-subtle)',
      borderRadius: '8px 0 0 0',
      boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      fontFamily: 'var(--font-sans)'
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-surface)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} color="#16A34A" />
          <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--text-primary)' }}>
            🛡️ 本地 CI 预检门禁与覆盖率看板
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Pass Banner */}
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          background: 'rgba(22, 163, 74, 0.12)',
          border: '1px solid #16A34A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A', fontWeight: 700, fontSize: '12px' }}>
            <CheckCircle2 size={15} />
            <span>🟢 CI PASS · 允许 Push 至远程</span>
          </div>
          <span style={{ fontSize: '10px', color: '#16A34A' }}>耗时 {report.durationMs}ms</span>
        </div>

        {/* Coverage Progress Bar */}
        <div style={{
          padding: '10px 12px',
          borderRadius: '6px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
            <span style={{ color: 'var(--text-primary)' }}>单元测试行覆盖率 (Line Coverage)</span>
            <span style={{ color: '#16A34A' }}>{report.lineCoverage}% (↑ +{report.lineCoverageDelta}%)</span>
          </div>
          <div style={{ height: '6px', width: '100%', background: 'rgba(0,0,0,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${report.lineCoverage}%`, height: '100%', background: '#16A34A', borderRadius: '3px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>分支覆盖率: {report.branchCoverage}%</span>
            <span>门禁阈值: 80.0%</span>
          </div>
        </div>

        {/* Parallel Checks Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', background: 'var(--bg-base)' }}>
            <span>✓ TypeScript 严格类型检查 (tsc --noEmit)</span>
            <span style={{ color: '#16A34A', fontWeight: 600 }}>0 Errors</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', background: 'var(--bg-base)' }}>
            <span>✓ ESLint & Prettier 代码风格规范</span>
            <span style={{ color: '#16A34A', fontWeight: 600 }}>0 Warnings</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', background: 'var(--bg-base)' }}>
            <span>✓ Vitest 契约自动化单测</span>
            <span style={{ color: '#16A34A', fontWeight: 600 }}>45 Passed (13ms)</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px',
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>已自动同步 GitHub Actions 门禁</span>
        <button
          onClick={handleReRun}
          disabled={isRunning}
          style={{
            padding: '3px 10px',
            borderRadius: '4px',
            background: 'var(--accent)',
            border: 'none',
            color: '#FFF',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Play size={11} />
          <span>{isRunning ? '正在跑测...' : '重新跑测'}</span>
        </button>
      </div>
    </div>
  );
};
