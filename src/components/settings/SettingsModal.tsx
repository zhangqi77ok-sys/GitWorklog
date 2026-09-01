import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Activity,
  Trash2,
  Edit2,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Plus,
  Server,
  Key,
  Shield,
  Cloud,
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

const PLATFORM_OPTIONS: { id: ProviderPlatform; label: string; icon: string; defaultUrl: string; defaultModels: string[] }[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek 深度求索',
    icon: '🇨🇳',
    defaultUrl: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow 硅基流动',
    icon: '🇨🇳',
    defaultUrl: 'https://api.siliconflow.cn/v1',
    defaultModels: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1'],
  },
  {
    id: 'kimi',
    label: 'Moonshot Kimi',
    icon: '🇨🇳',
    defaultUrl: 'https://api.moonshot.cn/v1',
    defaultModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    icon: '🇨🇳',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: ['glm-4-plus', 'glm-4-flash'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    icon: '🌟',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022'],
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT-4o/o3)',
    icon: '⚡',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    icon: '💎',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModels: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'ollama',
    label: 'Ollama 本地模型',
    icon: '💻',
    defaultUrl: 'http://127.0.0.1:11434',
    defaultModels: ['qwen2.5-coder:latest', 'deepseek-r1:latest'],
  },
  {
    id: 'custom',
    label: '自建中转 / OneAPI',
    icon: '🔀',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModels: ['default'],
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    channels,
    activeChannelId,
    probeResults,
    isProbing,
    loadChannels,
    saveChannel,
    deleteChannel,
    setActiveChannel,
    testChannel,
    pullModels,
  } = useGatewayStore();

  const [selectedPlatform, setSelectedPlatform] = useState<ProviderPlatform>('deepseek');
  const [selectedIngress, setSelectedIngress] = useState<IngressType>('api_key');
  const [channelName, setChannelName] = useState('DeepSeek 官方直连');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [modelsText, setModelsText] = useState('deepseek-chat, deepseek-reasoner');
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [isPullingModels, setIsPullingModels] = useState(false);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadChannels();
    }
  }, [isOpen, loadChannels]);

  // Handle platform change
  const handlePlatformChange = (p: ProviderPlatform) => {
    setSelectedPlatform(p);
    const opt = PLATFORM_OPTIONS.find(o => o.id === p);
    if (opt) {
      setBaseUrl(opt.defaultUrl);
      setModelsText(opt.defaultModels.join(', '));
      setChannelName(`${opt.label} 渠道`);
    }
  };

  const handlePullModels = async () => {
    setIsPullingModels(true);
    const models = await pullModels(baseUrl, apiKey || undefined);
    setIsPullingModels(false);
    if (models.length > 0) {
      setModelsText(models.join(', '));
      setProbeMessage(`✅ 成功拉取 ${models.length} 个可用模型`);
    } else {
      setProbeMessage(`⚠️ 未能拉取到模型列表，请确认端点与 Key 是否正确。`);
    }
  };

  const handleTestCurrentForm = async () => {
    const tempChannel: GatewayChannel = {
      id: editingChannelId || 'temp-test',
      name: channelName,
      platform: selectedPlatform,
      ingress_type: selectedIngress,
      base_url: baseUrl,
      api_key: apiKey ? apiKey.trim() : undefined,
      models: modelsText.split(',').map(m => m.trim()).filter(Boolean),
      priority: 1,
      weight: 100,
      enabled: true,
      is_healthy: false,
    };

    const res = await testChannel(tempChannel);
    if (res) {
      if (res.success) {
        setProbeMessage(`🟢 ${res.message}`);
        if (res.models_found.length > 0 && modelsText.split(',').length <= 2) {
          setModelsText(res.models_found.join(', '));
        }
      } else {
        setProbeMessage(`❌ ${res.message}`);
      }
    }
  };

  const handleSave = async () => {
    const channel: GatewayChannel = {
      id: editingChannelId || '',
      name: channelName,
      platform: selectedPlatform,
      ingress_type: selectedIngress,
      base_url: baseUrl,
      api_key: apiKey ? apiKey.trim() : undefined,
      models: modelsText.split(',').map(m => m.trim()).filter(Boolean),
      priority: 1,
      weight: 100,
      enabled: true,
      is_healthy: true,
    };

    const saved = await saveChannel(channel);
    if (saved) {
      if (!editingChannelId && channels.length === 0) {
        await setActiveChannel(saved.id);
      }
      setEditingChannelId(null);
      setProbeMessage('💾 渠道保存成功！');
    }
  };

  const startEdit = (ch: GatewayChannel) => {
    setEditingChannelId(ch.id);
    setSelectedPlatform(ch.platform);
    setSelectedIngress(ch.ingress_type);
    setChannelName(ch.name);
    setBaseUrl(ch.base_url);
    setApiKey(ch.api_key || '');
    setModelsText(ch.models.join(', '));
    setProbeMessage(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#FAF8F5] border border-[#E6DFD5] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E6DFD5] flex items-center justify-between bg-[#F4EFEA]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D96B27]" />
            <h2 className="text-base font-bold text-[#1E1C1A]">
              AI 模型网关与渠道调度驾驶舱 (Model Gateway Cockpit)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#8A847C] hover:text-[#1E1C1A] hover:bg-[#EAE4DC] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Platform Selection Segmented Cards (sub2api style) */}
          <div>
            <label className="text-xs font-semibold text-[#6B665F] uppercase tracking-wider block mb-2">
              1. 选择模型服务商平台 (Platform)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PLATFORM_OPTIONS.map(opt => {
                const isSelected = selectedPlatform === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handlePlatformChange(opt.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-white border-[#D96B27] text-[#D96B27] shadow-xs ring-1 ring-[#D96B27]'
                        : 'bg-white/60 border-[#E6DFD5] text-[#3D3A36] hover:border-[#D96B27]/50 hover:bg-white'
                    }`}
                  >
                    <span className="text-base mb-1">{opt.icon}</span>
                    <span className="truncate w-full text-center text-[11px]">{opt.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Ingress Type (Dynamic Cards) */}
          <div>
            <label className="text-xs font-semibold text-[#6B665F] uppercase tracking-wider block mb-2">
              2. 接入认证方式 (Ingress Authentication)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedIngress('api_key')}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left text-xs transition-all ${
                  selectedIngress === 'api_key'
                    ? 'bg-white border-[#D96B27] text-[#D96B27] ring-1 ring-[#D96B27]'
                    : 'bg-white/60 border-[#E6DFD5] text-[#3D3A36] hover:bg-white'
                }`}
              >
                <Key className="w-4 h-4 text-[#D96B27]" />
                <div>
                  <span className="font-semibold block text-xs">标准 API Key</span>
                  <span className="text-[10px] text-[#8A847C]">使用上游分配的 API Key 直连</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIngress('proxy')}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left text-xs transition-all ${
                  selectedIngress === 'proxy'
                    ? 'bg-white border-[#D96B27] text-[#D96B27] ring-1 ring-[#D96B27]'
                    : 'bg-white/60 border-[#E6DFD5] text-[#3D3A36] hover:bg-white'
                }`}
              >
                <Server className="w-4 h-4 text-[#6B665F]" />
                <div>
                  <span className="font-semibold block text-xs">上游反代 / 中转站</span>
                  <span className="text-[10px] text-[#8A847C]">经由自建 OneAPI / 中继转发</span>
                </div>
              </button>

              {selectedPlatform === 'anthropic' && (
                <button
                  type="button"
                  onClick={() => setSelectedIngress('oauth')}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left text-xs transition-all ${
                    selectedIngress === 'oauth'
                      ? 'bg-white border-[#D96B27] text-[#D96B27] ring-1 ring-[#D96B27]'
                      : 'bg-white/60 border-[#E6DFD5] text-[#3D3A36] hover:bg-white'
                  }`}
                >
                  <Shield className="w-4 h-4 text-[#2E7D32]" />
                  <div>
                    <span className="font-semibold block text-xs">OAuth 2.0 授权</span>
                    <span className="text-[10px] text-[#8A847C]">Claude Code 官方登录与刷新</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Configuration Form */}
          <div className="bg-[#F4EFEA] p-4 rounded-lg border border-[#E6DFD5] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#1E1C1A] block mb-1">渠道别名</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={e => setChannelName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded text-xs text-[#1E1C1A] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1E1C1A] block mb-1">服务端点 (Base URL)</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded text-xs text-[#1E1C1A] font-mono outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1E1C1A] block mb-1">
                API 密钥 (API Key)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded text-xs text-[#1E1C1A] font-mono outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#1E1C1A]">支持模型列表 (逗号分隔)</label>
                <button
                  type="button"
                  onClick={handlePullModels}
                  disabled={isPullingModels}
                  className="text-[11px] text-[#D96B27] hover:underline flex items-center gap-1"
                >
                  <RotateCw className={`w-3 h-3 ${isPullingModels ? 'animate-spin' : ''}`} />
                  <span>从端点自动拉取 (/v1/models)</span>
                </button>
              </div>
              <input
                type="text"
                value={modelsText}
                onChange={e => setModelsText(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded text-xs text-[#1E1C1A] font-mono outline-none"
              />
            </div>

            {/* Probe test feedback box */}
            {probeMessage && (
              <div className="p-2.5 bg-white border border-[#E6DFD5] rounded text-xs text-[#1E1C1A] font-mono">
                {probeMessage}
              </div>
            )}

            {/* Actions for Form */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleTestCurrentForm}
                disabled={isProbing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#FAF8F5] border border-[#D96B27] text-[#D96B27] rounded text-xs font-medium transition-colors"
              >
                <Activity className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
                <span>{isProbing ? '正在连通性测试...' : '⚡ 连通性测速探活'}</span>
              </button>

              <div className="flex items-center gap-2">
                {editingChannelId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingChannelId(null);
                      setProbeMessage(null);
                    }}
                    className="px-3 py-1.5 bg-white border border-[#E6DFD5] text-[#6B665F] rounded text-xs font-medium"
                  >
                    取消编辑
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded text-xs font-medium transition-colors shadow-xs"
                >
                  <span>💾 保存渠道配置</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Existing Channels Pool */}
          <div>
            <h3 className="text-xs font-semibold text-[#6B665F] uppercase tracking-wider mb-2">
              已配置渠道池 (In-Service Channels: {channels.length})
            </h3>
            <div className="space-y-2">
              {channels.map(ch => {
                const isActive = activeChannelId === ch.id;
                const probe = probeResults[ch.id];

                return (
                  <div
                    key={ch.id}
                    className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-white border-[#D96B27] shadow-xs'
                        : 'bg-white/60 border-[#E6DFD5]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          ch.is_healthy ? 'bg-[#2E7D32]' : 'bg-[#E65100]'
                        }`}
                        title={ch.is_healthy ? '健康' : '未验证/异常'}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#1E1C1A]">{ch.name}</span>
                          {isActive && (
                            <span className="text-[9px] bg-[#D96B27]/10 text-[#D96B27] px-1.5 py-0.2 rounded font-semibold">
                              当前主用
                            </span>
                          )}
                          <span className="text-[10px] text-[#8A847C] font-mono">
                            {ch.platform} · {ch.ingress_type}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6B665F] font-mono mt-0.5">
                          {ch.base_url} · 模型: {ch.models.slice(0, 3).join(', ')}
                          {ch.models.length > 3 ? ` +${ch.models.length - 3}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {ch.last_latency_ms && (
                        <span className="text-xs text-[#2E7D32] font-mono">
                          {ch.last_latency_ms}ms
                        </span>
                      )}
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => setActiveChannel(ch.id)}
                          className="px-2 py-1 bg-[#EAE4DC] hover:bg-[#D96B27] hover:text-white rounded text-[11px] font-medium text-[#3D3A36] transition-colors"
                        >
                          设为默认
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => testChannel(ch)}
                        className="p-1.5 text-[#8A847C] hover:text-[#D96B27] rounded hover:bg-[#EAE4DC]"
                        title="立即测试该渠道"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(ch)}
                        className="p-1.5 text-[#8A847C] hover:text-[#1E1C1A] rounded hover:bg-[#EAE4DC]"
                        title="编辑渠道"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChannel(ch.id)}
                        className="p-1.5 text-[#8A847C] hover:text-[#C62828] rounded hover:bg-[#EAE4DC]"
                        title="删除渠道"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
