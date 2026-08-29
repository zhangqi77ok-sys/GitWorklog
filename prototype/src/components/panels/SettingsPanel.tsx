import React, { useState } from 'react';
import { Shield, Lock, DollarSign, Palette, Sliders } from 'lucide-react';
import { SystemSettings } from '../../types/contracts';

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    airGappedMode: false,
    dailyTokenLimit: 10.0,
    contextWarnRatio: 0.6,
    defaultPermission: 'autonomous_agent',
    theme: 'cream'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          全局系统设置与首选项
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
        {/* 1. Air-Gapped Physical Offline Mode */}
        <div style={{
          padding: '10px',
          borderRadius: '6px',
          background: settings.airGappedMode ? 'rgba(22, 163, 74, 0.1)' : 'var(--bg-surface)',
          border: `1px solid ${settings.airGappedMode ? '#16A34A' : 'var(--border-subtle)'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <Lock size={13} color={settings.airGappedMode ? '#16A34A' : 'var(--accent)'} />
              <span>物理级纯离线模式 (Air-Gapped)</span>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, airGappedMode: !prev.airGappedMode }))}
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                border: 'none',
                background: settings.airGappedMode ? '#16A34A' : 'var(--border-strong)',
                color: '#FFF',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {settings.airGappedMode ? '已开启' : '已关闭'}
            </button>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            硬阻断所有外部公网请求，仅绑定本地私有 Ollama，满足涉密金融与军工级安全合规。
          </p>
        </div>

        {/* 2. Token Budget Alert */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, marginBottom: '6px' }}>
            <DollarSign size={13} color="var(--accent)" />
            <span>Token 预算限额与警戒线</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>每日消耗预算上限:</span>
              <span style={{ fontWeight: 600 }}>${settings.dailyTokenLimit.toFixed(2)} USD</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>上下文窗口告警水位:</span>
              <span style={{ fontWeight: 600 }}>{settings.contextWarnRatio * 100}%</span>
            </div>
          </div>
        </div>

        {/* 3. Theme System */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, marginBottom: '6px' }}>
            <Palette size={13} color="var(--accent)" />
            <span>视觉主题系统</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{
              flex: 1,
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid var(--accent)',
              background: '#FAF8F5',
              color: 'var(--accent)',
              textAlign: 'center',
              fontWeight: 600
            }}>
              暖米白 (经典)
            </div>
            <div style={{
              flex: 1,
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid var(--border-subtle)',
              background: '#1E1C1A',
              color: '#FFF',
              textAlign: 'center',
              opacity: 0.6,
              cursor: 'pointer'
            }}>
              暖炭黑 (夜间)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
