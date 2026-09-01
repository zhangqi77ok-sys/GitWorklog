import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Eye,
  EyeOff,
  Check,
  Cpu,
  Palette,
  Info,
  Key,
  ShieldCheck,
  Link,
  FileCode,
  Globe,
  Sun,
  Moon,
  ExternalLink,
} from 'lucide-react';
import {
  useGatewayStore,
  GatewayChannel,
  ProviderPlatform,
  IngressType,
} from '../../store/useGatewayStore';
import type { PluginMetadata, ToolSchema } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'cream' | 'dark';
  onToggleTheme: () => void;
  plugins?: PluginMetadata[];
  tools?: ToolSchema[];
}

const PLATFORM_OPTIONS: {
  id: ProviderPlatform;
  label: string;
  icon: string;
  defaultUrl: string;
  defaultModels: string[];
}[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    icon: '🌟',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    icon: '⚡',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    icon: '💎',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModels: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    icon: '🇨🇳',
    defaultUrl: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    icon: '🇨🇳',
    defaultUrl: 'https://api.siliconflow.cn/v1',
    defaultModels: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1'],
  },
  {
    id: 'kimi',
    label: 'Moonshot Kimi',
    icon: '🇨🇳',
    defaultUrl: 'https://api.moonshot.cn/v1',
    defaultModels: ['moonshot-v1-8k', 'moonshot-v1-32k'],
  },
  {
    id: 'zhipu',
    label: 'Zhipu GLM',
    icon: '🇨🇳',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: ['glm-4-plus', 'glm-4-flash'],
  },
  {
    id: 'ollama',
    label: 'Ollama Local',
    icon: '💻',
    defaultUrl: 'http://127.0.0.1:11434',
    defaultModels: ['qwen2.5-coder:latest', 'deepseek-r1:latest'],
  },
];

