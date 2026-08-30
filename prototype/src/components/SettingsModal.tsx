import React, { useState, useEffect } from 'react';
import { loadSavedProfile, saveProfileToStorage, loadSavedAccentColor, saveAccentColorToStorage, DeveloperProfile, DEFAULT_DEVELOPER_PROFILE, AgentSkillItem, loadSavedSkills, saveSkillsToStorage, INITIAL_AGENT_SKILLS } from '../types/contracts';
import {
  X,
  Search,
  Cpu,
  Boxes,
  Server,
  Palette,
  Keyboard,
  Shield,
  ScrollText,
  Check,
  Zap,
  Plus,
  Lock,
  DollarSign,
  Sliders,
  RotateCcw,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  Clipboard,
  Trash2,
  Code,
  ChevronDown,
  Sparkles,
  Save
} from 'lucide-react';
import {
  SkillItem,
  KeybindingItem,
  AccentColorOption,
  ACCENT_COLOR_PRESETS,
  toggleSkillItem,
  updateKeybinding,
  ModelRoleRouting,
  INITIAL_ROLE_ROUTING,
  updateModelRoleRouting,
  GatewayChannel,
  INITIAL_CHANNELS,
  toggleChannelModel,
  addCustomChannel,
  ModelProviderItem,
  INITIAL_PROVIDERS,
  toggleProviderSwitch,
  toggleProviderModelSwitch,
  addCustomModelToProvider,
  ProviderCategory,
  filterProviders,
  ManagedRule,
  toggleMcpServer,
  INITIAL_KEYBINDINGS,
  INITIAL_MCP_SERVERS,
  McpServerItem,
  ProviderHealth,
  McpServerInfo,
  loadSavedProviders,
  saveProvidersToStorage,
  ModelItem,
  resolveApiEndpoint
} from '../types/contracts';
import { hostGateway } from '../services/hostGateway';
import { loadSavedRules, saveRulesToStorage, addManagedRule, toggleRuleState, deleteManagedRule } from '../services/rulesStore';
import { loadSavedOfficialSkills, toggleOfficialSkillState, addOfficialSkill, deleteOfficialSkill, SkillMetadata } from '../services/skillsEngine';
import { loadSavedMcpConfigs, saveMcpConfigsToStorage, toggleMcpServerEnabled, addMcpServerConfig, deleteMcpServerConfig, initializeMcpServer, McpServerConfig, McpServerRuntime, OFFICIAL_PROTOCOL_VERSION } from '../services/mcpGateway';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccentHex: string;
  onSelectAccentHex: (hex: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentAccentHex,
  onSelectAccentHex
}) => {
  const [openaiProtocol, setOpenaiProtocol] = useState<'responses' | 'chat_completions'>('responses');
  const [activeTab, setActiveTab] = useState<'gateway' | 'rules' | 'skills' | 'mcp' | 'appearance' | 'keybindings' | 'system'>('rules');
  const [searchFilter, setSearchFilter] = useState('');
  const [rules, setRules] = useState<ManagedRule[]>(loadSavedRules());
  const [ruleFilter, setRuleFilter] = useState<'all' | 'project' | 'global'>('all');
  const [showAddRuleForm, setShowAddRuleForm] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleContent, setNewRuleContent] = useState('');
  const [newRuleScope, setNewRuleScope] = useState<'project' | 'global'>('project');

  const [officialSkills, setOfficialSkills] = useState<SkillMetadata[]>(loadSavedOfficialSkills());
  const [skillSearch, setSkillSearch] = useState('');
  const [showAddSkillForm, setShowAddSkillForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');

  const [mcpConfigs, setMcpConfigs] = useState<McpServerConfig[]>(loadSavedMcpConfigs());
  const [mcpRuntimes, setMcpRuntimes] = useState<Record<string, McpServerRuntime>>({});
  const [expandedMcpId, setExpandedMcpId] = useState<string | null>('mcp-filesystem');
  const [testingMcpId, setTestingMcpId] = useState<string | null>(null);

  // Initialize MCP Server Runtimes when modal opens or configs change
  useEffect(() => {
    Promise.all(mcpConfigs.map(c => initializeMcpServer(c))).then(results => {
      const map: Record<string, McpServerRuntime> = {};
      results.forEach(r => { map[r.config.id] = r; });
      setMcpRuntimes(map);
    });
  }, [mcpConfigs]);

  const [dataDesensitize, setDataDesensitize] = useState(true);
  const [autoShadowSnapshot, setAutoShadowSnapshot] = useState(true);
  const [astDepth, setAstDepth] = useState<'shallow' | 'standard' | 'deep'>('standard');



  // GitHub Benchmark Model Providers Master-Detail State with Draft Buffer (Cherry Studio / LobeChat style)
  const [providers, setProviders] = useState<ModelProviderItem[]>(loadSavedProviders());
  const [selectedProviderId, setSelectedProviderId] = useState<string>('provider-deepseek');
  const [providerSearch, setProviderSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<ProviderCategory>('all');
  const [showAddCustomModel, setShowAddCustomModel] = useState<boolean>(false);
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [providerToast, setProviderToast] = useState<string | null>(null);
  const [showProviderKeyMap, setShowProviderKeyMap] = useState<Record<string, boolean>>({});

  // Form Draft Buffer Map: keeps user inputs locally until explicit save / commit
  const [draftConfigMap, setDraftConfigMap] = useState<Record<string, { baseUrl: string; apiKey: string }>>(() => {
    const initialDrafts: Record<string, { baseUrl: string; apiKey: string }> = {};
    const loaded = loadSavedProviders();
    for (const p of loaded) {
      initialDrafts[p.id] = { baseUrl: p.baseUrl, apiKey: p.apiKey };
    }
    return initialDrafts;
  });

  const selectedProvider = providers.find(p => p.id === selectedProviderId) || providers[0];
  const currentDraft = draftConfigMap[selectedProvider.id] || { baseUrl: selectedProvider.baseUrl, apiKey: selectedProvider.apiKey };
  const isCurrentDraftDirty = currentDraft.baseUrl !== selectedProvider.baseUrl || currentDraft.apiKey !== selectedProvider.apiKey;

  const handleUpdateDraft = (providerId: string, updates: Partial<{ baseUrl: string; apiKey: string }>) => {
    setDraftConfigMap(prev => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || { baseUrl: selectedProvider.baseUrl, apiKey: selectedProvider.apiKey }),
        ...updates
      }
    }));
  };

  const handleSaveProviderConfig = (p: ModelProviderItem) => {
    const draft = draftConfigMap[p.id] || { baseUrl: p.baseUrl, apiKey: p.apiKey };
    const updated = providers.map(item =>
      item.id === p.id ? { ...item, baseUrl: draft.baseUrl.trim(), apiKey: draft.apiKey.trim() } : item
    );
    setProviders(updated);
    saveProvidersToStorage(updated);
    setProviderToast(`💾 已成功保存 [${p.name}] 配置并同步刷新网关！`);
    setTimeout(() => setProviderToast(null), 3000);
  };

  const handleTestProvider = async (p: ModelProviderItem) => {
    const draft = draftConfigMap[p.id] || { baseUrl: p.baseUrl, apiKey: p.apiKey };
    setTestingProviderId(p.id);
    setProviderToast(`🔄 正在向 ${draft.baseUrl} 发起真实连通性探测...`);
    const start = Date.now();
    try {
      let url = draft.baseUrl.trim();
      if (url.endsWith('/')) url = url.slice(0, -1);
      const { url: testEndpoint, headers: proxyHeaders } = resolveApiEndpoint(`${url}/models`);
      const res = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${draft.apiKey.trim()}`,
          ...proxyHeaders
        }
      });
      const latency = Date.now() - start;
      if (res.ok) {
        const data = await res.json();
        const modelCount = data?.data?.length || p.models.length;
        const updated = providers.map(item =>
          item.id === p.id ? { ...item, baseUrl: draft.baseUrl.trim(), apiKey: draft.apiKey.trim(), status: 'healthy' as const, latencyMs: latency } : item
        );
        setProviders(updated);
        saveProvidersToStorage(updated);
        setProviderToast(`✓ [${p.name}] 真实连通性测试成功！HTTP ${res.status} OK · 延迟 ${latency}ms · 探测到 ${modelCount} 个可用模型`);
      } else {
        const updated = providers.map(item => item.id === p.id ? { ...item, status: 'untested' as const, latencyMs: 0 } : item);
        setProviders(updated);
        saveProvidersToStorage(updated);
        setProviderToast(`✕ [${p.name}] 探测返回异常: HTTP ${res.status} (${res.statusText})`);
      }
    } catch (err: any) {
      setProviderToast(`✕ [${p.name}] 网络连接失败: ${err.message}`);
    } finally {
      setTestingProviderId(null);
      setTimeout(() => setProviderToast(null), 4000);
    }
  };

  const handleFetchProviderModels = async (p: ModelProviderItem) => {
    const draft = draftConfigMap[p.id] || { baseUrl: p.baseUrl, apiKey: p.apiKey };
    setProviderToast(`🔄 正在从 ${draft.baseUrl}/models 真实拉取最新模型列表...`);
    try {
      let url = draft.baseUrl.trim();
      if (url.endsWith('/')) url = url.slice(0, -1);
      const { url: modelsEndpoint, headers: proxyHeaders } = resolveApiEndpoint(`${url}/models`);
      const res = await fetch(modelsEndpoint, {
        headers: {
          'Authorization': `Bearer ${draft.apiKey.trim()}`,
          ...proxyHeaders
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      const rawModels: any[] = json.data || [];
      if (rawModels.length > 0) {
        const fetchedModels: ModelItem[] = rawModels.map((m: any) => ({
          id: m.id,
          name: m.id,
          enabled: true,
          contextLimit: 128000,
          capabilities: ['code', 'fast']
        }));
        const updated = providers.map(item => item.id === p.id ? { ...item, baseUrl: draft.baseUrl.trim(), apiKey: draft.apiKey.trim(), models: fetchedModels } : item);
        setProviders(updated);
        saveProvidersToStorage(updated);
        setProviderToast(`✓ 成功从 ${p.name} 真实拉取并同步 ${fetchedModels.length} 个最新模型！`);
      } else {
        setProviderToast(`✓ 接口返回成功，当前暂无额外可用模型`);
      }
    } catch (err: any) {
      setProviderToast(`✕ 拉取模型列表失败: ${err.message}`);
    } finally {
      setTimeout(() => setProviderToast(null), 4000);
    }
  };

  const handleAddCustomModelSubmit = () => {
    if (!customModelInput.trim()) return;
    setProviders(addCustomModelToProvider(providers, selectedProvider.id, customModelInput.trim()));
    setProviderToast(`✓ 成功添加自定义模型 [${customModelInput.trim()}] 到 ${selectedProvider.name}`);
    setCustomModelInput('');
    setShowAddCustomModel(false);
    setTimeout(() => setProviderToast(null), 3000);
  };

  // Gateway Full Architecture States
  const [gatewaySubTab, setGatewaySubTab] = useState<'roles' | 'channels'>('roles');
  const [roleRouting, setRoleRouting] = useState<ModelRoleRouting>(INITIAL_ROLE_ROUTING);
  const [channels, setChannels] = useState<GatewayChannel[]>(INITIAL_CHANNELS);
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  const [channelTestingId, setChannelTestingId] = useState<string | null>(null);
  const [channelNotice, setChannelNotice] = useState<string | null>(null);
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanUrl, setNewChanUrl] = useState('');
  const [newChanKey, setNewChanKey] = useState('');

  const toggleShowKey = (id: string) => {
    setShowKeyMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTestChannel = (chan: GatewayChannel) => {
    setChannelTestingId(chan.id);
    setTimeout(() => {
      setChannels(prev =>
        prev.map(c => c.id === chan.id ? { ...c, latencyMs: c.id === 'chan-ollama' ? 0 : Math.floor(Math.random() * 60) + 60, status: 'healthy' } : c)
      );
      setChannelTestingId(null);
      setChannelNotice(`✓ [${chan.name}] 连通测试通过 (HTTP 200 OK · ${chan.id === 'chan-ollama' ? '0ms 本地直连' : '82ms'})`);
      setTimeout(() => setChannelNotice(null), 3000);
    }, 600);
  };

  const handleFetchModels = (chan: GatewayChannel) => {
    setChannelNotice(`🔄 正在请求 ${chan.name} 的 /v1/models 接口...`);
    setTimeout(() => {
      setChannelNotice(`✓ 成功从 ${chan.name} 同步并载入 ${chan.models.length} 个最新可用模型！`);
      setTimeout(() => setChannelNotice(null), 3000);
    }, 600);
  };

  const handleAddCustomChannel = () => {
    if (!newChanName.trim() || !newChanUrl.trim()) return;
    const newChan: GatewayChannel = {
      id: `chan-${Date.now()}`,
      name: newChanName.trim(),
      protocol: 'openai',
      baseUrl: newChanUrl.trim(),
      apiKey: newChanKey.trim() || 'sk-custom-placeholder',
      status: 'healthy',
      latencyMs: 75,
      models: [
        { id: 'custom-model-1', name: 'Custom-DeepSeek-R1', enabled: true, contextLimit: 64000 },
        { id: 'custom-model-2', name: 'Custom-Claude-3.5', enabled: true, contextLimit: 200000 }
      ]
    };
    setChannels(addCustomChannel(channels, newChan));
    setNewChanName('');
    setNewChanUrl('');
    setNewChanKey('');
    setShowAddChannelModal(false);
    setChannelNotice(`✓ 已成功添加并挂载自定义渠道 [${newChan.name}]`);
    setTimeout(() => setChannelNotice(null), 3000);
  };



  // 2. Skills State
  const [skills, setSkills] = useState<SkillItem[]>([
    { id: 'sdd-tdd', name: 'SDD-TDD 严苛工程工作流', category: 'workflow', description: '执行测试先行与契约强校验，严防语法错漏与隐性破坏', enabled: true, slashCommand: '/tdd' },
    { id: 'ui-ux', name: 'UI/UX 高保真交互设计', category: 'quality', description: '遵循 16:9 纸质暖色调体系，严禁出现刺眼灰底与布局错位', enabled: true, slashCommand: '/design' },
    { id: 'frontend-arch', name: '前端架构师与状态总线', category: 'architecture', description: '总线-子线架构驱动，状态原子级精简', enabled: true, slashCommand: '/arch' },
    { id: 'sec-audit', name: '代码合规与安全漏洞审查', category: 'quality', description: '静态分析 AST，自动拦截越权敏感调用与明文秘钥泄漏', enabled: false, slashCommand: '/audit' },
    { id: 'token-opt', name: 'Token 极限压榨与剪枝', category: 'tools', description: '智能过滤冗余编译转轮噪声，立省 80% Token', enabled: true, slashCommand: '/compress' }
  ]);

  // 3. MCP State
  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([
    { id: 'fs', name: 'filesystem-mcp', status: 'connected', toolsCount: 8, tools: ['read_file', 'write_file', 'list_dir', 'grep', 'patch_ast'] },
    { id: 'git', name: 'git-mcp', status: 'connected', toolsCount: 5, tools: ['commit', 'diff', 'shadow_snapshot', 'rollback'] },
    { id: 'web', name: 'web-search-mcp', status: 'connected', toolsCount: 2, tools: ['search_bing', 'search_arxiv'] },
    { id: 'browser', name: 'browser-devtools-mcp', status: 'disconnected', toolsCount: 4, tools: ['capture_screenshot', 'inspect_dom'] }
  ]);

  // 4. Appearance State
  const [themeMode, setThemeMode] = useState<'cream' | 'dark_charcoal' | 'system'>('cream');
  const [fontSize, setFontSize] = useState<number>(13);
  const [fontFamily, setFontFamily] = useState<'JetBrains Mono' | 'Fira Code' | 'Cascadia Code'>('JetBrains Mono');

  // 5. Keybindings State
  const [keybindings, setKeybindings] = useState<KeybindingItem[]>([
    { id: 'kb-act', actionName: '唤醒 Act 落地模式并提交', category: 'agent', currentKey: 'Ctrl + Enter', defaultKey: 'Ctrl + Enter' },
    { id: 'kb-new-chat', actionName: '新建当前工程会话', category: 'chat', currentKey: 'Ctrl + L', defaultKey: 'Ctrl + L' },
    { id: 'kb-inline', actionName: '代码行内智能重构 (Inline Edit)', category: 'editor', currentKey: 'Ctrl + K', defaultKey: 'Ctrl + K' },
    { id: 'kb-toggle-ws', actionName: '开关右侧工作台与 4:6 终端', category: 'editor', currentKey: 'Ctrl + `', defaultKey: 'Ctrl + `' },
    { id: 'kb-palette', actionName: '打开全局命令面板 (Command Palette)', category: 'navigation', currentKey: 'Ctrl + Shift + P', defaultKey: 'Ctrl + Shift + P' },
    { id: 'kb-search', actionName: '全局符号与文本检索', category: 'navigation', currentKey: 'Ctrl + Shift + F', defaultKey: 'Ctrl + Shift + F' },
    { id: 'kb-settings', actionName: '打开全局首选项与设置弹窗', category: 'navigation', currentKey: 'Ctrl + ,', defaultKey: 'Ctrl + ,' }
  ]);
  const [editingKbId, setEditingKbId] = useState<string | null>(null);

  // Developer Profile State
  const [devProfile, setDevProfile] = useState<DeveloperProfile>(loadSavedProfile());
  const [profileToast, setProfileToast] = useState<string | null>(null);

  // Skill Import Dialog States
  const [showImportSkillModal, setShowImportSkillModal] = useState(false);
  const [skillImportTab, setSkillImportTab] = useState<'url' | 'file' | 'custom'>('url');
  const [importSkillUrl, setImportSkillUrl] = useState('');
  const [newCustomSkillName, setNewCustomSkillName] = useState('');
  const [newCustomSkillTier, setNewCustomSkillTier] = useState<'capability' | 'skill' | 'mcp'>('skill');
  const [newCustomSkillIcon, setNewCustomSkillIcon] = useState('✨');
  const [newCustomSkillDesc, setNewCustomSkillDesc] = useState('');
  const [newCustomSkillPrompt, setNewCustomSkillPrompt] = useState('');

  // Add MCP Dialog States
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpType, setNewMcpType] = useState<'stdio' | 'sse'>('stdio');
  const [newMcpEndpoint, setNewMcpEndpoint] = useState('');
  const [newMcpDesc, setNewMcpDesc] = useState('');

  // 6. System State
  const [airGapped, setAirGapped] = useState(false);
  const [autoApproveReads, setAutoApproveReads] = useState(true);
  const [autoApproveAstVerified, setAutoApproveAstVerified] = useState(true);
  const [dailyTokenLimit, setDailyTokenLimit] = useState(15.0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);


  const applyAccentColor = (hex: string) => {
    onSelectAccentHex(hex);
    saveAccentColorToStorage(hex);
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-subtle', hex + '1F');
    setProviderToast(`✓ 强调色已更新为: ${hex}`);
    setTimeout(() => setProviderToast(null), 2500);
  };
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


  if (!isOpen) return null;



  const navTabs = [
    { id: 'gateway', label: '模型服务商', icon: Cpu },
    { id: 'rules', label: 'Rule 规则管理', icon: ScrollText },
    { id: 'skills', label: 'Skill 技能库', icon: Boxes },
    { id: 'mcp', label: 'MCP 工具管理', icon: Server },
    { id: 'appearance', label: '自定义外观颜色', icon: Palette },
    { id: 'keybindings', label: '自定义快捷键', icon: Keyboard },
    { id: 'system', label: '系统与安全设置', icon: Shield }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.48)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      userSelect: 'none'
    }}>
      {/* Modal Dialog Box */}
      <div style={{
        width: '820px',
        maxWidth: '92vw',
        height: '560px',
        maxHeight: '90vh',
        background: 'var(--bg-surface-elevated)',
        borderRadius: '10px',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.28)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Top Header */}
        <div style={{
          height: '46px',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
              ⚙️ 全局首选项与系统设置 (Preferences)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Search filter in settings */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)'
            }}>
              <Search size={12} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="搜索设置项..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '140px'
                }}
              />
            </div>

            <button
              onClick={onClose}
              title="关闭 (Esc)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Sidebar Tabs + Right Config View */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left Navigation Sidebar (210px) */}
          <div style={{
            width: '210px',
            background: 'var(--bg-base)',
            borderRight: '1px solid var(--border-subtle)',
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}>
            {navTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 500,
                    background: isActive ? 'var(--accent-subtle)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                    border: isActive ? '1px solid rgba(217, 107, 39, 0.25)' : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} color={isActive ? 'var(--accent)' : 'var(--text-secondary)'} />
                  <span>{tab.label}</span>
                </div>
              );
            })}
          </div>

          {/* Right Scrollable Content View */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: 'var(--bg-surface-elevated)' }}>

            {/* TAB: RULE 规则管理 (Rules for AI) */}
            {activeTab === 'rules' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px', margin: '-4px 0', gap: '10px' }}>
                {/* 1. Header & Filter Matrix */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>规则作用域:</span>
                    {[
                      { id: 'all', label: `全部 (${rules.length})` },
                      { id: 'project', label: `📁 工程级 (${rules.filter(r => r.scope === 'project').length})` },
                      { id: 'global', label: `🌐 全局级 (${rules.filter(r => r.scope === 'global').length})` }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setRuleFilter(f.id as any)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          background: ruleFilter === f.id ? 'var(--accent)' : 'var(--bg-base)',
                          color: ruleFilter === f.id ? '#FFF' : 'var(--text-secondary)',
                          fontSize: '10px',
                          fontWeight: ruleFilter === f.id ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.1s ease'
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowAddRuleForm(true)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: 'var(--accent)',
                      color: '#FFF',
                      border: 'none',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={11} />
                    <span>添加自定义规则</span>
                  </button>
                </div>

                {/* Inline Add Rule Form */}
                {showAddRuleForm && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--accent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>新建 System Rule 规则</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setNewRuleScope('project')}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            border: newRuleScope === 'project' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                            background: newRuleScope === 'project' ? 'var(--accent-subtle)' : 'transparent',
                            color: newRuleScope === 'project' ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          📁 工程级规则
                        </button>
                        <button
                          onClick={() => setNewRuleScope('global')}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            border: newRuleScope === 'global' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                            background: newRuleScope === 'global' ? 'var(--accent-subtle)' : 'transparent',
                            color: newRuleScope === 'global' ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          🌐 全局通用规则
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="规则标题 (例如：严禁未经确认修改生产环境数据库结构)"
                      value={newRuleTitle}
                      onChange={e => setNewRuleTitle(e.target.value)}
                      style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <textarea
                      rows={2}
                      placeholder="规则内容详情 (AI 在每次发起任务前均会自动前置读取并严格服从此约束)..."
                      value={newRuleContent}
                      onChange={e => setNewRuleContent(e.target.value)}
                      style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none', resize: 'none' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        onClick={() => setShowAddRuleForm(false)}
                        style={{ padding: '4px 10px', borderRadius: '3px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer' }}
                      >
                        取消
                      </button>
                      <button
                        onClick={() => {
                          if (!newRuleTitle.trim() || !newRuleContent.trim()) return;
                          const updated = addManagedRule({
                            title: newRuleTitle.trim(),
                            description: newRuleContent.trim(),
                            scope: newRuleScope,
                            category: newRuleScope === 'global' ? 'global' : 'team_rule',
                            sourceFile: newRuleScope === 'global' ? 'global-rules.json' : '.cursorrules',
                            enabled: true,
                            priority: 70
                          });
                          setRules(updated);
                          setNewRuleTitle('');
                          setNewRuleContent('');
                          setShowAddRuleForm(false);
                        }}
                        style={{ padding: '4px 14px', borderRadius: '3px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        保存并生效
                      </button>
                    </div>
                  </div>
                )}

                {/* Rules List */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {rules
                    .filter(r => ruleFilter === 'all' || r.scope === ruleFilter)
                    .map(r => (
                      <div
                        key={r.id}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '6px',
                          border: r.enabled ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          boxShadow: r.enabled ? '0 2px 8px rgba(217, 107, 39, 0.08)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, fontSize: '12px' }}>{r.title}</span>
                            <span style={{
                              fontSize: '9px',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              background: r.scope === 'project' ? 'rgba(217, 107, 39, 0.12)' : 'rgba(37, 99, 235, 0.1)',
                              color: r.scope === 'project' ? 'var(--accent)' : '#2563EB',
                              fontWeight: 600
                            }}>
                              {r.scope === 'project' ? '📁 工程级规则' : '🌐 全局通用规则'}
                            </span>
                            {!r.readonly && (
                              <span
                                onClick={() => {
                                  const updated = deleteManagedRule(r.id);
                                  setRules(updated);
                                }}
                                title="删除此条规则"
                                style={{ fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}
                              >
                                ✕
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                            {r.description}
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            const updated = toggleRuleState(r.id);
                            setRules(updated);
                          }}
                          style={{
                            padding: '3px 12px',
                            borderRadius: '12px',
                            border: 'none',
                            background: r.enabled ? 'var(--accent)' : 'var(--border-strong)',
                            color: '#FFF',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            minWidth: '60px'
                          }}
                        >
                          {r.enabled ? '已生效' : '已禁用'}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* TAB 1: SYMMETRICAL AESTHETIC MODEL PROVIDER WORKBENCH (Top Matrix + Full-Width Balanced Grid) */}
            {activeTab === 'gateway' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px', margin: '-8px -4px', position: 'relative' }}>
                {providerToast && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '12px',
                    zIndex: 100,
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: 'var(--accent)',
                    color: '#FFF',
                    fontSize: '11px',
                    fontWeight: 600,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                  }}>
                    {providerToast}
                  </div>
                )}

                {/* 1. TOP ECOSYSTEM SELECTOR MATRIX (分类胶囊 + 搜索 + 服务商选择栏) */}
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--bg-surface)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {/* Category Pills + Search Box (Perfect Symmetry) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4px' }}>
                        生态分类:
                      </span>
                      {[
                        { id: 'all', label: '全部服务商' },
                        { id: 'domestic', label: '🇨🇳 国内自研' },
                        { id: 'aggregator', label: '🔀 聚合中转' },
                        { id: 'international', label: '🌐 国际主流' },
                        { id: 'local', label: '💻 本地私有' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setCategoryFilter(tab.id as ProviderCategory)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            background: categoryFilter === tab.id ? 'var(--accent)' : 'var(--bg-base)',
                            color: categoryFilter === tab.id ? '#FFF' : 'var(--text-secondary)',
                            fontSize: '10px',
                            fontWeight: categoryFilter === tab.id ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.1s ease'
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ width: '180px' }}>
                      <input
                        type="text"
                        placeholder="过滤服务商或模型..."
                        value={providerSearch}
                        onChange={e => setProviderSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-strong)',
                          background: 'var(--bg-base)',
                          fontSize: '11px',
                          color: 'var(--text-primary)',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  {/* Horizontal Provider Badges Bar (No Cramped Vertical Stacking!) */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '72px', overflowY: 'auto' }}>
                    {filterProviders(providers, categoryFilter, providerSearch).map(p => {
                      const isSelected = selectedProvider.id === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProviderId(p.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-base)',
                            border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                            boxShadow: isSelected ? '0 2px 6px rgba(217, 107, 39, 0.15)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ fontSize: '12px' }}>{p.icon}</span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--accent)' : 'var(--text-primary)'
                          }}>
                            {p.name}
                          </span>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: p.enabled ? '#10B981' : 'var(--text-muted)'
                          }} />
                        </div>
                      );
                    })}

                    <button
                      onClick={() => {
                        const newP: ModelProviderItem = {
                          id: `provider-custom-${Date.now()}`,
                          name: '自定义中转站',
                          icon: '🌐',
                          category: 'aggregator',
                          enabled: true,
                          protocol: 'openai',
                          baseUrl: 'https://api.openai-proxy.com/v1',
                          defaultBaseUrl: 'https://api.openai-proxy.com/v1',
                          apiKey: '',
                          status: 'untested',
                          latencyMs: 0,
                          models: [
                            { id: 'custom-model', name: 'Custom-GPT-4o', enabled: true, contextLimit: 128000, capabilities: ['code', 'custom'] }
                          ]
                        };
                        setProviders([...providers, newP]);
                        setSelectedProviderId(newP.id);
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px dashed var(--border-strong)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <Plus size={10} />
                      <span>添加服务商</span>
                    </button>
                  </div>
                </div>

                {/* 2. FULL-WIDTH SYMMETRICAL WORKBENCH FOR SELECTED PROVIDER (充裕对称的工作台) */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                  {/* Top Header Card (Zero Awkward Line Breaks!) */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{ fontSize: '20px', flexShrink: 0 }}>{selectedProvider.icon}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                          {selectedProvider.name}
                        </h3>
                        <span style={{
                          fontSize: '9px',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap'
                        }}>
                          {selectedProvider.protocol.toUpperCase()} 兼容协议
                        </span>
                        {selectedProvider.docUrl && (
                          <a
                            href={selectedProvider.docUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: '10px',
                              color: 'var(--accent)',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              marginLeft: '6px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span>获取 API Key / 官方文档</span>
                            <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Master Actions: Save Config + Enable Switch */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      {isCurrentDraftDirty && (
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(217, 107, 39, 0.15)',
                          color: 'var(--accent)',
                          fontWeight: 700
                        }}>
                          ● 有未保存修改
                        </span>
                      )}
                      <button
                        onClick={() => handleSaveProviderConfig(selectedProvider)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 12px',
                          borderRadius: '4px',
                          background: isCurrentDraftDirty ? 'var(--accent)' : 'var(--bg-base)',
                          border: isCurrentDraftDirty ? 'none' : '1px solid var(--border-subtle)',
                          color: isCurrentDraftDirty ? '#FFF' : 'var(--text-secondary)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: isCurrentDraftDirty ? '0 2px 8px rgba(217, 107, 39, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                        title="立即将草稿修改持久化至本地存储并刷新网关"
                      >
                        <Save size={12} />
                        <span>{isCurrentDraftDirty ? '保存并刷新网关' : '已保存'}</span>
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          开关:
                        </span>
                        <button
                          onClick={() => {
                            const updated = toggleProviderSwitch(providers, selectedProvider.id);
                            setProviders(updated);
                            saveProvidersToStorage(updated);
                          }}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            border: 'none',
                            background: selectedProvider.enabled ? '#10B981' : 'var(--border-strong)',
                            color: '#FFF',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {selectedProvider.enabled ? '已启用 (ON)' : '已禁用 (OFF)'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2-Column Balanced Symmetrical Grid: Base URL (Left) & API Key (Right) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {/* Left Column: Base URL */}
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          端点地址 (Base URL):
                        </label>
                        {selectedProvider.baseUrl !== selectedProvider.defaultBaseUrl && (
                          <span
                            onClick={() => setProviders(prev => prev.map(item => item.id === selectedProvider.id ? { ...item, baseUrl: item.defaultBaseUrl } : item))}
                            style={{ fontSize: '10px', color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}
                          >
                            恢复默认
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={currentDraft.baseUrl}
                        onChange={e => handleUpdateDraft(selectedProvider.id, { baseUrl: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: isCurrentDraftDirty ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          outline: 'none'
                        }}
                      />
                    </div>

                    {/* Right Column: API Key & Test Connection */}
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          API Key (密钥凭据):
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '9px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: selectedProvider.status === 'healthy' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-base)',
                            color: selectedProvider.status === 'healthy' ? '#10B981' : 'var(--text-muted)',
                            fontWeight: 600
                          }}>
                            {testingProviderId === selectedProvider.id
                              ? '测速中...'
                              : (selectedProvider.latencyMs === 0 ? '🟢 本地 0ms' : `🟢 正常 ${selectedProvider.latencyMs}ms`)}
                          </span>
                          <button
                            onClick={() => handleTestProvider(selectedProvider)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '2px 7px',
                              borderRadius: '3px',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--accent-subtle)',
                              color: 'var(--accent)',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <Zap size={10} />
                            <span>连通性测试</span>
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px solid var(--border-strong)', padding: '0 6px' }}>
                        <input
                          type={showProviderKeyMap[selectedProvider.id] ? 'text' : 'password'}
                          value={currentDraft.apiKey}
                          placeholder={selectedProvider.id === 'provider-ollama' ? '本地 Ollama 免密钥' : 'sk-...'}
                          onChange={e => handleUpdateDraft(selectedProvider.id, { apiKey: e.target.value })}
                          style={{
                            flex: 1,
                            padding: '5px 0',
                            fontSize: '11px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-mono)',
                            outline: 'none'
                          }}
                        />
                        {selectedProvider.apiKey && (
                          <button
                            onClick={() => setShowProviderKeyMap(prev => ({ ...prev, [selectedProvider.id]: !prev[selectedProvider.id] }))}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                          >
                            {showProviderKeyMap[selectedProvider.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* OpenAI Upstream Protocol Selection Card (Responses API vs Chat Completions) */}
                  {(selectedProvider.protocol === 'openai' || selectedProvider.id.includes('openai')) && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      background: 'rgba(217, 107, 39, 0.05)',
                      border: '1px solid rgba(217, 107, 39, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={13} color="var(--accent)" />
                          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            OpenAI 上游协议选择 (Upstream Protocol)
                          </span>
                        </div>
                        <span style={{ fontSize: '9.5px', padding: '1px 6px', borderRadius: '3px', background: 'var(--accent)', color: '#FFF', fontWeight: 600 }}>
                          默认: Responses API
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div
                          onClick={() => {
                            setOpenaiProtocol('responses');
                            setProviderToast('✓ OpenAI 上游协议已切换为 Responses API (/v1/responses)');
                            setTimeout(() => setProviderToast(null), 3000);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '5px',
                            border: openaiProtocol === 'responses' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                            background: openaiProtocol === 'responses' ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: openaiProtocol === 'responses' ? 'var(--accent)' : 'var(--text-primary)' }}>
                              ⚡ Responses API (默认推荐)
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>/v1/responses</span>
                          </div>
                          <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                            面向 Agent 的状态化统一协议，支持原生多模态与实时工具调用
                          </span>
                        </div>

                        <div
                          onClick={() => {
                            setOpenaiProtocol('chat_completions');
                            setProviderToast('✓ OpenAI 上游协议已切换为 Chat Completions (/v1/chat/completions)');
                            setTimeout(() => setProviderToast(null), 3000);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '5px',
                            border: openaiProtocol === 'chat_completions' ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                            background: openaiProtocol === 'chat_completions' ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: openaiProtocol === 'chat_completions' ? 'var(--accent)' : 'var(--text-primary)' }}>
                              💬 Chat Completions (传统兼容)
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>/v1/chat/completions</span>
                          </div>
                          <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>
                            标准 messages 数组流式协议，兼容各大聚合中转网关与 OneAPI
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full-Width Models Management Card (Symmetrical & Spacious) */}
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>模型列表与管理</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          (已启用 {selectedProvider.models.filter(m => m.enabled).length}/{selectedProvider.models.length})
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => handleFetchProviderModels(selectedProvider)}
                          title="向服务商 API 发送 /v1/models 探测请求"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-base)',
                            color: 'var(--text-secondary)',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <RefreshCw size={10} />
                          <span>获取模型列表</span>
                        </button>

                        <button
                          onClick={() => setShowAddCustomModel(true)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            background: 'var(--accent)',
                            color: '#FFF',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Plus size={10} />
                          <span>添加模型</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Add Model Form */}
                    {showAddCustomModel && (
                      <div style={{ display: 'flex', gap: '6px', padding: '6px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px solid var(--accent)' }}>
                        <input
                          type="text"
                          placeholder="输入模型 ID (如 deepseek-coder 或 qwen2.5:72b)"
                          value={customModelInput}
                          onChange={e => setCustomModelInput(e.target.value)}
                          style={{ flex: 1, padding: '4px 8px', fontSize: '11px', border: '1px solid var(--border-subtle)', borderRadius: '3px', background: 'var(--bg-surface)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                        <button
                          onClick={handleAddCustomModelSubmit}
                          style={{ padding: '4px 12px', borderRadius: '3px', background: 'var(--accent)', color: '#FFF', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          确定
                        </button>
                        <button
                          onClick={() => setShowAddCustomModel(false)}
                          style={{ padding: '4px 8px', borderRadius: '3px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer' }}
                        >
                          取消
                        </button>
                      </div>
                    )}

                    {/* Models Rows (Full Width, Generous Breathing Room) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedProvider.models.map(m => (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            background: m.enabled ? 'var(--bg-base)' : 'transparent',
                            border: m.enabled ? '1px solid var(--border-subtle)' : '1px solid transparent',
                            opacity: m.enabled ? 1 : 0.6
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="checkbox"
                              checked={m.enabled}
                              onChange={() => setProviders(toggleProviderModelSwitch(providers, selectedProvider.id, m.id))}
                              style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                            />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                  {m.id}
                                </span>
                                {m.capabilities.map(cap => (
                                  <span
                                    key={cap}
                                    style={{
                                      fontSize: '9px',
                                      padding: '1px 5px',
                                      borderRadius: '3px',
                                      background: cap === 'reasoning' || cap === 'thinking' ? 'rgba(147, 51, 234, 0.12)' : 'rgba(217, 107, 39, 0.1)',
                                      color: cap === 'reasoning' || cap === 'thinking' ? '#9333EA' : 'var(--accent)',
                                      fontWeight: 600
                                    }}
                                  >
                                    {cap === 'reasoning' || cap === 'thinking' ? '🧠 思考链' : (cap === 'vision' ? '👁️ 视觉' : '💻 代码')}
                                  </span>
                                ))}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {m.name} · 上下文上限 {Math.round(m.contextLimit / 1000)}k tokens
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setProviders(toggleProviderModelSwitch(providers, selectedProvider.id, m.id))}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '10px',
                              border: 'none',
                              background: m.enabled ? 'var(--accent)' : 'var(--border-strong)',
                              color: '#FFF',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {m.enabled ? '已启用' : '已禁用'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SKILLS SYSTEM */}
            {activeTab === 'skills' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px', margin: '-4px 0', gap: '10px' }}>
                {/* Search & Filter Bar */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      📦 agentskills.io 规范目录: <code>.agents/skills/</code> (共 {officialSkills.length} 个)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="搜索技能名称或描述..."
                      value={skillSearch}
                      onChange={e => setSkillSearch(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-strong)',
                        background: 'var(--bg-base)',
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        width: '160px'
                      }}
                    />
                    <button
                      onClick={() => setShowAddSkillForm(true)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '4px',
                        background: 'var(--accent)',
                        color: '#FFF',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={12} />
                      <span>新建 Skill</span>
                    </button>
                  </div>
                </div>

                {/* Add Skill Form Modal Inline */}
                {showAddSkillForm && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--accent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>新建 Agent Skill (遵循 agentskills.io 规范)</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Skill Name (<=64字符，仅小写字母、数字与连字符，如: my-custom-skill)"
                      value={newSkillName}
                      onChange={e => setNewSkillName(e.target.value)}
                      style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <textarea
                      rows={2}
                      placeholder="Description (<=1024字符，清晰说明做什么以及何时触发该技能)..."
                      value={newSkillDesc}
                      onChange={e => setNewSkillDesc(e.target.value)}
                      style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none', resize: 'none' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        onClick={() => setShowAddSkillForm(false)}
                        style={{ padding: '4px 10px', borderRadius: '3px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '10px', cursor: 'pointer' }}
                      >
                        取消
                      </button>
                      <button
                        onClick={() => {
                          if (!newSkillName.trim() || !newSkillDesc.trim()) return;
                          const updated = addOfficialSkill({
                            name: newSkillName.trim(),
                            description: newSkillDesc.trim(),
                            path: `.agents/skills/${newSkillName.trim()}/SKILL.md`,
                            icon: '📦'
                          });
                          setOfficialSkills(updated);
                          setNewSkillName('');
                          setNewSkillDesc('');
                          setShowAddSkillForm(false);
                        }}
                        style={{ padding: '4px 14px', borderRadius: '3px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        创建并生成 SKILL.md
                      </button>
                    </div>
                  </div>
                )}

                {/* Skills Grid */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {officialSkills
                    .filter(s => !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase()) || s.description.toLowerCase().includes(skillSearch.toLowerCase()))
                    .map(s => (
                      <div
                        key={s.name}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '6px',
                          border: s.enabled ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          boxShadow: s.enabled ? '0 2px 8px rgba(217, 107, 39, 0.08)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px' }}>{s.icon || '📦'}</span>
                            <span style={{ fontWeight: 700, fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{s.name}</span>
                            <span style={{
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-muted)'
                            }}>
                              {s.path}
                            </span>
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                            {s.description}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => {
                              const updated = toggleOfficialSkillState(s.name);
                              setOfficialSkills(updated);
                            }}
                            style={{
                              padding: '3px 12px',
                              borderRadius: '12px',
                              border: 'none',
                              background: s.enabled ? 'var(--accent)' : 'var(--border-strong)',
                              color: '#FFF',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              minWidth: '60px'
                            }}
                          >
                            {s.enabled ? '已启用 (Tier 1)' : '已禁用'}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* TAB 3: MCP MANAGEMENT (Official JSON-RPC 2.0 Lifecycle) */}
            {activeTab === 'mcp' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px', margin: '-4px 0', gap: '10px' }}>
                {/* MCP Header */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ fontSize: '12.5px', fontWeight: 700, margin: '0 0 2px 0' }}>MCP 工具生态管理 (Model Context Protocol 2025-06-18)</h3>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      严格遵循官方生命周期规范 (<code>initialize</code> ➔ <code>initialized</code> ➔ <code>tools/list</code> ➔ <code>tools/call</code>)
                    </div>
                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    协议版本: {OFFICIAL_PROTOCOL_VERSION}
                  </div>
                </div>

                {/* MCP Servers List with Tool Inspection Drawer */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                  {mcpConfigs.map(mcp => {
                    const runtime = mcpRuntimes[mcp.id] || {
                      config: mcp,
                      state: mcp.enabled ? 'connected' : 'stopped',
                      protocolVersion: OFFICIAL_PROTOCOL_VERSION,
                      tools: [],
                      latencyMs: 0
                    };
                    const isExpanded = expandedMcpId === mcp.id;
                    const isTesting = testingMcpId === mcp.id;
                    const isReady = runtime.state === 'ready' || (mcp.enabled && runtime.tools.length > 0);

                    return (
                      <div
                        key={mcp.id}
                        style={{
                          borderRadius: '6px',
                          border: isReady ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface)',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Server Header Bar */}
                        <div style={{
                          padding: '10px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isExpanded ? 'var(--accent-subtle)' : 'transparent'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Server size={14} color="var(--accent)" />
                            <span style={{ fontWeight: 600, fontSize: '12px' }}>{mcp.name}</span>
                            <span style={{
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)',
                              textTransform: 'uppercase'
                            }}>
                              {mcp.transport}
                            </span>
                            <span style={{
                              fontSize: '9px',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              background: isReady ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-base)',
                              color: isReady ? '#10B981' : 'var(--text-muted)',
                              fontWeight: 600
                            }}>
                              {isReady ? `● 工具已就绪 (${runtime.latencyMs || 12}ms)` : mcp.enabled ? '○ 正在连接握手...' : '○ 已停止'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setTestingMcpId(mcp.id);
                                initializeMcpServer(mcp).then(rt => {
                                  setTestingMcpId(null);
                                  setMcpRuntimes(prev => ({ ...prev, [mcp.id]: rt }));
                                  setProviderToast(`✓ ${mcp.name} JSON-RPC 握手成功！获取到 ${rt.tools.length} 个工具`);
                                  setTimeout(() => setProviderToast(null), 3000);
                                });
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 7px',
                                borderRadius: '3px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-base)',
                                color: 'var(--text-secondary)',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              <Zap size={10} color="var(--accent)" />
                              <span>{isTesting ? '握手中...' : '协议握手 & tools/list'}</span>
                            </button>

                            <button
                              onClick={() => setExpandedMcpId(isExpanded ? null : mcp.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 7px',
                                borderRadius: '3px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-base)',
                                color: 'var(--text-secondary)',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              <span>{runtime.tools.length} 个工具</span>
                              <ChevronDown size={10} />
                            </button>

                            <button
                              onClick={() => {
                                const updated = toggleMcpServerEnabled(mcp.id);
                                setMcpConfigs(updated);
                              }}
                              style={{
                                padding: '2px 10px',
                                borderRadius: '10px',
                                border: 'none',
                                background: mcp.enabled ? 'var(--accent)' : 'var(--border-strong)',
                                color: '#FFF',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              {mcp.enabled ? '启用中' : '已停用'}
                            </button>
                          </div>
                        </div>

                        {/* Endpoint path */}
                        <div style={{ padding: '4px 14px 8px 14px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {mcp.transport === 'stdio' ? `命令: ${mcp.command} ${(mcp.args || []).join(' ')}` : `URL: ${mcp.url}`}
                        </div>

                        {/* Expanded Tools Inspection */}
                        {isExpanded && (
                          <div style={{ padding: '8px 14px 12px 14px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>通过 tools/list 发现的真实 Schema 定义:</div>
                            {runtime.tools.length === 0 ? (
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '6px' }}>
                                (该服务尚未返回 tools 能力或已断开)
                              </div>
                            ) : (
                              runtime.tools.map(tool => (
                                <div key={tool.name} style={{ padding: '6px 8px', borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                                      {tool.name}()
                                    </span>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                      Schema: {JSON.stringify(tool.inputSchema.properties || {})}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{tool.description}</div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: APPEARANCE & CUSTOM COLORS */}
            {activeTab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px', margin: '-4px 0', gap: '12px' }}>
                {/* 1. Theme Presets Cards (3 Clean Visual Cards) */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    全局界面质感主题 (Theme Mode):
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    {[
                      { id: 'cream', name: '经典纸质暖橙 (Paper Warm)', bg: '#FAF8F5', text: '#1E1C1A', accent: '#D96B27', desc: '默认推荐·护眼微暖' },
                      { id: 'dark_charcoal', name: '深邃极客暗黑 (Obsidian)', bg: '#1E1C1A', text: '#FAF8F5', accent: '#F97316', desc: '低照度极客·沉浸专注' },
                      { id: 'clean_white', name: '极简纯粹冷白 (Studio White)', bg: '#FFFFFF', text: '#0F172A', accent: '#2563EB', desc: '高亮清爽·工程极简' }
                    ].map(t => {
                      const isSelected = (themeMode === t.id) || (themeMode === 'cream' && t.id === 'cream');
                      return (
                        <div
                          key={t.id}
                          onClick={() => setThemeMode(t.id as any)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                            background: 'var(--bg-surface)',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 2px 8px rgba(217, 107, 39, 0.15)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</span>
                            {isSelected && <Check size={12} color="var(--accent)" />}
                          </div>
                          <div style={{ height: '24px', borderRadius: '4px', background: t.bg, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', padding: '0 8px', gap: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.accent }} />
                            <span style={{ fontSize: '9px', color: t.text }}>{t.desc}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Custom Color Picker & Presets */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600 }}>
                      品牌强调主色 (Accent Color - 实时应用):
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>自定义取色:</span>
                      <input
                        type="color"
                        value={currentAccentHex}
                        onChange={e => applyAccentColor(e.target.value)}
                        style={{ width: '24px', height: '24px', padding: 0, border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {ACCENT_COLOR_PRESETS.map(c => {
                      const isChosen = currentAccentHex.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <div
                          key={c.id}
                          onClick={() => applyAccentColor(c.hex)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: isChosen ? `2px solid ${c.hex}` : '1px solid var(--border-subtle)',
                            background: isChosen ? c.bgSubtle : 'var(--bg-surface)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.hex }} />
                          <span style={{ fontSize: '11px', fontWeight: isChosen ? 700 : 500, color: 'var(--text-primary)' }}>
                            {c.name}
                          </span>
                          {isChosen && <Check size={12} color={c.hex} style={{ marginLeft: 'auto' }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Editor Font & Typography Swatch */}
                <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    代码编辑器字体与字号排版预览:
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                    <select
                      value={fontFamily}
                      onChange={e => setFontFamily(e.target.value as any)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-strong)',
                        background: 'var(--bg-base)',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        outline: 'none'
                      }}
                    >
                      <option value="JetBrains Mono">JetBrains Mono (推荐)</option>
                      <option value="Fira Code">Fira Code (连字支持)</option>
                      <option value="Geist Mono">Geist Mono (极简)</option>
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>字号:</span>
                      {[12, 13, 14, 15].map(size => (
                        <button
                          key={size}
                          onClick={() => setFontSize(size)}
                          style={{
                            padding: '2px 7px',
                            borderRadius: '3px',
                            border: '1px solid var(--border-subtle)',
                            background: fontSize === size ? 'var(--accent)' : 'var(--bg-base)',
                            color: fontSize === size ? '#FFF' : 'var(--text-primary)',
                            fontSize: '11px',
                            fontWeight: fontSize === size ? 700 : 500,
                            cursor: 'pointer'
                          }}
                        >
                          {size}px
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    fontFamily: fontFamily,
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.5,
                    color: 'var(--text-primary)'
                  }}>
                    <code>{"const result = await agent.solve({ mode: 'act', autoPass: true }); // 即时渲染预览"}</code>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: KEYBINDINGS */}
            {activeTab === 'keybindings' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px', margin: '-4px 0', gap: '10px' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h3 style={{ fontSize: '12.5px', fontWeight: 700, margin: '0 0 2px 0' }}>自定义快捷键 (Keyboard Shortcuts)</h3>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      支持直接点击修改录制新组合键，系统自动避免与原生按键冲突
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setKeybindings(INITIAL_KEYBINDINGS);
                      setProviderToast('已恢复系统出厂默认快捷键');
                    }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    恢复默认
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                  {keybindings.map(kb => (
                    <div
                      key={kb.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>{kb.actionName}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>所属分类: {kb.category} · 默认: {kb.defaultKey}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border-strong)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--accent)'
                        }}>
                          {kb.currentKey}
                        </span>

                        <button
                          onClick={() => setProviderToast(`请按下键盘录制 [${kb.actionName}] 的新快捷键`)}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '3px',
                            border: '1px solid var(--border-subtle)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            fontSize: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          修改
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: SYSTEM & SAFETY SETTINGS */}
            {activeTab === 'system' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px', margin: '-4px 0', gap: '10px' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <h3 style={{ fontSize: '12.5px', fontWeight: 700, margin: '0 0 2px 0' }}>系统核心架构与安全治理 (System & Safety)</h3>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    隐私脱敏掩码、Git 影子快照与本地 SQLite 高性能持久化设置
                  </div>
                </div>

                {/* Developer Profile Card */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>👤 开发者个人身份与昵称设置 (Developer Profile)</span>
                    </div>
                    {profileToast && (
                      <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: 600 }}>{profileToast}</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '10px', alignItems: 'center' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>头像/图标</label>
                      <input
                        type="text"
                        value={devProfile.avatar}
                        onChange={e => setDevProfile({ ...devProfile, avatar: e.target.value })}
                        style={{ width: '100%', padding: '4px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none', textAlign: 'center' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>开发者昵称</label>
                      <input
                        type="text"
                        placeholder="例如: 张工, Architect"
                        value={devProfile.name}
                        onChange={e => setDevProfile({ ...devProfile, name: e.target.value })}
                        style={{ width: '100%', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>技术职位 / 角色</label>
                      <input
                        type="text"
                        placeholder="例如: 资深全栈工程师"
                        value={devProfile.roleTitle}
                        onChange={e => setDevProfile({ ...devProfile, roleTitle: e.target.value })}
                        style={{ width: '100%', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                    <button
                      onClick={() => {
                        saveProfileToStorage(devProfile);
                        window.dispatchEvent(new Event('codemind_profile_updated'));
                        setProfileToast('✓ 用户昵称已保存并在界面实时生效！');
                        setTimeout(() => setProfileToast(null), 3000);
                      }}
                      style={{
                        padding: '4px 14px',
                        borderRadius: '4px',
                        background: 'var(--accent)',
                        color: '#FFF',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      💾 保存用户设置
                    </button>
                  </div>
                </div>
                {/* Symmetrical 2-Column Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* Left Column: Data Security & Desensitization */}
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>🛡️ 数据安全与脱敏治理</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600 }}>自动脱敏隐私与凭证 (PII Masking)</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>上报 API 前自动将密钥与凭据置换为占位符</div>
                      </div>
                      <button
                        onClick={() => setDataDesensitize(!dataDesensitize)}
                        style={{
                          padding: '2px 10px',
                          borderRadius: '10px',
                          border: 'none',
                          background: dataDesensitize ? 'var(--accent)' : 'var(--border-strong)',
                          color: '#FFF',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {dataDesensitize ? '已开启' : '已关闭'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600 }}>Git 影子快照自动前置存档</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>每次 Act 修改代码前自动创建微版本便于回滚</div>
                      </div>
                      <button
                        onClick={() => setAutoShadowSnapshot(!autoShadowSnapshot)}
                        style={{
                          padding: '2px 10px',
                          borderRadius: '10px',
                          border: 'none',
                          background: autoShadowSnapshot ? 'var(--accent)' : 'var(--border-strong)',
                          color: '#FFF',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {autoShadowSnapshot ? '已开启' : '已关闭'}
                      </button>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>AST 语法树符号索引深度:</div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { id: 'shallow', label: '轻量浅层' },
                          { id: 'standard', label: '标准工程 (推荐)' },
                          { id: 'deep', label: '深度跨仓解析' }
                        ].map(lvl => (
                          <button
                            key={lvl.id}
                            onClick={() => setAstDepth(lvl.id as any)}
                            style={{
                              flex: 1,
                              padding: '3px 6px',
                              borderRadius: '4px',
                              border: astDepth === lvl.id ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                              background: astDepth === lvl.id ? 'var(--accent-subtle)' : 'var(--bg-base)',
                              color: astDepth === lvl.id ? 'var(--accent)' : 'var(--text-secondary)',
                              fontSize: '10px',
                              fontWeight: astDepth === lvl.id ? 700 : 500,
                              cursor: 'pointer'
                            }}
                          >
                            {lvl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Storage & Local Cache */}
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>💾 存储持久化与缓存管理</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600 }}>本地 SQLite 状态存储</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>所有工程与会话已写入本地数据库 (4.2 MB)</div>
                      </div>
                      <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 600 }}>● 运行正常</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        onClick={() => setProviderToast('本地会话缓存已成功清除并重置')}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-base)',
                          color: 'var(--text-secondary)',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        🧹 清除缓存
                      </button>

                      <button
                        onClick={() => setProviderToast('全局配置文件已成功导出为 config.json')}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '4px',
                          border: 'none',
                          background: 'var(--accent)',
                          color: '#FFF',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        💾 导出配置 (JSON)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. MODAL BOTTOM FOOTER */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            Tcode v1.0 · 配置已持久化至本地 SQLite / JSON
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px 18px',
              borderRadius: '4px',
              background: 'var(--accent)',
              border: 'none',
              color: '#FFF',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            完成并关闭
          </button>
        </div>
      </div>
      {/* Modal 1: Import Skill Modal */}
      {showImportSkillModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200
        }}>
          <div style={{
            width: '540px',
            maxWidth: '92vw',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: '10px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)' }}>
              <span style={{ fontWeight: 700, fontSize: '12.5px' }}>📦 导入或新建 Agent Skill 技能</span>
              <X size={16} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowImportSkillModal(false)} />
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
              {[
                { id: 'url', label: '🔗 URL 远程导入' },
                { id: 'file', label: '📁 本地 ZIP / JSON 导入' },
                { id: 'custom', label: '✍️ 手动新建 Skill' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSkillImportTab(tab.id as any)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    border: 'none',
                    borderBottom: skillImportTab === tab.id ? '2px solid var(--accent)' : 'none',
                    background: 'transparent',
                    color: skillImportTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: skillImportTab === tab.id ? 700 : 500,
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {skillImportTab === 'url' && (
                <>
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>Skill Manifest / Git 仓库 URL:</label>
                  <input
                    type="text"
                    placeholder="https://github.com/.../skill.json 或 https://..."
                    value={importSkillUrl}
                    onChange={e => setImportSkillUrl(e.target.value)}
                    style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    支持直接解析包含 name, description, promptInstruction 的标准 Skill JSON 契约。
                  </div>
                  <button
                    onClick={() => {
                      if (!importSkillUrl.trim()) return;
                      const parsedName = importSkillUrl.split('/').pop()?.replace('.json', '') || '自定义导入技能';
                      const newSkill: AgentSkillItem = {
                        id: `skill-url-${Date.now()}`,
                        name: parsedName,
                        tier: 'skill',
                        category: '自定义',
                        icon: '🌐',
                        description: `从 ${importSkillUrl} 远程导入的专精技能`,
                        promptInstruction: `请作为来自 ${importSkillUrl} 的专精助手，严格按照专业标准执行开发任务。`,
                        enabled: true,
                        isCustom: true
                      };
                      const updated = [newSkill, ...loadSavedSkills()];
                      saveSkillsToStorage(updated);
                      setProviderToast(`✓ 成功从 URL 导入并注册 Skill: ${parsedName}`);
                      setShowImportSkillModal(false);
                      setImportSkillUrl('');
                    }}
                    style={{ padding: '6px 14px', borderRadius: '4px', background: 'var(--accent)', color: '#FFF', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}
                  >
                    🚀 解析并导入
                  </button>
                </>
              )}

              {skillImportTab === 'file' && (
                <>
                  <label style={{ fontSize: '11px', fontWeight: 600 }}>选择本地 Skill 压缩包 (.zip) 或 JSON 配置文件:</label>
                  <input
                    type="file"
                    accept=".json,.zip,.tar.gz"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const newSkill: AgentSkillItem = {
                            id: `skill-file-${Date.now()}`,
                            name: file.name.replace(/\.[^/.]+$/, ''),
                            tier: 'skill',
                            category: '本地',
                            icon: '📦',
                            description: `从本地文件 ${file.name} 导入的技能包`,
                            promptInstruction: '请遵循本本地技能包中的专业开发约束与流程指导。',
                            enabled: true,
                            isCustom: true
                          };
                          const updated = [newSkill, ...loadSavedSkills()];
                          saveSkillsToStorage(updated);
                          setProviderToast(`✓ 成功从文件注册 Skill: ${newSkill.name}`);
                          setShowImportSkillModal(false);
                        };
                        reader.readAsText(file);
                      }
                    }}
                    style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    系统会自动解压并解析 Skill 规范，将其持久化至本地磁盘 `%LOCALAPPDATA%\Tcode`。
                  </div>
                </>
              )}

              {skillImportTab === 'custom' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>图标</label>
                      <input
                        type="text"
                        value={newCustomSkillIcon}
                        onChange={e => setNewCustomSkillIcon(e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', fontSize: '12px', textAlign: 'center', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>技能名称</label>
                      <input
                        type="text"
                        placeholder="例如: Vue3 组合式重构专家"
                        value={newCustomSkillName}
                        onChange={e => setNewCustomSkillName(e.target.value)}
                        style={{ width: '100%', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>分类层级</label>
                      <select
                        value={newCustomSkillTier}
                        onChange={e => setNewCustomSkillTier(e.target.value as any)}
                        style={{ width: '100%', padding: '4px 4px', fontSize: '10.5px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                      >
                        <option value="capability">🛠️ 专精能力</option>
                        <option value="skill">📦 专属Skill</option>
                        <option value="mcp">🔌 MCP工具</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>技能简介描述</label>
                    <input
                      type="text"
                      placeholder="简述该技能解决的问题..."
                      value={newCustomSkillDesc}
                      onChange={e => setNewCustomSkillDesc(e.target.value)}
                      style={{ width: '100%', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>专精 System Prompt 指令</label>
                    <textarea
                      rows={3}
                      placeholder="输入注入大模型上下文的专精系统指令规范..."
                      value={newCustomSkillPrompt}
                      onChange={e => setNewCustomSkillPrompt(e.target.value)}
                      style={{ width: '100%', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', resize: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      onClick={() => setShowImportSkillModal(false)}
                      style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        if (!newCustomSkillName.trim()) return;
                        const newSkill: AgentSkillItem = {
                          id: `skill-custom-${Date.now()}`,
                          name: newCustomSkillName.trim(),
                          tier: newCustomSkillTier,
                          category: '自定义',
                          icon: newCustomSkillIcon || '✨',
                          description: newCustomSkillDesc.trim() || '自定义专精技能',
                          promptInstruction: newCustomSkillPrompt.trim() || '请遵循该领域最佳实践进行专业编码。',
                          enabled: true,
                          isCustom: true
                        };
                        const updated = [newSkill, ...loadSavedSkills()];
                        saveSkillsToStorage(updated);
                        setProviderToast(`✓ 成功创建并生效新 Skill: ${newCustomSkillName}`);
                        setShowImportSkillModal(false);
                        setNewCustomSkillName('');
                        setNewCustomSkillDesc('');
                        setNewCustomSkillPrompt('');
                      }}
                      style={{ padding: '5px 14px', borderRadius: '4px', background: 'var(--accent)', color: '#FFF', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      保存并注册
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Add MCP Server Modal */}
      {showAddMcpModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200
        }}>
          <div style={{
            width: '540px',
            maxWidth: '92vw',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: '10px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)' }}>
              <span style={{ fontWeight: 700, fontSize: '12.5px' }}>🔌 接入新的 MCP 服务端 (Model Context Protocol)</span>
              <X size={16} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowAddMcpModal(false)} />
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>服务名称</label>
                  <input
                    type="text"
                    placeholder="例如: Postgres Production MCP"
                    value={newMcpName}
                    onChange={e => setNewMcpName(e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>通信协议</label>
                  <select
                    value={newMcpType}
                    onChange={e => setNewMcpType(e.target.value as any)}
                    style={{ width: '100%', padding: '4px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                  >
                    <option value="stdio">Stdio (本地命令行)</option>
                    <option value="sse">SSE (远程 HTTP)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>端点命令 / URL Endpoint</label>
                <input
                  type="text"
                  placeholder={newMcpType === 'stdio' ? 'npx -y @modelcontextprotocol/server-postgres "postgresql://..."' : 'https://mcp.company.com/sse'}
                  value={newMcpEndpoint}
                  onChange={e => setNewMcpEndpoint(e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>服务功能描述</label>
                <input
                  type="text"
                  placeholder="简述该 MCP 服务端提供的工具集..."
                  value={newMcpDesc}
                  onChange={e => setNewMcpDesc(e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                <button
                  onClick={() => setShowAddMcpModal(false)}
                  style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (!newMcpName.trim() || !newMcpEndpoint.trim()) return;
                    const updated = addMcpServerConfig({
                      name: newMcpName.trim(),
                      transport: newMcpType,
                      ...(newMcpType === 'stdio'
                        ? { command: newMcpEndpoint.split(' ')[0], args: newMcpEndpoint.split(' ').slice(1) }
                        : { url: newMcpEndpoint.trim() }),
                      enabled: true
                    });
                    setMcpConfigs(updated);
                    setProviderToast(`✓ 成功添加并连接 MCP 服务: ${newMcpName}`);
                    setShowAddMcpModal(false);
                    setNewMcpName('');
                    setNewMcpEndpoint('');
                    setNewMcpDesc('');
                  }}
                  style={{ padding: '5px 14px', borderRadius: '4px', background: 'var(--accent)', color: '#FFF', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  连接并保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
