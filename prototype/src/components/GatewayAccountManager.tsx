import React, { useMemo, useState } from 'react';
import { gatewayRuntime, persistGatewayRuntime } from '../services/gateway/gatewayRuntime';
import { buildAuthorizeUrl, OAUTH_ENDPOINTS } from '../services/gateway/oauth';
import { maskKey } from '../services/gateway/keys';
import type { AccountAuthType, GatewayAccount, GatewayPlatform } from '../services/gateway/types';

const PLATFORMS: Array<{ id: GatewayPlatform; label: string; hint: string }> = [
  { id: 'codex', label: 'Codex', hint: 'OAuth / RT / API Key' },
  { id: 'claude', label: 'Claude', hint: 'OAuth / API Key' },
  { id: 'grok', label: 'Grok', hint: 'OAuth / RT / API Key' },
  { id: 'gemini', label: 'Gemini', hint: 'OAuth / API Key' },
  { id: 'openai', label: 'OpenAI', hint: 'API Key' },
  { id: 'deepseek', label: 'DeepSeek', hint: 'API Key' },
  { id: 'openai-compatible', label: 'OpenAI 兼容', hint: 'API Key' },
  { id: 'local', label: '本地', hint: '免 Key' }
];

const AUTH_TYPES: Array<{ id: AccountAuthType; label: string }> = [
  { id: 'api_key', label: 'API Key' },
  { id: 'oauth', label: 'OAuth 完整' },
  { id: 'refresh_token', label: 'RT 手动' },
  { id: 'setup_token', label: 'Setup Token' }
];

function statusColor(status: GatewayAccount['status']): string {
  switch (status) {
    case 'active': return '#2F9E44';
    case 'quota_exhausted': return '#E8590C';
    case 'error': return '#E03131';
    case 'expired': return '#F08C00';
    default: return '#868E96';
  }
}

