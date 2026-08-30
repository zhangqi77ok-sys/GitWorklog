import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2, Save, Activity, KeyRound, Copy, CheckCircle2, XCircle, AlertTriangle, PauseCircle } from 'lucide-react';
import { gatewayRuntime, persistGatewayRuntime } from '../services/gateway/gatewayRuntime';
import { probeAccount, AccountProbeScheduler } from '../services/gateway/probe';
import { DEFAULT_BASE_URLS } from '../services/gateway/accounts';
import { OAUTH_ENDPOINTS, buildAuthorizeUrl } from '../services/gateway/oauth';
import { resolveApiEndpoint } from '../types/contracts';
import type { AccountAuthType, GatewayAccount, GatewayPlatform } from '../services/gateway/types';

const PLATFORMS: Array<{ id: GatewayPlatform; label: string; icon: string; hint: string }> = [
  { id: 'codex', label: 'Codex', icon: '⌘', hint: 'OAuth / RT / Key' },
  { id: 'claude', label: 'Claude', icon: '◈', hint: 'OAuth / Key' },
  { id: 'grok', label: 'Grok', icon: '✕', hint: 'OAuth / RT / Key' },
  { id: 'gemini', label: 'Gemini', icon: '✦', hint: 'OAuth / Key' },
  { id: 'openai', label: 'OpenAI', icon: '◎', hint: 'API Key' },
  { id: 'deepseek', label: 'DeepSeek', icon: '⌬', hint: 'API Key' },
  { id: 'openai-compatible', label: 'OpenAI 兼容', icon: '⇄', hint: 'API Key' },
  { id: 'local', label: '本地', icon: '▣', hint: '免 Key' }
];

const AUTH_TYPES: Array<{ id: AccountAuthType; label: string }> = [
  { id: 'api_key', label: 'API Key' },
  { id: 'oauth', label: 'OAuth 完整' },
  { id: 'refresh_token', label: 'RT 手动' },
  { id: 'setup_token', label: 'Setup Token' }
];

function statusMeta(status: GatewayAccount['status']) {
  switch (status) {
    case 'active': return { color: 'var(--status-safe)', label: '可用' };
    case 'quota_exhausted': return { color: 'var(--status-warning)', label: '额度用尽' };
    case 'expired': return { color: 'var(--status-warning)', label: '凭据失效' };
    case 'error': return { color: 'var(--status-danger)', label: '异常' };
    default: return { color: 'var(--text-muted)', label: '停用' };
  }
}

function maskSecret(s: string | undefined): string {
  if (!s) return '未配置';
  if (s.length <= 8) return '••••••••';
  return s.slice(0, 4) + '••••••••' + s.slice(-4);
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '5px 8px', borderRadius: '5px',
  border: '1px solid var(--border-strong)', background: 'var(--bg-base)',
  fontSize: '11.5px', color: 'var(--text-primary)', outline: 'none'
};
const labelStyle: React.CSSProperties = { fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', display: 'block' };
const btnBase: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-primary)' };

interface DraftState {
  label: string;
  authType: AccountAuthType;
  apiKey: string;
  accessToken: string;
  refreshToken: string;
  setupToken: string;
  orgId: string;
  baseUrl: string;
  models: string;
  concurrencyMax: string;
  stickyTtlMs: string;
}

const emptyDraft = (): DraftState => ({
  label: '', authType: 'api_key', apiKey: '', accessToken: '', refreshToken: '',
  setupToken: '', orgId: '', baseUrl: '', models: '', concurrencyMax: '4', stickyTtlMs: '3600000'
});

function draftFromAccount(a: GatewayAccount): DraftState {
  return {
    label: a.label,
    authType: a.authType,
    apiKey: a.credential.apiKey ?? '',
    accessToken: a.credential.accessToken ?? '',
    refreshToken: a.credential.refreshToken ?? '',
    setupToken: a.credential.setupToken ?? '',
    orgId: a.credential.orgId ?? '',
    baseUrl: a.baseUrl === DEFAULT_BASE_URLS[a.platform] ? '' : a.baseUrl,
    models: (a.models ?? []).join(', '),
    concurrencyMax: String(a.concurrency.max),
    stickyTtlMs: String(a.stickySessionTtlMs)
  };
}

