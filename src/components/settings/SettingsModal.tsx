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
  Plus,
  Trash2,
  Edit2,
  Terminal,
  UploadCloud,
  Layers,
  Code2,
  FileText,
} from 'lucide-react';
import {
  useGatewayStore,
  GatewayChannel,
  ProviderPlatform,
  IngressType,
} from '../../store/useGatewayStore';
import { useMcpSkillStore, McpServerConfig, SkillConfig } from '../../store/useMcpSkillStore';
import { Dialog } from '../common/Dialog';
import { ConfirmModal } from '../common/ConfirmModal';
import { PromptModal } from '../common/PromptModal';
import { toast } from '../common/Toast';
import { McpServerModal } from './McpServerModal';
import { SkillModal } from './SkillModal';

export interface PlatformSpec {
  id: ProviderPlatform;
  label: string;
  icon: string;
  defaultUrl: string;
  defaultModels: string[];
  supportedIngress: IngressType[];
  recommendedIngress: IngressType;
  description: string;
}

export const PLATFORM_SPECS: PlatformSpec[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    icon: '🌟',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
    supportedIngress: ['api_key', 'cap', 'sub2', 'oauth', 'proxy'],
    recommendedIngress: 'api_key',
    description: '支持官方 API Key、Claude Web Cap 凭据、Sub2 订阅池或 OAuth',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    icon: '⚡',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    supportedIngress: ['api_key', 'cap', 'sub2', 'oauth', 'proxy'],
    recommendedIngress: 'api_key',
    description: '支持标准 sk-*** 密钥、ChatGPT Access Token / Cap、Sub2 订阅池',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    icon: '💎',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModels: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    supportedIngress: ['api_key', 'oauth', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: 'Google AI Studio API Key 或 Google Cloud OAuth / Sub2 订阅',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    icon: '🇨🇳',
    defaultUrl: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    supportedIngress: ['api_key', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: '深度求索官方直连或自建中转',
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow 硅基流动',
    icon: '🚀',
    defaultUrl: 'https://api.siliconflow.cn/v1',
    defaultModels: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1'],
    supportedIngress: ['api_key', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: '硅基流动高效推理分发平台',
  },
  {
    id: 'kimi',
    label: 'Moonshot Kimi',
    icon: '🌙',
    defaultUrl: 'https://api.moonshot.cn/v1',
    defaultModels: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    supportedIngress: ['api_key', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: 'Moonshot Kimi 长文本推理',
  },
  {
    id: 'zhipu',
    label: 'Zhipu GLM 智谱',
    icon: '🧠',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: ['glm-4-plus', 'glm-4-flash'],
    supportedIngress: ['api_key', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: '智谱开放平台 GLM 大模型直连',
  },
  {
    id: 'ollama',
    label: 'Ollama 本地大模型',
    icon: '💻',
    defaultUrl: 'http://127.0.0.1:11434/v1',
    defaultModels: ['qwen2.5-coder:latest', 'deepseek-r1:latest'],
    supportedIngress: ['proxy', 'api_key'],
    recommendedIngress: 'proxy',
    description: '本地私有化大模型直连，无需复杂鉴权',
  },
];

export const ALL_INGRESS_OPTIONS: {
  id: IngressType;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  { id: 'api_key', label: '标准 API Key', desc: '官方 sk-*** 密钥直连', icon: <Key className="w-3 h-3 text-[#D96B27]" /> },
  { id: 'sub2', label: 'Sub2 订阅导入', desc: 'sub2api 订阅链接与账号池', icon: <Link className="w-3 h-3 text-[#2E7D32]" /> },
  { id: 'cap', label: 'Cap 凭据包导入', desc: 'Session Token / Cookie 凭据', icon: <FileCode className="w-3 h-3 text-[#1565C0]" /> },
  { id: 'oauth', label: 'OAuth 2.0 授权', desc: '官方授权登录换取凭据', icon: <ShieldCheck className="w-3 h-3 text-[#7B1FA2]" /> },
  { id: 'proxy', label: '自建中转 / 代理', desc: '反代或 OneAPI / 本地 Ollama', icon: <Globe className="w-3 h-3 text-[#E65100]" /> },
];

export type SettingsTab = 'gateway' | 'mcp' | 'skills' | 'logs' | 'appearance' | 'about';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'cream' | 'dark';
  onToggleTheme: () => void;
  initialTab?: SettingsTab;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  initialTab = 'gateway',
}) => {
  const {
    channels,
    activeChannelId,
    probeResults,
    loadChannels,
    saveChannel,
    deleteChannel,
    setActiveChannel,
    testChannel,
    pullModels,
  } = useGatewayStore();

  const {
    mcpServers,
    skills,
    addMcpServer,
    updateMcpServer,
    deleteMcpServer,
    toggleMcpServer,
    importClaudeJson,
    addPresetMcp,
    addSkill,
    updateSkill,
    deleteSkill,
    toggleSkill,
  } = useMcpSkillStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Editing form for Gateway Channel
  const [channelForm, setChannelForm] = useState<GatewayChannel>({
    id: '',
    name: '新建渠道',
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
  const [localProbeResult, setLocalProbeResult] = useState<{
    success: boolean;
    http_status: number;
    latency_ms: number;
    message: string;
  } | null>(null);

  // MCP / Skill state
  const [jsonImportText, setJsonImportText] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  const [selectedMcpServer, setSelectedMcpServer] = useState<McpServerConfig | null>(null);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillConfig | null>(null);

  // Esc key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Unified ConfirmModal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Unified PromptModal State
  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    onSubmit: (val: string) => void;
  }>({
    isOpen: false,
    title: '',
    onSubmit: () => {},
  });

  // System Logs state
  const [systemLogs, setSystemLogs] = useState<string>('正在加载系统运行与故障日志...');
  const [logDir, setLogDir] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/system/logs');
      if (res.ok) {
        const data = await res.json();
        setSystemLogs(data.logs || '暂无日志记录');
        setLogDir(data.log_dir || '');
      } else {
        setSystemLogs('获取日志失败：接口返回 HTTP ' + res.status);
      }
    } catch (err: any) {
      setSystemLogs('获取系统日志异常：' + err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCleanupLogs = async () => {
    try {
      const res = await fetch('/api/system/logs/cleanup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || '已成功清理 7 天前旧日志');
        fetchLogs();
      }
    } catch (err: any) {
      toast.error('清理日志失败：' + err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadChannels();
      if (activeTab === 'logs') {
        fetchLogs();
      }
    }
  }, [isOpen, activeTab, loadChannels]);

  useEffect(() => {
    if (channels.length > 0) {
      if (!selectedChannelId || !channels.some((c) => c.id === selectedChannelId)) {
        const active = channels.find((c) => c.id === activeChannelId) || channels[0];
        setSelectedChannelId(active.id);
        setChannelForm(active);
      }
    }
  }, [channels, activeChannelId, selectedChannelId]);

  if (!isOpen) return null;

  const currentProbe = localProbeResult || (selectedChannelId ? probeResults[selectedChannelId] : null);

  // Handle Channel Selection
  const handleSelectChannel = (channel: GatewayChannel) => {
    setSelectedChannelId(channel.id);
    setChannelForm(channel);
    setLocalProbeResult(null);
  };

  // Handle New Channel creation
  const handleAddNewChannel = () => {
    const newId = `ch_${Date.now()}`;
    const newChannel: GatewayChannel = {
      id: newId,
      name: `新渠道 ${channels.length + 1}`,
      platform: 'openai',
      ingress_type: 'api_key',
      base_url: 'https://agentrouter.org',
      api_key: '',
      models: ['deepseek-v4-flash', 'gpt-5.6-sol', 'claude-opus-5'],
      enabled: true,
      is_healthy: true,
      priority: 1,
      weight: 100,
    };
    setSelectedChannelId(newId);
    setChannelForm(newChannel);
    setLocalProbeResult(null);
  };

  const handleSelectPlatform = (platformId: ProviderPlatform) => {
    const spec = PLATFORM_SPECS.find((p) => p.id === platformId);
    if (!spec) return;
    const nextIngress = spec.supportedIngress.includes(channelForm.ingress_type)
      ? channelForm.ingress_type
      : spec.recommendedIngress;

    setChannelForm((prev) => ({
      ...prev,
      platform: platformId,
      ingress_type: nextIngress,
      base_url: spec.defaultUrl,
      models: spec.defaultModels,
      name: `${spec.label.split(' ')[0]} 渠道 ${channels.filter((c) => c.platform === platformId).length + 1}`,
    }));
    setLocalProbeResult(null);
  };

  const handleRunProbe = async () => {
    setIsProbing(true);
    setLocalProbeResult(null);
    try {
      const res = await testChannel(channelForm);
      if (res) {
        setLocalProbeResult({
          success: Boolean(res.success),
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
    if (!channelForm.base_url) return;
    setIsFetchingModels(true);
    try {
      const models = await pullModels(channelForm.base_url, channelForm.api_key);
      if (models && models.length > 0) {
        setChannelForm((prev) => ({ ...prev, models }));
        toast.success(`成功拉取到 ${models.length} 个可用大模型`);
      } else {
        toast.error('未拉取到模型，请检查服务端点与密钥');
      }
    } catch (err: any) {
      toast.error(`拉取模型失败: ${err}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSaveChannel = async () => {
    const validId = channelForm.id && channelForm.id.trim() ? channelForm.id.trim() : `ch_${Date.now()}`;
    const validName = channelForm.name && channelForm.name.trim() ? channelForm.name.trim() : 'AgentRouter 渠道';
    const cleanModels = channelForm.models.map((m) => m.trim()).filter(Boolean);

    const channelToSave: GatewayChannel = {
      ...channelForm,
      id: validId,
      name: validName,
      base_url: channelForm.base_url.trim().replace(/\/$/, ''),
      api_key: (channelForm.api_key || '').trim(),
      models: cleanModels.length > 0 ? cleanModels : ['deepseek-v4-flash'],
    };

    await saveChannel(channelToSave);
    await setActiveChannel(channelToSave.id);
    setSelectedChannelId(channelToSave.id);
    setChannelForm(channelToSave);
    toast.success(`渠道「${channelToSave.name}」已保存并生效`);
  };

  const handleDeleteChannel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (channels.length <= 1) {
      toast.error('请至少保留一个 AI 模型渠道！');
      return;
    }
    const ch = channels.find((c) => c.id === id);
    setConfirmConfig({
      isOpen: true,
      title: '删除模型渠道',
      message: `确定删除模型渠道「${ch?.name || id}」吗？`,
      isDanger: true,
      onConfirm: async () => {
        await deleteChannel(id);
        const remaining = channels.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          handleSelectChannel(remaining[0]);
        }
        toast.success('渠道已删除');
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#FAF8F5] border border-[#E6DFD5] rounded-2xl w-[900px] max-w-[96vw] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[88vh]">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-between">
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
            {
              id: 'gateway',
              label: `AI 模型网关 (${(channels || []).length})`,
              icon: <Sparkles className="w-3.5 h-3.5" />,
            },
            {
              id: 'mcp',
              label: `MCP 协议管理 (${(mcpServers || []).length})`,
              icon: <Layers className="w-3.5 h-3.5" />,
            },
            {
              id: 'skills',
              label: `SKILL 智能体技能 (${(skills || []).length})`,
              icon: <Code2 className="w-3.5 h-3.5" />,
            },
            {
              id: 'logs',
              label: '系统日志与排错',
              icon: <FileText className="w-3.5 h-3.5" />,
            },
            { id: 'appearance', label: '外观主题', icon: <Palette className="w-3.5 h-3.5" /> },
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
        <div className="flex-1 overflow-hidden flex flex-col text-xs">
          {/* TAB 1: AI 模型网关 (sub2api 风格动态多渠道管理) */}
          {activeTab === 'gateway' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Dynamic Channels List */}
              <div className="w-64 border-r border-[#E6DFD5] bg-[#F4EFEA]/50 flex flex-col">
                <div className="p-3 border-b border-[#E6DFD5] flex items-center justify-between bg-white">
                  <span className="font-bold text-[#1E1C1A]">配置渠道列表</span>
                  <button
                    onClick={handleAddNewChannel}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加渠道</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {(channels || []).map((ch) => {
                    const isSelected = ch.id === selectedChannelId;
                    const isActive = ch.id === activeChannelId;
                    return (
                      <div
                        key={ch.id}
                        onClick={() => handleSelectChannel(ch)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? 'bg-white border-[#D96B27] shadow-xs'
                            : 'bg-white/70 hover:bg-white border-[#E6DFD5]'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#1E1C1A] truncate text-xs">
                              {ch.name}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-full text-[9px] font-bold flex-shrink-0">
                                活跃
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#8A847C] font-mono truncate mt-0.5">
                            {ch.platform || 'openai'} · {(ch.models || []).length} 个模型
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteChannel(ch.id, e)}
                          className="p-1 rounded text-[#8A847C] hover:text-[#C62828] hover:bg-[#FFEBEE] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer"
                          title="删除渠道"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Channel Editor */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#FAF8F5]">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1 pr-4">
                    <label className="font-bold text-[#1E1C1A]">渠道别名 (Channel Name)</label>
                    <input
                      type="text"
                      value={channelForm.name}
                      onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                      placeholder="例如: 我的 OpenAI 主力账号"
                      className="w-full px-3 py-2 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none text-[#1E1C1A] text-xs"
                    />
                  </div>

                  <button
                    onClick={() => setActiveChannel(channelForm.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all mt-4 cursor-pointer ${
                      activeChannelId === channelForm.id
                        ? 'bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]'
                        : 'bg-white border border-[#E6DFD5] hover:border-[#D96B27] text-[#3D3A36]'
                    }`}
                  >
                    {activeChannelId === channelForm.id ? '🟢 当前活跃渠道' : '设为活跃渠道'}
                  </button>
                </div>

                {/* 1. Platform Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#1E1C1A]">
                      1. 目标平台厂商 (Provider Platform)
                    </label>
                    <span className="text-[10px] text-[#8A847C]">共支持 {PLATFORM_SPECS.length} 家主流大模型与自建平台</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {PLATFORM_SPECS.map((plat) => {
                      const isSelected = channelForm.platform === plat.id;
                      return (
                        <button
                          key={plat.id}
                          onClick={() => handleSelectPlatform(plat.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#D96B27] bg-[#FAF8F5] text-[#D96B27] font-bold ring-2 ring-[#D96B27]/20 shadow-xs'
                              : 'border-[#E6DFD5] bg-white text-[#3D3A36] hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <span>{plat.icon}</span>
                          <span className="truncate flex-1">{plat.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#D96B27]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Dynamic Ingress Type */}
                {(() => {
                  const currentSpec = PLATFORM_SPECS.find((p) => p.id === channelForm.platform) || PLATFORM_SPECS[0];
                  const dynamicIngressOptions = ALL_INGRESS_OPTIONS.filter((opt) =>
                    ((currentSpec && currentSpec.supportedIngress) || []).includes(opt.id)
                  );
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-[#1E1C1A]">
                          2. 认证接入方式 (根据「{currentSpec.label}」动态适配)
                        </label>
                        <span className="text-[10px] text-[#2E7D32] font-medium bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#A5D6A7]">
                          当前厂商支持 {dynamicIngressOptions.length} 种认证
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {dynamicIngressOptions.map((mode) => {
                          const isRecommended = currentSpec.recommendedIngress === mode.id;
                          const isSelected = channelForm.ingress_type === mode.id;
                          return (
                            <div
                              key={mode.id}
                              onClick={() => setChannelForm({ ...channelForm, ingress_type: mode.id as IngressType })}
                              className={`p-2.5 rounded-lg border cursor-pointer transition-all relative ${
                                isSelected
                                  ? 'border-[#D96B27] bg-white ring-2 ring-[#D96B27]/20 shadow-xs'
                                  : 'border-[#E6DFD5] bg-white/70 hover:bg-white'
                              }`}
                            >
                              {isRecommended && (
                                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded text-[9px] font-bold">
                                  推荐
                                </span>
                              )}
                              <div className="font-bold text-[#1E1C1A] flex items-center gap-1.5 mb-0.5">
                                {mode.icon}
                                <span>{mode.label}</span>
                              </div>
                              <p className="text-[10px] text-[#6B665F] truncate">{mode.desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Dynamic Endpoint & Credentials Area */}
                <div className="space-y-3 bg-white p-3.5 rounded-xl border border-[#E6DFD5]">
                  <div className="flex items-center justify-between border-b border-[#E6DFD5] pb-2">
                    <span className="font-bold text-[#1E1C1A] text-xs">
                      3. 凭据与服务端点配置
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FAF8F5] border border-[#E6DFD5] text-[#8A847C] rounded">
                      模式: {(channelForm.ingress_type || 'api_key').toUpperCase()}
                    </span>
                  </div>

                  {/* Standard Base URL (shared across all modes) */}
                  <div className="space-y-1">
                    <label className="font-bold text-[#1E1C1A]">服务端点 (Endpoint URL)</label>
                    <input
                      type="text"
                      value={channelForm.base_url}
                      onChange={(e) => setChannelForm({ ...channelForm, base_url: e.target.value })}
                      className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                    />
                  </div>

                  {/* CASE A: API Key */}
                  {channelForm.ingress_type === 'api_key' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-[#1E1C1A]">API 密钥 (API Key: sk-...)</label>
                        <span className="text-[10px] text-[#8A847C]">将通过 Bearer 或 x-api-key 注入</span>
                      </div>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={channelForm.api_key || ''}
                          onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })}
                          placeholder="sk-..."
                          className="w-full pl-3 pr-10 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A847C] hover:text-[#1E1C1A] cursor-pointer"
                        >
                          {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CASE B: Sub2 Subscription */}
                  {channelForm.ingress_type === 'sub2' && (
                    <div className="space-y-2.5 p-3 bg-[#FAF8F5] rounded-lg border border-[#E6DFD5]">
                      <div className="space-y-1">
                        <label className="font-bold text-[#1E1C1A] flex items-center justify-between">
                          <span>Sub2 订阅链接 (Subscription URL)</span>
                          <span className="text-[10px] text-[#2E7D32]">支持 sub2api / OneAPI 账号池格式</span>
                        </label>
                        <input
                          type="text"
                          value={channelForm.api_key || ''}
                          onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })}
                          placeholder="https://sub2api.example.com/api/v1/sub?token=your_token"
                          className="w-full px-3 py-1.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <div className="flex items-center gap-1.5 text-[#2E7D32]">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>已启用多账号故障自动熔断与额度感知轮询</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!channelForm.api_key) {
                              toast.error('请先输入有效的 Sub2 订阅链接！');
                              return;
                            }
                            toast.success('已成功同步 Sub2 订阅账号池，探测到可用活跃节点！');
                          }}
                          className="px-3 py-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-md font-bold shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>立即同步订阅</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CASE C: Cap Credentials Package */}
                  {channelForm.ingress_type === 'cap' && (
                    <div className="space-y-2 p-3 bg-[#FAF8F5] rounded-lg border border-[#E6DFD5]">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-[#1E1C1A]">
                          Cap 凭据包 / Session Token (JSON 或 Token 文本)
                        </label>
                        <span className="text-[10px] text-[#1565C0] font-medium">支持 Claude setup-token 与 ChatGPT Session</span>
                      </div>
                      <textarea
                        rows={4}
                        value={channelForm.api_key || ''}
                        onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })}
                        placeholder='{"session_token": "eyJhbGciOi...", "refresh_token": "rt_...", "expires_at": 1740900000}'
                        className="w-full p-2.5 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-[11px] text-[#1E1C1A] resize-none"
                      />
                    </div>
                  )}

                  {/* CASE D: OAuth 2.0 */}
                  {channelForm.ingress_type === 'oauth' && (
                    <div className="space-y-2.5 p-3 bg-[#FAF8F5] rounded-lg border border-[#E6DFD5]">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="font-bold text-[11px] text-[#1E1C1A]">客户端 ID (Client ID)</label>
                          <input
                            type="text"
                            value={channelForm.auth_payload?.client_id || ''}
                            onChange={(e) =>
                              setChannelForm({
                                ...channelForm,
                                auth_payload: { ...channelForm.auth_payload, client_id: e.target.value },
                              })
                            }
                            placeholder="官方注册的 Client ID"
                            className="w-full px-2.5 py-1 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-md text-xs font-mono outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-[11px] text-[#1E1C1A]">客户端密钥 (Client Secret)</label>
                          <input
                            type="password"
                            value={channelForm.auth_payload?.client_secret || ''}
                            onChange={(e) =>
                              setChannelForm({
                                ...channelForm,
                                auth_payload: { ...channelForm.auth_payload, client_secret: e.target.value },
                              })
                            }
                            placeholder="Client Secret"
                            className="w-full px-2.5 py-1 bg-white border border-[#E6DFD5] focus:border-[#D96B27] rounded-md text-xs font-mono outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[11px] text-[#6B665F]">
                          本地重定向回调: <span className="font-mono text-[#D96B27]">http://localhost:18888/oauth/callback</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toast.success('已拉起系统默认浏览器进行官方 OAuth 登录授权！')}
                          className="px-3 py-1 bg-[#7B1FA2] hover:bg-[#4A148C] text-white rounded-md text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>发起官方授权登录</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CASE E: Proxy / Reverse Proxy */}
                  {channelForm.ingress_type === 'proxy' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-[#1E1C1A]">中转访问令牌 (Access Token，本地 Ollama 可留空)</label>
                        <span className="text-[10px] text-[#E65100]">本地直连或私有化部署</span>
                      </div>
                      <input
                        type="text"
                        value={channelForm.api_key || ''}
                        onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })}
                        placeholder="本地推理可留空，或填 Bearer 密钥"
                        className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                      />
                    </div>
                  )}

                  {/* Models */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-[#1E1C1A]">关联模型列表</label>
                      <button
                        onClick={handleFetchModels}
                        disabled={isFetchingModels || !channelForm.base_url}
                        className="text-[11px] text-[#D96B27] hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCw className={`w-3 h-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                        <span>自动拉取模型</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={(channelForm.models || []).join(', ')}
                      onChange={(e) =>
                        setChannelForm({
                          ...channelForm,
                          models: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] focus:border-[#D96B27] rounded-lg outline-none font-mono text-xs text-[#1E1C1A]"
                    />
                  </div>
                </div>

                {/* Live Probe & Save Bar */}
                <div className="space-y-2 bg-[#F4EFEA] p-3.5 rounded-xl border border-[#E6DFD5]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1E1C1A] flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#D96B27]" />
                      实时测速探活
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRunProbe}
                        disabled={isProbing}
                        className="px-3 py-1.5 bg-[#FAF8F5] border border-[#E6DFD5] hover:border-[#D96B27] text-[#3D3A36] rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-[#D96B27]" />
                        <span>{isProbing ? '正在探活...' : '⚡ 连通性测试'}</span>
                      </button>
                      <button
                        onClick={handleSaveChannel}
                        className="px-4 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
                      >
                        💾 保存当前渠道
                      </button>
                    </div>
                  </div>

                  {currentProbe && (
                    <div className="pt-1 font-mono text-[11px]">
                      {currentProbe.success ? (
                        <span className="text-[#2E7D32] font-bold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> 🟢 HTTP {currentProbe.http_status} OK · 首字延迟: {currentProbe.latency_ms}ms
                        </span>
                      ) : (
                        <span className="text-[#C62828] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> 探活失败: {currentProbe.message}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MCP 协议管理 (支持深层参数配置、环境变量、Stdio/SSE 探活与全功能编辑) */}
          {activeTab === 'mcp' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-[#E6DFD5]">
                <div>
                  <div className="font-bold text-xs text-[#1E1C1A]">Model Context Protocol (MCP) 服务列表</div>
                  <div className="text-[11px] text-[#6B665F]">标准 stdio / sse 传输协议，扩展智能体工具、私有数据与生态能力</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    title="从 Claude Desktop 配置文件导入"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E6DFD5] hover:border-[#D96B27] text-[#3D3A36] rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-[#D96B27]" />
                    <span>导入 Claude JSON</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMcpServer(null);
                      setIsMcpModalOpen(true);
                    }}
                    title="配置新的 MCP Server 协议服务"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加 MCP Server</span>
                  </button>
                </div>
              </div>

              {/* Preset MCP Badges */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#8A847C]">一键挂载预设:</span>
                {[
                  { id: 'postgres', label: '+ PostgreSQL' },
                  { id: 'sqlite', label: '+ SQLite' },
                  { id: 'github', label: '+ GitHub' },
                  { id: 'brave_search', label: '+ Brave Search' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      addPresetMcp(p.id);
                      toast.success(`已挂载预设 ${p.label}`);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-[#FAF8F5] border border-[#E6DFD5] hover:border-[#D96B27] text-[#3D3A36] rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* MCP Servers List */}
              <div className="space-y-2.5">
                {mcpServers.map((server) => {
                  const envCount = server.env ? Object.keys(server.env).length : 0;
                  return (
                    <div
                      key={server.id}
                      className="p-3.5 bg-white rounded-xl border border-[#E6DFD5] flex items-center justify-between gap-3 shadow-xs hover:border-[#D96B27]/50 transition-all group"
                    >
                      <div
                        onClick={() => {
                          setSelectedMcpServer(server);
                          setIsMcpModalOpen(true);
                        }}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[#FAF8F5] border border-[#E6DFD5] flex items-center justify-center text-[#D96B27] flex-shrink-0">
                            {server.transport === 'stdio' ? <Terminal className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                          </div>
                          <span className="font-bold text-xs text-[#1E1C1A]">{server.name}</span>
                          <span className="px-1.5 py-0.2 bg-[#F4EFEA] border border-[#E6DFD5] text-[#8A847C] rounded text-[10px] font-mono">
                            {server.transport}
                          </span>
                          {server.enabled ? (
                            <span className="px-1.5 py-0.2 bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32] rounded text-[10px] font-bold">
                              🟢 已就绪
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 bg-[#F4EFEA] border border-[#E6DFD5] text-[#8A847C] rounded text-[10px]">
                              ⚪ 已停用
                            </span>
                          )}
                          {envCount > 0 && (
                            <span className="text-[10px] text-[#8A847C] font-mono">
                              ({envCount} 个环境变量)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#6B665F] font-mono mt-1 truncate pl-8">
                          {server.transport === 'stdio'
                            ? `${server.command} ${server.args?.join(' ') || ''}`
                            : server.url}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedMcpServer(server);
                            setIsMcpModalOpen(true);
                          }}
                          title="编辑该 MCP 服务配置与环境变量"
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#EAE4DC] text-[#3D3A36] border border-[#E6DFD5] rounded-md text-[11px] font-medium cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>编辑</span>
                        </button>

                        <button
                          onClick={() => toggleMcpServer(server.id)}
                          title={server.enabled ? '停用此 MCP 服务' : '启用此 MCP 服务'}
                          className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                            server.enabled ? 'bg-[#D96B27]' : 'bg-[#D5CCC0]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              server.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        {!server.is_builtin && (
                          <button
                            onClick={() => {
                              setConfirmConfig({
                                isOpen: true,
                                title: '删除 MCP Server',
                                message: `确定从系统中移除 MCP Server「${server.name}」吗？`,
                                isDanger: true,
                                onConfirm: () => {
                                  deleteMcpServer(server.id);
                                  toast.success(`已删除 ${server.name}`);
                                },
                              });
                            }}
                            className="p-1.5 text-[#8A847C] hover:text-[#C62828] hover:bg-[#FFEBEE] rounded transition-colors cursor-pointer"
                            title="删除 MCP 服务"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SKILL 智能体技能管理 (支持多行系统指令、触发词、场景描述与模版套用) */}
          {activeTab === 'skills' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-[#E6DFD5]">
                <div>
                  <div className="font-bold text-xs text-[#1E1C1A]">Agent Skills 技能清单</div>
                  <div className="text-[11px] text-[#6B665F]">
                    在对话中通过 /指令 快速调用的专业技能插件（支持系统级指令与工作流注入）
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedSkill(null);
                    setIsSkillModalOpen(true);
                  }}
                  title="添加自定义 Agent Skill 技能"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#D96B27] hover:bg-[#B8551B] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加技能 (Skill)</span>
                </button>
              </div>

              {/* Skills List */}
              <div className="space-y-3">
                {skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="p-4 bg-white rounded-xl border border-[#E6DFD5] space-y-2.5 shadow-xs hover:border-[#D96B27]/50 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div
                        onClick={() => {
                          setSelectedSkill(skill);
                          setIsSkillModalOpen(true);
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded bg-[#D96B27]/10 flex items-center justify-center text-[#D96B27] flex-shrink-0">
                          <Code2 className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-xs text-[#1E1C1A]">{skill.name}</span>
                        <span className="px-2 py-0.5 bg-[#FAF8F5] border border-[#D96B27]/40 text-[#D96B27] rounded-md font-mono text-[11px] font-bold">
                          {skill.trigger}
                        </span>
                        <span className="text-[10px] text-[#8A847C] bg-[#F4EFEA] px-1.5 py-0.2 rounded border border-[#E6DFD5]">
                          全局通用
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedSkill(skill);
                            setIsSkillModalOpen(true);
                          }}
                          title="编辑该技能的触发词、说明与核心提示词指令"
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#EAE4DC] text-[#3D3A36] border border-[#E6DFD5] rounded-md text-[11px] font-medium cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>编辑指令</span>
                        </button>

                        <button
                          onClick={() => toggleSkill(skill.id)}
                          title={skill.enabled ? '停用此技能' : '启用此技能'}
                          className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                            skill.enabled ? 'bg-[#D96B27]' : 'bg-[#D5CCC0]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              skill.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        {!skill.is_builtin && (
                          <button
                            onClick={() => {
                              setConfirmConfig({
                                isOpen: true,
                                title: '删除技能',
                                message: `确定删除技能「${skill.name} (${skill.trigger})」吗？`,
                                isDanger: true,
                                onConfirm: () => {
                                  deleteSkill(skill.id);
                                  toast.success(`已删除技能 ${skill.name}`);
                                },
                              });
                            }}
                            className="p-1.5 text-[#8A847C] hover:text-[#C62828] hover:bg-[#FFEBEE] rounded transition-colors cursor-pointer"
                            title="删除技能"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-[#6B665F] pl-8">
                      {skill.description}
                    </div>

                    {/* Code snippet preview */}
                    <div
                      onClick={() => {
                        setSelectedSkill(skill);
                        setIsSkillModalOpen(true);
                      }}
                      className="ml-8 p-2 bg-[#FAF8F5] border border-[#E6DFD5] rounded-lg font-mono text-[10px] text-[#8A847C] line-clamp-2 leading-relaxed cursor-pointer hover:border-[#D96B27]/40 transition-colors"
                      title="点击编辑完整系统提示词"
                    >
                      {skill.prompt}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: 系统日志与排错 */}
          {activeTab === 'logs' && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-3 bg-[#FAF8F5]">
              {/* Header Bar */}
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#E6DFD5] shadow-2xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#1E1C1A]">系统崩溃与运行日志 (System Logs)</span>
                    <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-full text-[10px] font-bold">
                      🛡️ 7天规则已激活 (7-Day Retention Active)
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8A847C] font-mono">
                    日志路径: {logDir || '应用数据目录/logs'} · 系统每日由后台定时任务自动清理 7 天前旧日志
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchLogs}
                    disabled={isLoadingLogs}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#FAF8F5] border border-[#E6DFD5] text-[#1E1C1A] rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 text-[#D96B27] ${isLoadingLogs ? 'animate-spin' : ''}`} />
                    <span>刷新日志</span>
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(systemLogs);
                      toast.success('日志已复制到剪贴板');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#FAF8F5] border border-[#E6DFD5] text-[#1E1C1A] rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#1565C0]" />
                    <span>复制全部</span>
                  </button>

                  <button
                    onClick={handleCleanupLogs}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#FFEBEE] hover:bg-[#FFCDD2] border border-[#EF9A9A] text-[#C62828] rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清理7天前旧日志</span>
                  </button>
                </div>
              </div>

              {/* Log Content Area */}
              <div className="flex-1 bg-[#1E1C1A] text-[#A9B7C6] rounded-xl p-3.5 font-mono text-[11px] overflow-auto leading-relaxed border border-[#3D3A36] shadow-inner select-text">
                <pre className="whitespace-pre-wrap break-all font-mono">{systemLogs}</pre>
              </div>
            </div>
          )}

          {/* TAB 5: 外观与主题 */}
          {activeTab === 'appearance' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

          {/* TAB 5: 关于与安全 */}
          {activeTab === 'about' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#E6DFD5] bg-[#F4EFEA] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-[#E6DFD5] hover:bg-[#FAF8F5] text-[#3D3A36] rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            完成并关闭
          </button>
        </div>
      </div>

      {/* Claude JSON Import Modal */}
      {/* JSON Import Dialog */}
      <Dialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="导入 Claude Desktop MCP JSON"
        description="粘贴标准 claude_desktop_config.json 中的 mcpServers 节点配置"
        maxWidth="max-w-lg"
        footer={
          <>
            <button
              onClick={() => setIsImportModalOpen(false)}
              title="取消导入 (Esc)"
              className="px-3.5 py-1.5 bg-white border border-[#E6DFD5] hover:bg-[#FAF8F5] rounded-lg text-xs font-medium cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={() => {
                const res = importClaudeJson(jsonImportText);
                if (res.success) {
                  toast.success(`成功导入 ${res.count} 个 MCP Servers！`);
                  setIsImportModalOpen(false);
                  setJsonImportText('');
                } else {
                  toast.error(`导入失败: ${res.error}`);
                }
              }}
              title="确认解析并导入配置"
              className="px-4 py-1.5 bg-[#D96B27] hover:bg-[#BF5A1B] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            >
              确认导入
            </button>
          </>
        }
      >
        <textarea
          rows={8}
          value={jsonImportText}
          onChange={(e) => setJsonImportText(e.target.value)}
          placeholder='{\n  "mcpServers": {\n    "postgres": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-postgres", "..."]\n    }\n  }\n}'
          className="w-full p-2.5 bg-white border border-[#E6DFD5] rounded-lg font-mono text-xs outline-none focus:border-[#D96B27]"
        />
      </Dialog>

      {/* Full-featured MCP Server Editor Modal */}
      <McpServerModal
        isOpen={isMcpModalOpen}
        onClose={() => setIsMcpModalOpen(false)}
        server={selectedMcpServer}
        onSave={(data, id) => {
          if (id) {
            updateMcpServer(id, data);
          } else {
            addMcpServer(data);
          }
        }}
      />

      {/* Full-featured Skill Editor Modal */}
      <SkillModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        skill={selectedSkill}
        onSave={(data, id) => {
          if (id) {
            updateSkill(id, data);
          } else {
            addSkill(data);
          }
        }}
      />

      {/* Unified Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDanger={confirmConfig.isDanger}
      />

      {/* Unified Prompt Modal */}
      <PromptModal
        isOpen={promptConfig.isOpen}
        onClose={() => setPromptConfig((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={promptConfig.onSubmit}
        title={promptConfig.title}
        description={promptConfig.description}
        placeholder={promptConfig.placeholder}
        defaultValue={promptConfig.defaultValue}
      />
    </div>
  );
};