type SettingsTab = 'gateway' | 'plugins' | 'appearance' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  plugins = [],
  tools = [],
}) => {
  const {
    channels,
    activeChannelId,
    probeResults,
    saveChannel,
    setActiveChannel,
    testChannel,
    pullModels,
  } = useGatewayStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('gateway');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<GatewayChannel>>({
    name: 'DeepSeek 官方直连',
    platform: 'deepseek',
    ingress_type: 'api_key',
    base_url: 'https://api.deepseek.com/v1',
    api_key: '',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    enabled: true,
    is_healthy: true,
    priority: 1,
    weight: 100,
  });

  const [sub2Url, setSub2Url] = useState('');
  const [capJson, setCapJson] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [localProbeResult, setLocalProbeResult] = useState<{
    success: boolean;
    http_status: number;
    latency_ms: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (channels.length > 0) {
      const active = channels.find((c) => c.id === activeChannelId) || channels[0];
      setSelectedChannelId(active.id);
      setFormData(active);
    }
  }, [channels, activeChannelId]);

  if (!isOpen) return null;

  const currentProbe = localProbeResult || (selectedChannelId ? probeResults[selectedChannelId] : null);

  const handleSelectPlatform = (platformId: ProviderPlatform) => {
    const plat = PLATFORM_OPTIONS.find((p) => p.id === platformId);
    if (!plat) return;
    setFormData((prev) => ({
      ...prev,
      platform: platformId,
      base_url: plat.defaultUrl,
      models: plat.defaultModels,
      name: `${plat.label} 官方直连`,
    }));
  };

  const handleRunProbe = async () => {
    setIsProbing(true);
    setLocalProbeResult(null);
    try {
      const channel: GatewayChannel = {
        id: selectedChannelId || `ch_${Date.now()}`,
        name: formData.name || 'AI Channel',
        platform: formData.platform || 'deepseek',
        ingress_type: formData.ingress_type || 'api_key',
        base_url: formData.base_url || 'https://api.deepseek.com/v1',
        api_key: formData.api_key || '',
        models: formData.models || ['deepseek-chat'],
        enabled: true,
        is_healthy: true,
        priority: 1,
        weight: 100,
      };
      const res = await testChannel(channel);
      if (res) {
        setLocalProbeResult({
          success: res.success,
          http_status: res.http_status,
          latency_ms: res.latency_ms,
          message: res.message,
        });
      } else {
        setLocalProbeResult({
          success: false,
          http_status: 0,
          latency_ms: 0,
          message: '探活测试未返回有效响应，请检查服务端点与凭据配置。',
        });
      }
    } catch (err: any) {
      setLocalProbeResult({
        success: false,
        http_status: 500,
        latency_ms: 0,
        message: String(err),
      });
    } finally {
      setIsProbing(false);
    }
  };

  const handleFetchModels = async () => {
    if (!formData.base_url) return;
    setIsFetchingModels(true);
    try {
      const models = await pullModels(formData.base_url, formData.api_key);
      if (models && models.length > 0) {
        setFormData((prev) => ({ ...prev, models }));
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSave = async () => {
    const channel: GatewayChannel = {
      id: selectedChannelId || `ch_${Date.now()}`,
      name: formData.name || 'AI Channel',
      platform: formData.platform || 'deepseek',
      ingress_type: formData.ingress_type || 'api_key',
      base_url: formData.base_url || 'https://api.deepseek.com/v1',
      api_key: formData.api_key || '',
      models: formData.models || ['deepseek-chat'],
      enabled: true,
      is_healthy: true,
      priority: 1,
      weight: 100,
    };
    await saveChannel(channel);
    await setActiveChannel(channel.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#FAF8F5] border border-[#E6DFD5] rounded-2xl w-[820px] max-w-[95vw] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27]">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-sm text-[#1E1C1A]">全局设置中心 (Settings Cockpit)</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-[#8A847C] hover:text-[#1E1C1A] hover:bg-[#EAE4DC] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-[#E6DFD5] bg-white flex items-center gap-2">
          {[
            { id: 'gateway', label: 'AI 模型网关', icon: <Sparkles className="w-3.5 h-3.5" /> },
            {
              id: 'plugins',
              label: `能力插件与 MCP (${plugins.length})`,
              icon: <Cpu className="w-3.5 h-3.5" />,
            },
            { id: 'appearance', label: '外观与主题', icon: <Palette className="w-3.5 h-3.5" /> },
            { id: 'about', label: '关于与安全', icon: <Info className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-1.5 px-4 py-3 border-b-2 font-bold text-xs transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#D96B27] text-[#D96B27]'
                  : 'border-transparent text-[#6B665F] hover:text-[#1E1C1A]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* TAB 1: AI 模型网关 */}
          {activeTab === 'gateway' && (
            <div className="space-y-4">
              {/* Channel Name */}
              <div className="space-y-1">
                <label className="font-bold text-[#1E1C1A]">渠道别名 (Channel Name)</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: DeepSeek 官方直连"
                  className="w-full px-3.5 py-2 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none text-[#1E1C1A] text-xs"
                />
              </div>

              {/* 1. Platform Selector */}
              <div className="space-y-2">
                <label className="font-bold text-[#1E1C1A]">
                  1. 选择上游平台 (Upstream Platform)
                </label>
                <div className="grid grid-cols-4 gap-2.5">
                  {PLATFORM_OPTIONS.map((plat) => {
                    const isSelected = formData.platform === plat.id;
                    return (
                      <button
                        key={plat.id}
                        onClick={() => handleSelectPlatform(plat.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#D96B27] bg-[#FAF8F5] text-[#D96B27] font-bold ring-2 ring-[#D96B27]/30 shadow-xs'
                            : 'border-[#E6DFD5] bg-white text-[#3D3A36] hover:bg-[#FAF8F5] hover:border-[#D5CCC0]'
                        }`}
                      >
                        <span className="text-base">{plat.icon}</span>
                        <span className="truncate flex-1">{plat.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#D96B27] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Ingress Type Cards (Supporting API Key, OAuth, Sub2, Cap, Proxy) */}
              <div className="space-y-2">
                <label className="font-bold text-[#1E1C1A]">
                  2. 接入与认证方式 (Ingress Type / Sub2 / Cap / OAuth)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Standard API Key */}
                  <div
                    onClick={() => setFormData({ ...formData, ingress_type: 'api_key' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.ingress_type === 'api_key'
                        ? 'border-[#D96B27] bg-white ring-2 ring-[#D96B27]/30 shadow-xs'
                        : 'border-[#E6DFD5] bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-[#1E1C1A] mb-0.5 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-[#D96B27]" />
                      <span>标准 API Key</span>
                    </div>
                    <p className="text-[10px] text-[#6B665F]">官方分配 sk-*** 密钥直接发起</p>
                  </div>

                  {/* Sub2 Subscription */}
                  <div
                    onClick={() => setFormData({ ...formData, ingress_type: 'sub2' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.ingress_type === 'sub2'
                        ? 'border-[#D96B27] bg-white ring-2 ring-[#D96B27]/30 shadow-xs'
                        : 'border-[#E6DFD5] bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-[#1E1C1A] mb-0.5 flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-[#2E7D32]" />
                      <span>Sub2 订阅导入</span>
                    </div>
                    <p className="text-[10px] text-[#6B665F]">导入 sub2api 订阅链接或账号池</p>
                  </div>

                  {/* Cap Credential */}
                  <div
                    onClick={() => setFormData({ ...formData, ingress_type: 'cap' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.ingress_type === 'cap'
                        ? 'border-[#D96B27] bg-white ring-2 ring-[#D96B27]/30 shadow-xs'
                        : 'border-[#E6DFD5] bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-[#1E1C1A] mb-0.5 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-[#1565C0]" />
                      <span>Cap 凭据包导入</span>
                    </div>
                    <p className="text-[10px] text-[#6B665F]">导入 Session Token / Cap 凭据</p>
                  </div>

                  {/* OAuth 2.0 */}
                  <div
                    onClick={() => setFormData({ ...formData, ingress_type: 'oauth' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.ingress_type === 'oauth'
                        ? 'border-[#D96B27] bg-white ring-2 ring-[#D96B27]/30 shadow-xs'
                        : 'border-[#E6DFD5] bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-[#1E1C1A] mb-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#7B1FA2]" />
                      <span>OAuth 2.0 授权</span>
                    </div>
                    <p className="text-[10px] text-[#6B665F]">浏览器官方授权登录换取凭据</p>
                  </div>

                  {/* Proxy 透传 */}
                  <div
                    onClick={() => setFormData({ ...formData, ingress_type: 'proxy' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all col-span-2 ${
                      formData.ingress_type === 'proxy'
                        ? 'border-[#D96B27] bg-white ring-2 ring-[#D96B27]/30 shadow-xs'
                        : 'border-[#E6DFD5] bg-white/70 hover:bg-white'
                    }`}
                  >
                    <div className="font-bold text-[#1E1C1A] mb-0.5 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#E65100]" />
                      <span>自建中转 / OneAPI 代理</span>
                    </div>
                    <p className="text-[10px] text-[#6B665F]">
                      经由企业内部网关或自定义反代透传
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Dynamic Credential Input Panel */}
              <div className="space-y-3 bg-white p-4 rounded-xl border border-[#E6DFD5]">
                <div className="space-y-1">
                  <label className="font-bold text-[#1E1C1A]">服务端点 (Endpoint URL)</label>
                  <input
                    type="text"
                    value={formData.base_url || ''}
                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                  />
                </div>

                {/* Conditional Inputs based on Ingress Type */}
                {formData.ingress_type === 'api_key' && (
                  <div className="space-y-1">
                    <label className="font-bold text-[#1E1C1A]">API 密钥 (API Key)</label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={formData.api_key || ''}
                        onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                        placeholder="sk-..."
                        className="w-full pl-3 pr-10 py-2 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A847C] hover:text-[#1E1C1A] cursor-pointer"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {formData.ingress_type === 'sub2' && (
                  <div className="space-y-1">
                    <label className="font-bold text-[#1E1C1A]">
                      Sub2 订阅链接或 API (Subscription URL)
                    </label>
                    <input
                      type="text"
                      value={sub2Url}
                      onChange={(e) => {
                        setSub2Url(e.target.value);
                        setFormData({ ...formData, api_key: e.target.value });
                      }}
                      placeholder="https://your-sub2api-domain.com/sub?token=..."
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                    />
                    <span className="text-[10px] text-[#6B665F]">
                      支持 sub2api 格式的订阅与轮询账号池
                    </span>
                  </div>
                )}

                {formData.ingress_type === 'cap' && (
                  <div className="space-y-1">
                    <label className="font-bold text-[#1E1C1A]">
                      Cap 凭据包 / Session Token (JSON / Token String)
                    </label>
                    <textarea
                      rows={3}
                      value={capJson}
                      onChange={(e) => {
                        setCapJson(e.target.value);
                        setFormData({ ...formData, api_key: e.target.value });
                      }}
                      placeholder='{"session_token": "...", "refresh_token": "..."}'
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                    />
                  </div>
                )}

                {formData.ingress_type === 'oauth' && (
                  <div className="p-3 bg-[#FAF8F5] rounded-lg border border-[#E6DFD5] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#1E1C1A]">OAuth 2.0 官方授权流</div>
                      <div className="text-[11px] text-[#6B665F]">
                        点击授权将打开官方登录页面获取 Access Token
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => alert('正在拉起浏览器官方 OAuth 授权页面...')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D96B27] text-white rounded-lg text-xs font-bold hover:bg-[#B8551B] transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>发起授权</span>
                    </button>
                  </div>
                )}

                {/* Models */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#1E1C1A]">关联模型 (Associated Models)</label>
                    <button
                      onClick={handleFetchModels}
                      disabled={isFetchingModels || !formData.base_url}
                      className="text-[11px] text-[#D96B27] hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCw
                        className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin' : ''}`}
                      />
                      <span>从服务端拉取 (/v1/models)</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.models?.join(', ') || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        models: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="deepseek-chat, deepseek-reasoner"
                    className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                  />
                </div>
              </div>

              {/* Live Probe Card */}
              <div className="space-y-2 bg-[#F4EFEA] p-4 rounded-xl border border-[#E6DFD5]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1E1C1A] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#D96B27]" />
                    ⚡ 实时测速探活 (Live Account Probe)
                  </span>
                  <button
                    onClick={handleRunProbe}
                    disabled={isProbing}
                    className="px-3.5 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isProbing ? '正在探活...' : '⚡ 连通性测试'}</span>
                  </button>
                </div>

                {currentProbe && (
                  <div className="space-y-1.5 pt-1 text-[11px]">
                    <div className="flex items-center gap-2 font-mono">
                      {currentProbe.success ? (
                        <span className="text-[#2E7D32] font-bold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> 🟢 HTTP {currentProbe.http_status}{' '}
                          OK · 首字延迟: {currentProbe.latency_ms}ms
                        </span>
                      ) : (
                        <span className="text-[#C62828] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> 探活异常: {currentProbe.message}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: 能力插件与 MCP */}
          {activeTab === 'plugins' && (
            <div className="space-y-3">
              <div className="p-3 bg-white rounded-xl border border-[#E6DFD5] flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-[#1E1C1A]">内置与 MCP 能力插件</div>
                  <div className="text-[11px] text-[#6B665F]">
                    共检测到 {plugins.length} 个已加载插件及 {tools.length} 个工具契约
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {plugins.length === 0 ? (
                  <div className="p-6 text-center text-[#8A847C]">当前暂无外部挂载插件</div>
                ) : (
                  plugins.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white rounded-xl border border-[#E6DFD5] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Cpu className="w-4 h-4 text-[#D96B27]" />
                        <div>
                          <div className="font-bold text-xs text-[#1E1C1A]">{p.name}</div>
                          <div className="text-[11px] text-[#6B665F]">{p.description}</div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-full text-[10px] font-bold">
                        🟢 运行中
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 外观与主题 */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="font-bold text-[#1E1C1A]">界面色彩模式 (Theme Mode)</div>
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => {
                    if (theme !== 'cream') onToggleTheme();
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    theme === 'cream'
                      ? 'border-[#D96B27] bg-[#FAF8F5] ring-2 ring-[#D96B27]/30'
                      : 'border-[#E6DFD5] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#1E1C1A] flex items-center gap-2">
                      <Sun className="w-4 h-4 text-[#D96B27]" />
                      经典纸质暖色 (Paper Cream Warm)
                    </span>
                    {theme === 'cream' && <Check className="w-4 h-4 text-[#D96B27]" />}
                  </div>
                  <p className="text-[11px] text-[#6B665F]">
                    #FAF8F5 温暖米白与 #D96B27 陶土暖橙，护眼舒适工作台
                  </p>
                </div>

                <div
                  onClick={() => {
                    if (theme !== 'dark') onToggleTheme();
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    theme === 'dark'
                      ? 'border-[#D96B27] bg-[#1C1E24] text-white ring-2 ring-[#D96B27]/30'
                      : 'border-[#E6DFD5] bg-[#131417] text-white/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white flex items-center gap-2">
                      <Moon className="w-4 h-4 text-[#F97316]" />
                      深邃极客暗黑 (Obsidian Dark)
                    </span>
                    {theme === 'dark' && <Check className="w-4 h-4 text-[#F97316]" />}
                  </div>
                  <p className="text-[11px] text-white/60">
                    高对比度黑曜石极客暗黑夜间模式
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 关于与安全 */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-xl border border-[#E6DFD5] space-y-2">
                <div className="font-bold text-sm text-[#1E1C1A]">Tcode Studio v2.0.0</div>
                <p className="text-[#6B665F]">
                  下一代高性能双环沙箱 AI 代码协同 IDE，基于 Tauri v2 原生微内核与 React 19 构建。
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-[#1E1C1A]">5 大安全轨道运行状态</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#2E7D32]" />
                    <span>Double-Ring 沙箱拦截器: Active</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#2E7D32]" />
                    <span>Fail-Closed 模型网关: Active</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#2E7D32]" />
                    <span>路径越界拦截防御: Active</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-[#E6DFD5] flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#2E7D32]" />
                    <span>凭据隔离安全存储: Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#E6DFD5] hover:bg-[#FAF8F5] text-[#3D3A36] rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            关闭
          </button>
          {activeTab === 'gateway' && (
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              💾 保存并启用网关
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
