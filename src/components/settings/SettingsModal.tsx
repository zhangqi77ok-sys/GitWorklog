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
  Sliders,
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
    icon: '✦',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModels: ['claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
    supportedIngress: ['api_key', 'cap', 'sub2', 'oauth', 'proxy'],
    recommendedIngress: 'api_key',
    description: 'Anthropic Claude 官方或代理接入',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    icon: '⚡',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    supportedIngress: ['api_key', 'cap', 'sub2', 'oauth', 'proxy'],
    recommendedIngress: 'api_key',
    description: 'OpenAI 官方 API 或中转',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    icon: '✧',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModels: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    supportedIngress: ['api_key', 'oauth', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: 'Google AI Studio 或 Cloud OAuth',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    icon: '❖',
    defaultUrl: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    supportedIngress: ['api_key', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: '深度求索官方直连或中转网关',
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow 硅基流动',
    icon: '▲',
    defaultUrl: 'https://api.siliconflow.cn/v1',
    defaultModels: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1'],
    supportedIngress: ['api_key', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: '硅基流动高效算力分发平台',
  },
  {
    id: 'kimi',
    label: 'Moonshot Kimi',
    icon: '●',
    defaultUrl: 'https://api.moonshot.cn/v1',
    defaultModels: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    supportedIngress: ['api_key', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: 'Moonshot Kimi 长上下文模型',
  },
  {
    id: 'zhipu',
    label: 'Zhipu GLM 智谱',
    icon: '◆',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: ['glm-4-plus', 'glm-4-flash'],
    supportedIngress: ['api_key', 'sub2', 'proxy'],
    recommendedIngress: 'api_key',
    description: '智谱开放平台 GLM 系列大模型',
  },
  {
    id: 'ollama',
    label: 'Ollama 本地模型',
    icon: '💻',
    defaultUrl: 'http://127.0.0.1:11434/v1',
    defaultModels: ['qwen2.5-coder:latest', 'deepseek-r1:latest'],
    supportedIngress: ['proxy', 'api_key'],
    recommendedIngress: 'proxy',
    description: '本地私有化部署，无需公网鉴权',
  },
];

export const ALL_INGRESS_OPTIONS: {
  id: IngressType;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  { id: 'api_key', label: '标准 API Key', desc: '官方 sk-*** 密钥直连', icon: <Key className="w-3.5 h-3.5 text-[#D96B27]" /> },
  { id: 'proxy', label: '自建中转 / 代理', desc: '反向代理 / OneAPI / Ollama', icon: <Globe className="w-3.5 h-3.5 text-[#10A37F]" /> },
  { id: 'sub2', label: 'Sub2 订阅池', desc: 'sub2api 订阅链接与账号池', icon: <Link className="w-3.5 h-3.5 text-[#2563EB]" /> },
  { id: 'cap', label: 'Cap 凭据包导入', desc: 'Session Token / Cookie 凭据', icon: <FileCode className="w-3.5 h-3.5 text-[#7C3AED]" /> },
  { id: 'oauth', label: 'OAuth 2.0 授权', desc: '官方授权登录换取凭据', icon: <ShieldCheck className="w-3.5 h-3.5 text-[#D97706]" /> },
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

  // ConfirmModal State
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

  // PromptModal State
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
  const [systemLogs, setSystemLogs] = useState<string>('正在加载系统运行与排错日志...');
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

  const handleSelectChannel = (channel: GatewayChannel) => {
    setSelectedChannelId(channel.id);
    setChannelForm(channel);
    setLocalProbeResult(null);
  };

  const handleAddNewChannel = () => {
    const newId = `ch_${Date.now()}`;
    const newChannel: GatewayChannel = {
      id: newId,
      name: `新渠道 ${channels.length + 1}`,
      platform: 'deepseek',
      ingress_type: 'api_key',
      base_url: 'https://api.deepseek.com/v1',
      api_key: '',
      models: ['deepseek-chat', 'deepseek-reasoner'],
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
        toast.success(`成功拉取到 ${models.length} 个可用模型`);
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
    const validName = channelForm.name && channelForm.name.trim() ? channelForm.name.trim() : '新模型渠道';
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
    toast.success(`渠道「${channelToSave.name}」已保存并激活`);
  };

  const handleDeleteChannel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (channels.length <= 1) {
      toast.error('请至少保留一个可用渠道！');
      return;
    }
    const ch = channels.find((c) => c.id === id);
    setConfirmConfig({
      isOpen: true,
      title: '删除模型渠道',
      message: `确定删除渠道「${ch?.name || id}」吗？`,
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

  const navItems = [
    { id: 'gateway', label: 'AI 模型渠道', badge: (channels || []).length, icon: <Sparkles className="w-4 h-4" /> },
    { id: 'mcp', label: 'MCP 协议服务', badge: (mcpServers || []).length, icon: <Layers className="w-4 h-4" /> },
    { id: 'skills', label: '智能体技能', badge: (skills || []).length, icon: <Code2 className="w-4 h-4" /> },
    { id: 'logs', label: '系统排错日志', icon: <FileText className="w-4 h-4" /> },
    { id: 'appearance', label: '外观与关于', icon: <Sliders className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#FAF9F6] border border-black/[0.1] rounded-2xl w-[960px] max-w-[96vw] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[86vh] max-h-[720px]">
        {/* Top Minimal Bar */}
        <div className="h-11 px-4 border-b border-[#E8E5DF] flex items-center justify-between bg-white/70">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#18181B] flex items-center justify-center text-white text-[11px] font-bold shadow-2xs">
              T
            </div>
            <span className="font-semibold text-xs text-[#18181B] tracking-tight">偏好设置 · Settings</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.05] flex items-center justify-center transition-colors cursor-pointer"
            title="关闭 (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Main 2-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation Sidebar */}
          <div className="w-48 bg-[#F4F2EE] border-r border-[#E8E5DF] flex flex-col justify-between p-2 flex-shrink-0">
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id as SettingsTab)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#18181B] shadow-2xs border border-black/[0.08] font-semibold'
                        : 'text-[#71717A] hover:text-[#18181B] hover:bg-black/[0.03]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={isActive ? 'text-[#D96B27]' : 'text-[#71717A]'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {typeof item.badge === 'number' && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/[0.05] text-[#71717A] font-mono">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-2 border-t border-black/[0.06] text-[10px] font-mono text-[#A1A1AA] flex items-center justify-between">
              <span>Tcode v2.0.0</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10A37F]" />
            </div>
          </div>

          {/* Right Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* TAB 1: AI 模型渠道 */}
            {activeTab === 'gateway' && (
              <div className="flex-1 flex overflow-hidden">
                {/* Channel List Sub-sidebar */}
                <div className="w-52 border-r border-[#E8E5DF] bg-[#FAF9F6] flex flex-col flex-shrink-0">
                  <div className="p-2.5 px-3 border-b border-[#E8E5DF] flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#18181B]">渠道列表</span>
                    <button
                      type="button"
                      onClick={handleAddNewChannel}
                      className="flex items-center gap-1 px-2 py-0.5 bg-[#18181B] hover:bg-black text-white rounded-md text-[11px] font-medium shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>添加</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                    {(channels || []).map((ch) => {
                      const isSelected = ch.id === selectedChannelId;
                      const isActive = ch.id === activeChannelId;
                      return (
                        <div
                          key={ch.id}
                          onClick={() => handleSelectChannel(ch)}
                          className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                            isSelected
                              ? 'bg-white border-black/[0.12] shadow-2xs'
                              : 'bg-transparent hover:bg-white/80 border-transparent'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-[#10A37F]' : 'bg-[#D4D4D8]'}`} />
                              <span className="font-medium text-xs text-[#18181B] truncate">{ch.name}</span>
                            </div>
                            <div className="text-[10px] text-[#71717A] font-mono truncate pl-3 mt-0.5">
                              {ch.platform} · {(ch.models || []).length} 模型
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteChannel(ch.id, e)}
                            className="p-1 rounded text-[#A1A1AA] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer"
                            title="删除渠道"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Channel Form Editor */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white text-xs">
                  {/* Top: Name & Active Toggle */}
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-black/[0.06]">
                    <div className="flex-1">
                      <label className="text-[11px] font-medium text-[#71717A] block mb-1">渠道名称</label>
                      <input
                        type="text"
                        value={channelForm.name}
                        onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                        placeholder="例如: DeepSeek 官方渠道"
                        className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-black/[0.08] focus:border-[#18181B] rounded-lg outline-none text-[#18181B] text-xs transition-colors"
                      />
                    </div>
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={() => setActiveChannel(channelForm.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                          activeChannelId === channelForm.id
                            ? 'bg-[#10A37F]/10 text-[#10A37F] border-[#10A37F]/20 font-semibold'
                            : 'bg-[#FAF9F6] border-black/[0.08] text-[#71717A] hover:text-[#18181B] hover:bg-white'
                        }`}
                      >
                        {activeChannelId === channelForm.id ? '● 当前活跃' : '设为活跃'}
                      </button>
                    </div>
                  </div>

                  {/* 1. Target Platform Selection */}
                  <div>
                    <label className="text-[11px] font-medium text-[#71717A] block mb-1.5">模型平台厂商</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {PLATFORM_SPECS.map((plat) => {
                        const isSelected = channelForm.platform === plat.id;
                        return (
                          <button
                            key={plat.id}
                            type="button"
                            onClick={() => handleSelectPlatform(plat.id)}
                            className={`flex items-center gap-1.5 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#18181B] bg-[#FAF9F6] text-[#18181B] font-medium shadow-2xs'
                                : 'border-black/[0.06] bg-white text-[#71717A] hover:text-[#18181B] hover:bg-[#FAF9F6]'
                            }`}
                          >
                            <span className="text-xs text-[#D96B27]">{plat.icon}</span>
                            <span className="truncate flex-1 text-[11px]">{plat.label.split(' ')[0]}</span>
                            {isSelected && <Check className="w-3 h-3 text-[#18181B]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Ingress Type Pills */}
                  {(() => {
                    const currentSpec = PLATFORM_SPECS.find((p) => p.id === channelForm.platform) || PLATFORM_SPECS[0];
                    const dynamicIngressOptions = ALL_INGRESS_OPTIONS.filter((opt) =>
                      ((currentSpec && currentSpec.supportedIngress) || []).includes(opt.id)
                    );
                    return (
                      <div>
                        <label className="text-[11px] font-medium text-[#71717A] block mb-1.5">接入方式</label>
                        <div className="flex flex-wrap gap-1.5">
                          {dynamicIngressOptions.map((mode) => {
                            const isSelected = channelForm.ingress_type === mode.id;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => setChannelForm({ ...channelForm, ingress_type: mode.id as IngressType })}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-[#18181B] text-white border-[#18181B] shadow-2xs font-medium'
                                    : 'bg-[#FAF9F6] border-black/[0.08] text-[#52525B] hover:text-[#18181B] hover:bg-white'
                                }`}
                              >
                                {mode.icon}
                                <span>{mode.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 3. Endpoint & Credentials */}
                  <div className="space-y-3 bg-[#FAF9F6] p-3 rounded-xl border border-black/[0.06]">
                    <div>
                      <label className="text-[11px] font-medium text-[#71717A] block mb-1">服务站点 URL (Endpoint)</label>
                      <input
                        type="text"
                        value={channelForm.base_url}
                        onChange={(e) => setChannelForm({ ...channelForm, base_url: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-black/[0.08] focus:border-[#18181B] rounded-lg outline-none font-mono text-xs text-[#18181B]"
                      />
                    </div>

                    {channelForm.ingress_type === 'api_key' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-[#71717A]">API Key</label>
                          <span className="text-[10px] text-[#A1A1AA]">Bearer / x-api-key</span>
                        </div>
                        <div className="relative">
                          <input
                            type={showKey ? 'text' : 'password'}
                            value={channelForm.api_key || ''}
                            onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })}
                            placeholder="sk-..."
                            className="w-full pl-2.5 pr-8 py-1.5 bg-white border border-black/[0.08] focus:border-[#18181B] rounded-lg outline-none font-mono text-xs text-[#18181B]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#18181B] cursor-pointer"
                          >
                            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {channelForm.ingress_type === 'proxy' && (
                      <div>
                        <label className="text-[11px] font-medium text-[#71717A] block mb-1">访问令牌 (本地 Ollama 可留空)</label>
                        <input
                          type="text"
                          value={channelForm.api_key || ''}
                          onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })}
                          placeholder="本地直连留空，或填中转 Token"
                          className="w-full px-2.5 py-1.5 bg-white border border-black/[0.08] focus:border-[#18181B] rounded-lg outline-none font-mono text-xs text-[#18181B]"
                        />
                      </div>
                    )}

                    {channelForm.ingress_type === 'sub2' && (
                      <div>
                        <label className="text-[11px] font-medium text-[#71717A] block mb-1">Sub2 订阅链接</label>
                        <input
                          type="text"
                          value={channelForm.api_key || ''}
                          onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })}
                          placeholder="https://your-domain.com/sub/..."
                          className="w-full px-2.5 py-1.5 bg-white border border-black/[0.08] focus:border-[#18181B] rounded-lg outline-none font-mono text-xs text-[#18181B]"
                        />
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-[#71717A]">关联模型列表</label>
                        <button
                          type="button"
                          onClick={handleFetchModels}
                          disabled={isFetchingModels || !channelForm.base_url}
                          className="text-[11px] text-[#D96B27] hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer font-medium"
                        >
                          <RotateCw className={`w-3 h-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                          <span>拉取模型</span>
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
                        className="w-full px-2.5 py-1.5 bg-white border border-black/[0.08] focus:border-[#18181B] rounded-lg outline-none font-mono text-xs text-[#18181B]"
                      />
                    </div>
                  </div>

                  {/* Actions: Test & Save */}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      {currentProbe && (
                        <div className="font-mono text-[11px]">
                          {currentProbe.success ? (
                            <span className="text-[#10A37F] font-medium flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> 延迟: {currentProbe.latency_ms}ms · 正常
                            </span>
                          ) : (
                            <span className="text-[#DC2626] font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> 探活失败
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRunProbe}
                        disabled={isProbing}
                        className="px-3 py-1.5 bg-[#FAF9F6] border border-black/[0.08] hover:border-black/[0.18] text-[#18181B] rounded-lg text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 text-[#D96B27]" />
                        <span>{isProbing ? '探活中...' : '测试连通性'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChannel}
                        className="px-4 py-1.5 bg-[#18181B] hover:bg-black text-white rounded-lg text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                      >
                        保存当前渠道
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MCP 协议管理 */}
            {activeTab === 'mcp' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                  <div>
                    <h3 className="font-semibold text-sm text-[#18181B]">Model Context Protocol (MCP) 服务</h3>
                    <p className="text-[11px] text-[#71717A] mt-0.5">标准 stdio 与 sse 传输协议，挂载外部开发环境与数据库能力</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#FAF9F6] border border-black/[0.08] hover:border-black/[0.18] rounded-lg text-xs font-medium cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-[#71717A]" />
                      <span>导入 Claude JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMcpServer(null);
                        setIsMcpModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-3.5 py-1.5 bg-[#18181B] hover:bg-black text-white rounded-lg text-xs font-medium shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>添加服务</span>
                    </button>
                  </div>
                </div>

                {/* Preset Badges */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[#A1A1AA] text-[11px]">快捷预设:</span>
                  {[
                    { id: 'postgres', label: 'PostgreSQL' },
                    { id: 'sqlite', label: 'SQLite' },
                    { id: 'github', label: 'GitHub' },
                    { id: 'brave_search', label: 'Brave Search' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        addPresetMcp(p.id);
                        toast.success(`已添加预设 ${p.label}`);
                      }}
                      className="px-2.5 py-1 bg-[#FAF9F6] hover:bg-white border border-black/[0.06] rounded-md text-[11px] text-[#52525B] font-medium transition-colors cursor-pointer"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>

                {/* Server List */}
                <div className="space-y-2">
                  {mcpServers.map((server) => (
                    <div
                      key={server.id}
                      className="p-3 bg-[#FAF9F6] rounded-xl border border-black/[0.06] flex items-center justify-between gap-3 transition-all hover:border-black/[0.14]"
                    >
                      <div
                        onClick={() => {
                          setSelectedMcpServer(server);
                          setIsMcpModalOpen(true);
                        }}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#18181B]">{server.name}</span>
                          <span className="px-1.5 py-0.2 bg-black/[0.04] rounded text-[10px] font-mono text-[#71717A]">
                            {server.transport}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium ${server.enabled ? 'text-[#10A37F] bg-[#10A37F]/10' : 'text-[#A1A1AA] bg-black/[0.03]'}`}>
                            {server.enabled ? '就绪' : '已停用'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#71717A] font-mono mt-0.5 truncate">
                          {server.transport === 'stdio'
                            ? `${server.command} ${server.args?.join(' ') || ''}`
                            : server.url}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMcpServer(server);
                            setIsMcpModalOpen(true);
                          }}
                          className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-white cursor-pointer"
                          title="编辑配置"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleMcpServer(server.id)}
                          className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                            server.enabled ? 'bg-[#18181B]' : 'bg-[#E4E4E7]'
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                              server.enabled ? 'translate-x-3.5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        {!server.is_builtin && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmConfig({
                                isOpen: true,
                                title: '删除 MCP Server',
                                message: `确定移除 MCP 服务「${server.name}」吗？`,
                                isDanger: true,
                                onConfirm: () => {
                                  deleteMcpServer(server.id);
                                  toast.success(`已删除 ${server.name}`);
                                },
                              });
                            }}
                            className="p-1 text-[#A1A1AA] hover:text-[#DC2626] rounded cursor-pointer"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: 智能体技能 */}
            {activeTab === 'skills' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                  <div>
                    <h3 className="font-semibold text-sm text-[#18181B]">Agent Skills 技能库</h3>
                    <p className="text-[11px] text-[#71717A] mt-0.5">对话中通过 /指令 快速调用的工作流与专业提示词扩展</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSkill(null);
                      setIsSkillModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-3.5 py-1.5 bg-[#18181B] hover:bg-black text-white rounded-lg text-xs font-medium shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加技能</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="p-3.5 bg-[#FAF9F6] rounded-xl border border-black/[0.06] space-y-2 hover:border-black/[0.14] transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div
                          onClick={() => {
                            setSelectedSkill(skill);
                            setIsSkillModalOpen(true);
                          }}
                          className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="font-semibold text-xs text-[#18181B]">{skill.name}</span>
                          <span className="px-2 py-0.5 bg-black/[0.04] text-[#18181B] rounded-md font-mono text-[11px] font-medium">
                            {skill.trigger}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSkill(skill);
                              setIsSkillModalOpen(true);
                            }}
                            className="p-1 rounded text-[#71717A] hover:text-[#18181B] hover:bg-white cursor-pointer"
                            title="编辑"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSkill(skill.id)}
                            className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                              skill.enabled ? 'bg-[#18181B]' : 'bg-[#E4E4E7]'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                                skill.enabled ? 'translate-x-3.5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          {!skill.is_builtin && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmConfig({
                                  isOpen: true,
                                  title: '删除技能',
                                  message: `确定删除技能「${skill.name}」吗？`,
                                  isDanger: true,
                                  onConfirm: () => {
                                    deleteSkill(skill.id);
                                    toast.success(`已删除技能 ${skill.name}`);
                                  },
                                });
                              }}
                              className="p-1 text-[#A1A1AA] hover:text-[#DC2626] rounded cursor-pointer"
                              title="删除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-[#71717A] leading-relaxed">{skill.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: 系统排错日志 */}
            {activeTab === 'logs' && (
              <div className="flex-1 flex flex-col p-5 overflow-hidden space-y-3 bg-white text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                  <div>
                    <h3 className="font-semibold text-sm text-[#18181B]">系统运行与排错日志</h3>
                    <p className="text-[10px] text-[#71717A] font-mono mt-0.5">{logDir || '本地日志目录'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchLogs}
                      disabled={isLoadingLogs}
                      className="px-2.5 py-1 bg-[#FAF9F6] hover:bg-white border border-black/[0.08] text-[#18181B] rounded-lg text-xs font-medium cursor-pointer"
                    >
                      刷新
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(systemLogs);
                        toast.success('已复制日志');
                      }}
                      className="px-2.5 py-1 bg-[#FAF9F6] hover:bg-white border border-black/[0.08] text-[#18181B] rounded-lg text-xs font-medium cursor-pointer"
                    >
                      复制全部
                    </button>
                    <button
                      type="button"
                      onClick={handleCleanupLogs}
                      className="px-2.5 py-1 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] rounded-lg text-xs font-medium cursor-pointer"
                    >
                      清理旧日志
                    </button>
                  </div>
                </div>

                <div className="flex-1 bg-[#18181B] text-[#E4E4E7] rounded-xl p-3 font-mono text-[11px] overflow-auto leading-relaxed select-text">
                  <pre className="whitespace-pre-wrap break-all font-mono">{systemLogs}</pre>
                </div>
              </div>
            )}

            {/* TAB 5: 外观与关于 */}
            {activeTab === 'appearance' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white text-xs">
                <div>
                  <h3 className="font-semibold text-sm text-[#18181B] mb-1">主题色彩</h3>
                  <p className="text-[11px] text-[#71717A] mb-3">选择适合长时间编程与文档阅读的工作台界面风格</p>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <div
                      onClick={() => { if (theme !== 'cream') onToggleTheme(); }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        theme === 'cream'
                          ? 'border-[#18181B] bg-[#FAF9F6] ring-1 ring-black/10 shadow-2xs'
                          : 'border-black/[0.08] bg-white hover:bg-[#FAF9F6]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs text-[#18181B] flex items-center gap-1.5">
                          <Sun className="w-3.5 h-3.5 text-[#D96B27]" /> 纸质暖色 (Cream)
                        </span>
                        {theme === 'cream' && <Check className="w-3.5 h-3.5 text-[#18181B]" />}
                      </div>
                      <p className="text-[10px] text-[#71717A]">暖瓷米白与陶土橙护眼配色</p>
                    </div>

                    <div
                      onClick={() => { if (theme !== 'dark') onToggleTheme(); }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        theme === 'dark'
                          ? 'border-[#18181B] bg-[#1C1E24] text-white ring-1 ring-black/10 shadow-2xs'
                          : 'border-black/[0.08] bg-[#18181B] text-white/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs text-white flex items-center gap-1.5">
                          <Moon className="w-3.5 h-3.5 text-[#F97316]" /> 黑曜石夜间 (Dark)
                        </span>
                        {theme === 'dark' && <Check className="w-3.5 h-3.5 text-[#F97316]" />}
                      </div>
                      <p className="text-[10px] text-white/60">低光照高对比度夜间模式</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-black/[0.06]">
                  <h3 className="font-semibold text-sm text-[#18181B] mb-1">关于与系统架构</h3>
                  <div className="p-3 bg-[#FAF9F6] rounded-xl border border-black/[0.06] space-y-1.5 max-w-lg mt-2">
                    <div className="font-semibold text-xs text-[#18181B]">Tcode Studio v2.0.0 Enterprise</div>
                    <p className="text-[11px] text-[#71717A] leading-relaxed">
                      基于 Rust 微内核与 React 19 构建的自主式智能体开发工作台，内置双环沙箱安全拦截器与多渠道模型调度流。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Claude JSON Import Modal */}
      <Dialog
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="导入 Claude Desktop MCP JSON"
        description="粘贴 claude_desktop_config.json 中的 mcpServers 节点配置"
        maxWidth="max-w-lg"
        footer={
          <>
            <button
              onClick={() => setIsImportModalOpen(false)}
              className="px-3.5 py-1.5 bg-[#FAF9F6] border border-black/[0.08] hover:bg-white rounded-lg text-xs font-medium cursor-pointer"
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
              className="px-3.5 py-1.5 bg-[#18181B] hover:bg-black text-white rounded-lg text-xs font-medium cursor-pointer"
            >
              确认导入
            </button>
          </>
        }
      >
        <textarea
          rows={7}
          value={jsonImportText}
          onChange={(e) => setJsonImportText(e.target.value)}
          placeholder={`{\n  "mcpServers": {\n    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }\n  }\n}`}
          className="w-full p-2.5 bg-[#FAF9F6] border border-black/[0.08] rounded-xl outline-none font-mono text-[11px] text-[#18181B] resize-none"
        />
      </Dialog>

      {/* Edit MCP Server Modal */}
      <McpServerModal
        isOpen={isMcpModalOpen}
        server={selectedMcpServer}
        onClose={() => {
          setIsMcpModalOpen(false);
          setSelectedMcpServer(null);
        }}
        onSave={(server) => {
          if (selectedMcpServer) {
            updateMcpServer(selectedMcpServer.id, server);
            toast.success(`已更新 MCP Server「${server.name}」`);
          } else {
            addMcpServer(server);
            toast.success(`已添加 MCP Server「${server.name}」`);
          }
          setIsMcpModalOpen(false);
          setSelectedMcpServer(null);
        }}
      />

      {/* Edit Skill Modal */}
      <SkillModal
        isOpen={isSkillModalOpen}
        skill={selectedSkill}
        onClose={() => {
          setIsSkillModalOpen(false);
          setSelectedSkill(null);
        }}
        onSave={(skill) => {
          if (selectedSkill) {
            updateSkill(selectedSkill.id, skill);
            toast.success(`已更新技能「${skill.name}」`);
          } else {
            addSkill(skill);
            toast.success(`已添加技能「${skill.name}」`);
          }
          setIsSkillModalOpen(false);
          setSelectedSkill(null);
        }}
      />

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDanger={confirmConfig.isDanger}
      />

      {/* Prompt Input Modal */}
      <PromptModal
        isOpen={promptConfig.isOpen}
        onClose={() => setPromptConfig({ ...promptConfig, isOpen: false })}
        onSubmit={promptConfig.onSubmit}
        title={promptConfig.title}
        description={promptConfig.description}
        placeholder={promptConfig.placeholder}
        defaultValue={promptConfig.defaultValue}
      />
    </div>
  );
};