export const GatewayAccountManager: React.FC = () => {
  const [activePlatform, setActivePlatform] = useState<GatewayPlatform>('codex');
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [version, setVersion] = useState(0);

  const registry = gatewayRuntime.registry;
  const keys = gatewayRuntime.keys;
  const ledger = gatewayRuntime.ledger;

  const accounts = useMemo(() => registry.byPlatform(activePlatform), [registry, activePlatform, version]);

  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const refresh = () => {
    persistGatewayRuntime();
    notify('✓ 已持久化网关状态（账号/密钥/用量）');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
          ⚙️ 模型网关 v2 · 多账号分发
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={refresh} style={{ padding: '5px 10px', borderRadius: '5px', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', fontSize: '10.5px', cursor: 'pointer' }}>💾 保存</button>
          <button onClick={() => setShowAdd(true)} style={{ padding: '5px 10px', borderRadius: '5px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}>＋ 添加账号</button>
        </div>
      </div>

      {/* Platform selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {PLATFORMS.map(p => {
          const count = gatewayRuntime.registry.byPlatform(p.id).length;
          const active = activePlatform === p.id;
          return (
            <div key={p.id} onClick={() => setActivePlatform(p.id)} style={{ padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', border: active ? '1px solid var(--accent)' : '1px solid var(--border-subtle)', background: active ? 'var(--accent-subtle)' : 'transparent', display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{p.label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({count})</span></span>
              <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>{p.hint}</span>
            </div>
          );
        })}
      </div>

      {toast && <div style={{ padding: '6px 10px', borderRadius: '5px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: '10.5px', fontWeight: 600 }}>{toast}</div>}

      {/* Accounts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
        {accounts.length === 0 && (
          <div style={{ padding: '14px', borderRadius: '6px', border: '1px dashed var(--border-strong)', textAlign: 'center', fontSize: '10.5px', color: 'var(--text-muted)' }}>
            该平台还没有账号。点击「添加账号」挂载 OAuth / RT / API Key 账号。
          </div>
        )}
        {accounts.map(account => (
          <AccountCard key={account.id} account={account} onChanged={refresh} />
        ))}
      </div>

      {showAdd && <AddAccountForm platform={activePlatform} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); refresh(); }} />}

      {/* Downstream keys */}
      <DownstreamKeys onChanged={refresh} />

      {/* Usage summary */}
      <UsageSummary />
    </div>
  );
};

function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

const AccountCard: React.FC<{ account: GatewayAccount; onChanged: () => void }> = ({ account, onChanged }) => {
  const credential = account.credential;
  const usedTokens = gatewayRuntime.ledger.byAccount(account.id);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor(account.status), flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{account.label}</span>
          <span style={{ fontSize: '9px', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '1px 6px', borderRadius: '4px' }}>{account.authType}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{account.id}</span>
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span>并发 {account.concurrency.active}/{account.concurrency.max}</span>
          <span>额度 {account.quota.used}/{account.quota.limit} · 剩余 {account.quota.remaining}</span>
          <span>Token ↑{usedTokens.inputTokens} ↓{usedTokens.outputTokens}</span>
          <span>凭据: {credential.apiKey ? maskSecret(credential.apiKey) : credential.accessToken ? maskSecret(credential.accessToken) : credential.setupToken ? maskSecret(credential.setupToken) : '未配置'}</span>
        </div>
      </div>
      <button onClick={() => { gatewayRuntime.registry.update(account.id, { enabled: !account.enabled }); onChanged(); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', fontSize: '9.5px', cursor: 'pointer' }}>
        {account.enabled ? '停用' : '启用'}
      </button>
      <button onClick={() => { gatewayRuntime.registry.remove(account.id); onChanged(); }} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #F3BFBF', background: '#FFF5F5', color: '#C92A2A', fontSize: '9.5px', cursor: 'pointer' }}>
        删除
      </button>
    </div>
  );
};

const AddAccountForm: React.FC<{ platform: GatewayPlatform; onClose: () => void; onDone: () => void }> = ({ platform, onClose, onDone }) => {
  const [label, setLabel] = useState('');
  const [authType, setAuthType] = useState<AccountAuthType>('api_key');
  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [models, setModels] = useState('');
  const [concurrencyMax, setConcurrencyMax] = useState('4');

  const platformDef = PLATFORMS.find(p => p.id === platform)!;
  const authorizeHint = OAUTH_ENDPOINTS[platform]
    ? buildAuthorizeUrl(platform, { clientId: 'tcode-app', redirectUri: 'http://127.0.0.1:8010/oauth/callback' })
    : null;

  const submit = () => {
    const credential: GatewayAccount['credential'] = { authType };
    if (apiKey.trim()) credential.apiKey = apiKey.trim();
    if (accessToken.trim()) credential.accessToken = accessToken.trim();
    if (refreshToken.trim()) credential.refreshToken = refreshToken.trim();
    if (setupToken.trim()) credential.setupToken = setupToken.trim();
    gatewayRuntime.registry.add({
      platform,
      label: label.trim() || `${platformDef.label} 账号 ${gatewayRuntime.registry.byPlatform(platform).length + 1}`,
      authType,
      credential,
      baseUrl: baseUrl.trim() || undefined,
      models: models.split(',').map(s => s.trim()).filter(Boolean),
      concurrencyMax: Math.max(1, Number(concurrencyMax) || 4)
    });
    onDone();
  };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', fontSize: '10.5px', color: 'var(--text-primary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>添加 {platformDef.label} 账号</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <input placeholder="账号名称（如 codex-主号）" value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} />
        <select value={authType} onChange={e => setAuthType(e.target.value as AccountAuthType)} style={inputStyle}>
          {AUTH_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        {(authType === 'api_key') && <input placeholder="API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} style={inputStyle} />}
        {authType === 'setup_token' && <input placeholder="Setup Token" value={setupToken} onChange={e => setSetupToken(e.target.value)} style={inputStyle} />}
        {(authType === 'oauth' || authType === 'refresh_token') && <input placeholder="Access Token" value={accessToken} onChange={e => setAccessToken(e.target.value)} style={inputStyle} />}
        {(authType === 'oauth' || authType === 'refresh_token') && <input placeholder="Refresh Token" value={refreshToken} onChange={e => setRefreshToken(e.target.value)} style={inputStyle} />}
        <input placeholder="Base URL（留空用默认）" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} style={inputStyle} />
        <input placeholder="模型白名单（逗号分隔，留空=全部）" value={models} onChange={e => setModels(e.target.value)} style={inputStyle} />
        <input placeholder="并发上限（默认 4）" type="number" value={concurrencyMax} onChange={e => setConcurrencyMax(e.target.value)} style={inputStyle} />
      </div>
      {authorizeHint && (
        <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.5, wordBreak: 'break-all' }}>
          🔑 手动授权：打开以下地址完成授权后，将回调中的 code / token 填入上方：
          <br />
          <span style={{ color: 'var(--accent)' }}>{authorizeHint}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', fontSize: '10.5px', cursor: 'pointer' }}>取消</button>
        <button onClick={submit} style={{ padding: '5px 12px', borderRadius: '5px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}>保存账号</button>
      </div>
    </div>
  );
};

const DownstreamKeys: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [name, setName] = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const keys = gatewayRuntime.keys.list();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>🔑 API Key 分发（下游客户端）</span>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input placeholder="Key 名称（如 团队A）" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', fontSize: '10.5px' }} />
        <input placeholder="每日Token预算" type="number" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} style={{ width: '110px', padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', fontSize: '10.5px' }} />
        <button onClick={() => { gatewayRuntime.keys.issue({ name: name.trim() || '新 Key', dailyTokenBudget: Number(dailyBudget) || undefined }); setName(''); setDailyBudget(''); onChanged(); }} style={{ padding: '6px 12px', borderRadius: '5px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}>签发</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
        {keys.map(k => {
          const used = gatewayRuntime.ledger.byKey(k.id);
          return (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{k.name} {k.enabled ? '' : '(已禁用)'}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  {showSecret[k.id] ? k.key : maskKey(k.key)}
                  {' · '}↑{used.inputTokens} ↓{used.outputTokens}{k.dailyTokenBudget ? ` · 预算 ${k.dailyTokenBudget}` : ''}
                </div>
              </div>
              <button onClick={() => setShowSecret(s => ({ ...s, [k.id]: !s[k.id] }))} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', fontSize: '9.5px', cursor: 'pointer' }}>{showSecret[k.id] ? '隐藏' : '显示'}</button>
              <button onClick={() => { navigator.clipboard?.writeText(k.key).catch(() => {}); }} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', fontSize: '9.5px', cursor: 'pointer' }}>复制</button>
              <button onClick={() => { gatewayRuntime.keys.revoke(k.id); onChanged(); }} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #F3BFBF', background: '#FFF5F5', color: '#C92A2A', fontSize: '9.5px', cursor: 'pointer' }}>吊销</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const UsageSummary: React.FC = () => {
  const total = gatewayRuntime.ledger.total();
  const cost = total.inputTokens * 0.000001 + total.outputTokens * 0.000002;
  return (
    <div style={{ display: 'flex', gap: '16px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface-elevated)', fontSize: '10px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
      <span>累计 Token：↑{total.inputTokens.toLocaleString()} / ↓{total.outputTokens.toLocaleString()}</span>
      <span>缓存读：{total.cacheReadTokens.toLocaleString()}</span>
      <span>预估成本：${cost.toFixed(6)}</span>
      <span>账号数：{gatewayRuntime.registry.all().length}</span>
      <span>下游 Key 数：{gatewayRuntime.keys.list().length}</span>
    </div>
  );
};
