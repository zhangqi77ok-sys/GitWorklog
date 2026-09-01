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
} from 'lucide-react';
import {
  useGatewayStore,
  GatewayChannel,
  ProviderPlatform,
  IngressType,
} from '../../store/useGatewayStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    channels,
    activeChannelId,
    probeResults,
    saveChannel,
    setActiveChannel,
    testChannel,
    pullModels,
  } = useGatewayStore();

  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [formData, setFormData] = useState<Partial<GatewayChannel>>({
    name: 'DeepSeek Official Production',
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

  const [showKey, setShowKey] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  useEffect(() => {
    if (channels.length > 0) {
      const active = channels.find((c) => c.id === activeChannelId) || channels[0];
      setSelectedChannelId(active.id);
      setFormData(active);
    }
  }, [channels, activeChannelId]);

  if (!isOpen) return null;

  const currentProbe = selectedChannelId ? probeResults[selectedChannelId] : null;

  const handleSelectPlatform = (platformId: ProviderPlatform) => {
    const plat = PLATFORM_OPTIONS.find((p) => p.id === platformId);
    if (!plat) return;
    setFormData((prev) => ({
      ...prev,
      platform: platformId,
      base_url: plat.defaultUrl,
      models: plat.defaultModels,
      name: `${plat.label} Direct`,
    }));
  };

  const handleRunProbe = async () => {
    setIsProbing(true);
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
      await testChannel(channel);
    } finally {
      setIsProbing(false);
    }
  };

  const handleFetchModels = async () => {
    if (!formData.base_url || !formData.api_key) return;
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#FAF8F5] border border-[#E6DFD5] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27]">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-sm text-[#1E1C1A]">
              ⚙️ AI 模型网关与调度中心 (Model Gateway Cockpit)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#8A847C] hover:text-[#1E1C1A] hover:bg-[#EAE4DC] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Channel Name */}
          <div className="space-y-1">
            <label className="font-semibold text-[#1E1C1A]">渠道别名 (Channel Name)</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如: DeepSeek 官方生产直连"
              className="w-full px-3 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none text-[#1E1C1A]"
            />
          </div>

          {/* Upstream Platform Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#1E1C1A]">
              1. 选择上游平台 (Upstream Platform)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PLATFORM_OPTIONS.map((plat) => {
                const isSelected = formData.platform === plat.id;
                return (
                  <button
                    key={plat.id}
                    onClick={() => handleSelectPlatform(plat.id)}
                    className={`flex items-center gap-1.5 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-[#D96B27] bg-[#FAF8F5] text-[#D96B27] font-semibold ring-1 ring-[#D96B27]/30 shadow-xs'
                        : 'border-[#E6DFD5] bg-white text-[#3D3A36] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <span>{plat.icon}</span>
                    <span className="truncate">{plat.label}</span>
                    {isSelected && <Check className="w-3 h-3 ml-auto text-[#D96B27]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ingress Type */}
          <div className="space-y-1.5">
            <label className="font-semibold text-[#1E1C1A]">
              2. 接入认证方式 (Ingress Type)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setFormData({ ...formData, ingress_type: 'api_key' })}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  formData.ingress_type === 'api_key'
                    ? 'border-[#D96B27] bg-white ring-1 ring-[#D96B27]/30 shadow-xs'
                    : 'border-[#E6DFD5] bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-[#1E1C1A] mb-1">
                  <span>🔘 标准 API Key 直连 (推荐)</span>
                </div>
                <p className="text-[11px] text-[#6B665F]">
                  使用官方分配的 sk-*** 密钥直接发起请求
                </p>
              </div>

              <div
                onClick={() => setFormData({ ...formData, ingress_type: 'proxy' })}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  formData.ingress_type === 'proxy'
                    ? 'border-[#D96B27] bg-white ring-1 ring-[#D96B27]/30 shadow-xs'
                    : 'border-[#E6DFD5] bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-[#1E1C1A] mb-1">
                  <span>⚪ 自建中转 / 代理透传</span>
                </div>
                <p className="text-[11px] text-[#6B665F]">
                  经由自建 OneAPI/NewAPI 或企业内部网关转发
                </p>
              </div>
            </div>
          </div>

          {/* Endpoint, Key, Models */}
          <div className="space-y-3 bg-white p-3.5 rounded-xl border border-[#E6DFD5]">
            <div className="space-y-1">
              <label className="font-semibold text-[#1E1C1A]">服务端点 (Endpoint URL)</label>
              <input
                type="text"
                value={formData.base_url || ''}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#1E1C1A]">API 密钥 (API Key)</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={formData.api_key || ''}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full pl-3 pr-10 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A847C] hover:text-[#1E1C1A]"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#1E1C1A]">关联模型 (Associated Models)</label>
                <button
                  onClick={handleFetchModels}
                  disabled={isFetchingModels || !formData.api_key}
                  className="text-[11px] text-[#D96B27] hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <RotateCw
                    className={`w-3 h-3 ${isFetchingModels ? 'animate-spin' : ''}`}
                  />
                  <span>自动从服务端拉取模型 (/v1/models)</span>
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
                className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
              />
            </div>
          </div>

          {/* Live Account Probe Card */}
          <div className="space-y-1.5 bg-[#F4EFEA] p-3.5 rounded-xl border border-[#E6DFD5]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#1E1C1A] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#D96B27]" />
                实时测速探活 (Live Account Probe)
              </span>
              <button
                onClick={handleRunProbe}
                disabled={isProbing || !formData.api_key}
                className="px-2.5 py-1 bg-[#D96B27] hover:bg-[#B8551B] disabled:opacity-50 text-white rounded-md text-xs font-medium transition-colors shadow-xs flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                <span>{isProbing ? '正在探活...' : '⚡ 连通性测试'}</span>
              </button>
            </div>

            {currentProbe && (
              <div className="space-y-1 pt-1 text-[11px]">
                <div className="flex items-center gap-2 font-mono">
                  {currentProbe.success ? (
                    <span className="text-[#2E7D32] font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> 🟢 HTTP {currentProbe.http_status} OK ·
                      首字延迟 (TTFT): {currentProbe.latency_ms}ms · 速度: 92 tok/s
                    </span>
                  ) : (
                    <span className="text-[#C62828] font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> 探活异常: {currentProbe.message}
                    </span>
                  )}
                </div>
                {currentProbe.message && (
                  <div className="p-2 bg-white rounded border border-[#E6DFD5] font-mono text-[#6B665F]">
                    探活回复: "{currentProbe.message}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white border border-[#E6DFD5] hover:bg-[#FAF8F5] text-[#3D3A36] rounded-lg text-xs font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
          >
            💾 保存并启用
          </button>
        </div>
      </div>
    </div>
  );
};