function draftToCredential(d: DraftState): GatewayAccount['credential'] {
  const c: GatewayAccount['credential'] = { authType: d.authType };
  if (d.apiKey.trim()) c.apiKey = d.apiKey.trim();
  if (d.accessToken.trim()) c.accessToken = d.accessToken.trim();
  if (d.refreshToken.trim()) c.refreshToken = d.refreshToken.trim();
  if (d.setupToken.trim()) c.setupToken = d.setupToken.trim();
  if (d.orgId.trim()) c.orgId = d.orgId.trim();
  return c;
}

export const ProviderConsole: React.FC = () => {
  const [activePlatform, setActivePlatform] = useState<GatewayPlatform>('openai-compatible');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  const registry = gatewayRuntime.registry;
  const keys = gatewayRuntime.keys;
  const accounts = useMemo(() => registry.byPlatform(activePlatform), [registry, activePlatform, version]);
  const selected = selectedId ? registry.get(selectedId) : undefined;
  const enabledCount = registry.all().filter(a => a.enabled && a.status === 'active').length;

  useEffect(() => {
    const scheduler = new AccountProbeScheduler({
      registry,
      intervalMs: 300_000,
      resolveProxy: (url) => resolveApiEndpoint(url),
      onRound: () => {
        persistGatewayRuntime();
        setVersion(v => v + 1);
      }
    });
    scheduler.start();
    return () => scheduler.stop();
  }, [registry]);

  const notify = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2600); };

  const persist = () => { persistGatewayRuntime(); setVersion(v => v + 1); };

  const saveDraft = (updates: Partial<DraftState>) => setDraft(prev => ({ ...prev, ...updates }));

  const openAdd = () => {
    setAdding(true);
    setDraft(emptyDraft());
    setSelectedId(null);
  };

  const openEdit = (id: string) => {
    const a = registry.get(id);
    if (!a) return;
    setSelectedId(id);
    setAdding(false);
    setDraft(draftFromAccount(a));
  };

  const submitAccount = () => {
    const d = draft;
    if (!d.label.trim() && !d.apiKey.trim() && !d.accessToken.trim() && !d.refreshToken.trim() && !d.setupToken.trim()) {
      notify('请至少填写账号名称或一项凭据');
      return;
    }
    const platform = activePlatform;
    const platformDef = PLATFORMS.find(p => p.id === platform)!;
    if (adding) {
      registry.add({
        platform,
        label: d.label.trim() || (platformDef.label + ' 账号 ' + (registry.byPlatform(platform).length + 1)),
        authType: d.authType,
        credential: draftToCredential(d),
        baseUrl: d.baseUrl.trim() || undefined,
        models: d.models.split(',').map(s => s.trim()).filter(Boolean),
        concurrencyMax: Math.max(1, Number(d.concurrencyMax) || 4),
        stickySessionTtlMs: Math.max(60_000, Number(d.stickyTtlMs) || 3_600_000)
      });
    } else if (selectedId) {
      const existing = registry.get(selectedId);
      if (existing) {
        registry.update(selectedId, {
          label: d.label.trim() || existing.label,
          credential: draftToCredential(d),
          baseUrl: d.baseUrl.trim() || DEFAULT_BASE_URLS[platform],
          models: d.models.split(',').map(s => s.trim()).filter(Boolean),
          concurrency: { ...existing.concurrency, max: Math.max(1, Number(d.concurrencyMax) || 4) }
        });
      }
    }
    persist();
    notify(adding ? '账号已添加，正在探测可用性...' : '配置已保存');
    void probeNow(adding ? registry.byPlatform(platform).slice(-1)[0]?.id : selectedId);
    setAdding(false);
  };

  const probeNow = async (id?: string | null) => {
    const targetId = id ?? selectedId;
    if (!targetId) return;
    setProbing(true);
    const account = registry.get(targetId);
    if (account) {
      const result = await probeAccount(account, { registry, resolveProxy: (url) => resolveApiEndpoint(url) });
      persist();
      setVersion(v => v + 1);
      notify(result.ok ? ('探测成功：' + result.status + ' · ' + result.latencyMs + 'ms') : ('探测失败：' + (result.error ?? result.status)));
    }
    setProbing(false);
  };

  const probeAllNow = async () => {
    setProbing(true);
    await Promise.all(registry.all().filter(a => a.enabled).map(a => probeAccount(a, { registry, resolveProxy: (url) => resolveApiEndpoint(url) })));
    persist();
    setProbing(false);
    notify('已对所有启用账号完成一轮真实探测');
  };

  const removeAccount = (id: string) => {
    if (!window.confirm('确认删除该账号？该操作不可撤销。')) return;
    registry.remove(id);
    if (selectedId === id) setSelectedId(null);
    persist();
    notify('账号已删除');
  };

  const toggleAccount = (id: string) => {
    const a = registry.get(id);
    if (!a) return;
    registry.update(id, { enabled: !a.enabled });
    persist();
  };

  // ── Downstream keys ──
  const issueKey = () => {
    const name = window.prompt('新下游 Key 名称：', 'Team-' + Math.floor(Math.random() * 900 + 100));
    if (!name) return;
    keys.issue({ name: name.trim(), groups: ['default'] });
    persist();
    notify('下游 Key 已签发（已复制到剪贴板）');
    const latest = keys.list().slice(-1)[0];
    if (latest) void navigator.clipboard?.writeText(latest.key).catch(() => undefined);
  };
  const toggleKey = (id: string) => {
    const k = keys.list().find(x => x.id === id);
    if (!k) return;
    keys.update(id, { enabled: !k.enabled });
    persist();
  };

  const authFields = (d: DraftState, save: (u: Partial<DraftState>) => void) => {
    const showOAuth = d.authType === 'oauth' || d.authType === 'refresh_token';
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {d.authType === 'api_key' && (
          <div>
            <span style={labelStyle}>API Key</span>
            <input type="password" style={inputStyle} placeholder="sk-..." value={d.apiKey} onChange={e => save({ apiKey: e.target.value })} />
          </div>
        )}
        {d.authType === 'setup_token' && (
          <div>
            <span style={labelStyle}>Setup Token</span>
            <input type="password" style={inputStyle} placeholder="setup-token..." value={d.setupToken} onChange={e => save({ setupToken: e.target.value })} />
          </div>
        )}
        {showOAuth && (
          <>
            <div>
              <span style={labelStyle}>Access Token</span>
              <input type="password" style={inputStyle} placeholder="access token" value={d.accessToken} onChange={e => save({ accessToken: e.target.value })} />
            </div>
            <div>
              <span style={labelStyle}>Refresh Token</span>
              <input type="password" style={inputStyle} placeholder="refresh token" value={d.refreshToken} onChange={e => save({ refreshToken: e.target.value })} />
            </div>
          </>
        )}
        {d.authType === 'oauth' && (
          <div>
            <span style={labelStyle}>Org ID（可选）</span>
            <input style={inputStyle} placeholder="org_..." value={d.orgId} onChange={e => save({ orgId: e.target.value })} />
          </div>
        )}
        <div>
          <span style={labelStyle}>Base URL（留空用平台默认）</span>
          <input style={inputStyle} placeholder={DEFAULT_BASE_URLS[activePlatform]} value={d.baseUrl} onChange={e => save({ baseUrl: e.target.value })} />
        </div>
        <div>
          <span style={labelStyle}>模型白名单（逗号分隔，留空=全部）</span>
          <input style={inputStyle} placeholder="mimo-v2.5-free, deepseek-v4-flash" value={d.models} onChange={e => save({ models: e.target.value })} />
        </div>
        <div>
          <span style={labelStyle}>并发上限</span>
          <input type="number" style={inputStyle} value={d.concurrencyMax} onChange={e => save({ concurrencyMax: e.target.value })} />
        </div>
        <div>
          <span style={labelStyle}>粘性会话 TTL (ms)</span>
          <input type="number" style={inputStyle} value={d.stickyTtlMs} onChange={e => save({ stickyTtlMs: e.target.value })} />
        </div>
      </div>
    );
  };

  const oauthHint = (platform: GatewayPlatform) => {
    if (!OAUTH_ENDPOINTS[platform]) return null;
    const url = buildAuthorizeUrl(platform, { clientId: 'tcode-app', redirectUri: 'http://127.0.0.1:8010/oauth/callback' });
    return (
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5, wordBreak: 'break-all', padding: '6px 8px', borderRadius: '5px', background: 'var(--accent-subtle)' }}>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>手动授权</span>：打开地址完成授权后，将回调 code / token 填入上方字段
        <div style={{ color: 'var(--accent)', marginTop: '2px', cursor: 'pointer' }} onClick={() => void navigator.clipboard?.writeText(url).catch(() => undefined)} title="点击复制">{url}</div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '2px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '7px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>模型服务商</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{registry.all().length} 账号 · {enabledCount} 可用</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button style={{ ...btnBase, padding: '4px 8px', fontSize: '10px' }} onClick={() => void probeAllNow()} disabled={probing}>
            <RefreshCw size={11} /> {probing ? '探测中...' : '全部探测'}
          </button>
          <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>自动刷新：5 分钟</span>
        </div>
      </div>

      {toast && (
        <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: '11px', fontWeight: 600 }}>{toast}</div>
      )}

      <div style={{ display: 'flex', gap: '10px', height: '100%', minHeight: '430px' }}>
        {/* Left: platform nav */}
        <div style={{ width: '196px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--bg-surface)', borderRadius: '7px', border: '1px solid var(--border-subtle)', padding: '8px 6px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', padding: '0 6px 6px', letterSpacing: '0.4px' }}>平台</span>
          {PLATFORMS.map(p => {
            const list = registry.byPlatform(p.id);
            const hasActive = list.some(a => a.enabled && a.status === 'active');
            const hasError = list.some(a => a.status === 'error' || a.status === 'expired');
            const active = activePlatform === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setActivePlatform(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '5px', cursor: 'pointer',
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent'
                }}
              >
                <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{p.icon}</span>
                <span style={{ fontSize: '11.5px', fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text-primary)', flex: 1 }}>{p.label}</span>
                <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{list.length}</span>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: hasError ? 'var(--status-danger)' : hasActive ? 'var(--status-safe)' : 'var(--border-strong)' }} />
              </div>
            );
          })}
        </div>

        {/* Middle: account list */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-surface)', borderRadius: '7px', border: '1px solid var(--border-subtle)', padding: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>{PLATFORMS.find(p => p.id === activePlatform)?.label} 账号</span>
            <button style={{ ...btnBase, padding: '4px 9px', fontSize: '10.5px', border: 'none', background: 'var(--accent)', color: '#FFF' }} onClick={openAdd}>
              <Plus size={11} /> 添加账号
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
            {accounts.length === 0 && !adding && (
              <div style={{ padding: '18px 10px', borderRadius: '6px', border: '1px dashed var(--border-strong)', textAlign: 'center', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                暂无账号。点击「添加账号」挂载 OAuth / RT / API Key。
              </div>
            )}
            {accounts.map(a => {
              const meta = statusMeta(a.status);
              const quotaPct = a.quota.limit > 0 ? Math.max(0, Math.min(100, (a.quota.remaining / a.quota.limit) * 100)) : 100;
              return (
                <div
                  key={a.id}
                  onClick={() => openEdit(a.id)}
                  style={{
                    padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                    background: selectedId === a.id ? 'var(--bg-base)' : 'var(--bg-surface-elevated)',
                    border: selectedId === a.id ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                    display: 'flex', flexDirection: 'column', gap: '5px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: a.enabled ? meta.color : 'var(--border-strong)' }} />
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{a.label}</span>
                    <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '8px', background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{AUTH_TYPES.find(t => t.id === a.authType)?.label}</span>
                    <span style={{ fontSize: '9.5px', color: meta.color, fontWeight: 600 }}>{a.enabled ? meta.label : '停用'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
                      <div style={{ width: quotaPct + '%', height: '100%', background: quotaPct > 20 ? 'var(--status-safe)' : 'var(--status-warning)' }} />
                    </div>
                    {a.quota.limit > 0 && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{Math.round(quotaPct)}%</span>}
                    {a.health.lastProbeAt ? <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{a.models.length || '全部'} 模型</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: detail editor */}
        <div style={{ flex: '1.25 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          {!adding && !selected && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '7px', border: '1px dashed var(--border-strong)', background: 'var(--bg-surface)', fontSize: '11px', color: 'var(--text-muted)' }}>
              选择左侧账号查看详情，或点击「添加账号」
            </div>
          )}
          {(adding || selected) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderRadius: '7px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>{adding ? '添加账号' : '账号详情'}</span>
                {!adding && selected && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }} onClick={() => toggleAccount(selected.id)}>
                    {selected.enabled ? '已启用' : '已停用'}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <span style={labelStyle}>账号名称</span>
                  <input style={inputStyle} placeholder="如 codex-主号" value={draft.label} onChange={e => saveDraft({ label: e.target.value })} />
                </div>
                <div>
                  <span style={labelStyle}>鉴权方式</span>
                  <select style={inputStyle} value={draft.authType} onChange={e => saveDraft({ authType: e.target.value as AccountAuthType })}>
                    {AUTH_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              {authFields(draft, saveDraft)}
              {oauthHint(activePlatform)}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingTop: '2px' }}>
                <button style={{ ...btnBase, background: 'var(--accent)', color: '#FFF', border: 'none' }} onClick={submitAccount}>
                  <Save size={11} /> {adding ? '创建并探测' : '保存'}
                </button>
                {!adding && selected && (
                  <button style={{ ...btnBase, padding: '5px 9px' }} onClick={() => void probeNow(selected.id)} disabled={probing}>
                    <Activity size={11} /> {probing ? '探测中...' : '立即探测'}
                  </button>
                )}
                {!adding && selected && (
                  <button style={{ ...btnBase, border: '1px solid #F3BFBF', background: '#FFF5F5', color: '#C92A2A' }} onClick={() => removeAccount(selected.id)}>
                    <Trash2 size={11} /> 删除
                  </button>
                )}
                {!adding && selected && (
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>上次探测：{selected.health.lastProbeAt ? new Date(selected.health.lastProbeAt).toLocaleTimeString() : '从未'}</span>
                )}
              </div>
            </div>
          )}

          {/* Downstream keys */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '7px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', cursor: 'pointer' }}
              onClick={() => setShowKeys(v => !v)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                <KeyRound size={11} /> 下游 API Key 分发
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{showKeys ? '收起 ▲' : '展开 ▼'} · {keys.list().length}</span>
            </div>
            {showKeys && (
              <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button style={{ ...btnBase, alignSelf: 'flex-start', padding: '4px 9px', fontSize: '10.5px', border: 'none', background: 'var(--accent)', color: '#FFF' }} onClick={issueKey}>
                  <Plus size={11} /> 签发 Key
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '180px', overflowY: 'auto' }}>
                  {keys.list().map(k => (
                    <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '5px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)', width: '90px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</span>
                      <code style={{ fontSize: '10px', color: 'var(--text-muted)', flex: 1 }}>{maskSecret(k.key)}</code>
                      <button
                        title="复制完整 Key"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                        onClick={() => void navigator.clipboard?.writeText(k.key).catch(() => undefined)}
                      >
                        <Copy size={11} />
                      </button>
                      <span style={{ fontSize: '9px', color: k.enabled ? 'var(--status-safe)' : 'var(--text-muted)', cursor: 'pointer' }} onClick={() => toggleKey(k.id)}>
                        {k.enabled ? '启用' : '停用'}
                      </span>
                    </div>
                  ))}
                  {keys.list().length === 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>暂无下游 Key</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};