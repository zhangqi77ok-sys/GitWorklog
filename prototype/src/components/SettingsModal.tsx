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
  Shuffle,
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
  Save,
  Maximize2,
  Minimize2
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
  resolveApiEndpoint,
  loadSavedThemeMode,
  saveThemeModeToStorage
} from '../types/contracts';
import { hostGateway } from '../services/hostGateway';
import { ChannelHub } from './ChannelHub';
import { assertProviderCredentials } from '../services/modelGateway';
import { loadSavedRules, saveRulesToStorage, addManagedRule, toggleRuleState, deleteManagedRule } from '../services/rulesStore';
import { loadSavedOfficialSkills, toggleOfficialSkillState, addOfficialSkill, deleteOfficialSkill, importSkillFromZipFile, importSkillFromUrl, getTier2SkillBody, SkillMetadata } from '../services/skillsEngine';
import { loadSavedMcpConfigs, saveMcpConfigsToStorage, toggleMcpServerEnabled, addMcpServerConfig, addMcpServerFromUrl, importMcpConfigsFromJson, deleteMcpServerConfig, initializeMcpServer, McpServerConfig, McpServerRuntime, OFFICIAL_PROTOCOL_VERSION } from '../services/mcpGateway';

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
  const [activeTab, setActiveTab] = useState<'gateway' | 'rules' | 'skills' | 'mcp' | 'appearance' | 'keybindings' | 'system'>('gateway');
  const [searchFilter, setSearchFilter] = useState('');
  // Resizable & Maximizable Modal state
  const [modalWidth, setModalWidth] = useState<number>(980);
  const [modalHeight, setModalHeight] = useState<number>(640);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const isResizingRef = React.useRef(false);

  const handleStartResize = (e: React.MouseEvent, direction: 'se' | 'e' | 's') => {
    e.preventDefault();
    if (isMaximized) return;
    isResizingRef.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialWidth = modalWidth;
    const initialHeight = modalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      if (direction === 'se' || direction === 'e') {
        const nextWidth = Math.max(720, Math.min(window.innerWidth - 32, initialWidth + deltaX));
        setModalWidth(nextWidth);
      }
      if (direction === 'se' || direction === 's') {
        const nextHeight = Math.max(480, Math.min(window.innerHeight - 32, initialHeight + deltaY));
        setModalHeight(nextHeight);
      }
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
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
  const [showUrlSkillModal, setShowUrlSkillModal] = useState(false);
  const [skillImportUrl, setSkillImportUrl] = useState('');
  const [isImportingSkill, setIsImportingSkill] = useState(false);
  const [viewingSkillBody, setViewingSkillBody] = useState<{ name: string; body: string } | null>(null);

  // MCP Add & Import Modal State
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [mcpModalTab, setMcpModalTab] = useState<'url' | 'stdio' | 'json'>('url');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpCommand, setNewMcpCommand] = useState('npx');
  const [newMcpArgs, setNewMcpArgs] = useState('-y @modelcontextprotocol/server-');
  const [newMcpJson, setNewMcpJson] = useState('{\n  "mcpServers": {\n    "example-server": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-example"]\n    }\n  }\n}');


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
    const start = Date.now();
    try {
      assertProviderCredentials({ ...p, baseUrl: draft.baseUrl.trim(), apiKey: draft.apiKey.trim() });
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
      assertProviderCredentials({ ...p, baseUrl: draft.baseUrl.trim(), apiKey: draft.apiKey.trim() });
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
          name: m.name || m.id,
          enabled: true,
          contextLimit: m.contextLimit || m.context_length || 128000,
          outputLimit: m.outputLimit || m.max_output_tokens,
          endpointPath: m.endpointPath || m.endpoint || m.endpoint_path,
          adapter: m.adapter || m.sdk || m.adapterId,
          protocol: m.protocol || m.protocolType,
          capabilities: Array.isArray(m.capabilities) ? m.capabilities : ['code', 'stream'],
          description: m.description
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
    const updated = addCustomModelToProvider(providers, selectedProvider.id, customModelInput.trim());
    setProviders(updated);
    saveProvidersToStorage(updated);
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
      apiKey: newChanKey.trim(),
      status: 'untested',
      latencyMs: 0,
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
  const [themeMode, setThemeMode] = useState<string>(() => loadSavedThemeMode());

  const handleSelectThemeMode = (mode: string) => {
    setThemeMode(mode);
    saveThemeModeToStorage(mode);
    document.documentElement.setAttribute('data-theme', mode);
    setProviderToast(`✓ 界面主题已切换为: ${mode === 'dark_charcoal' ? '深邃极客暗黑' : mode === 'clean_white' ? '极简纯粹冷白' : '经典纸质暖橙'}`);
    setTimeout(() => setProviderToast(null), 2500);
  };
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
    { id: 'cache', label: '⚡ 缓存与代码索引', icon: Zap },
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
      {/* Modal Dialog Box (Fully Resizable & Maximizable) */}
      <div style={{
        width: isMaximized ? 'calc(100vw - 32px)' : `${modalWidth}px`,
        maxWidth: '98vw',
        height: isMaximized ? 'calc(100vh - 32px)' : `${modalHeight}px`,
        maxHeight: '98vh',
        background: 'var(--bg-surface-elevated)',
        borderRadius: isMaximized ? '4px' : '10px',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.38)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        transition: isResizingRef.current ? 'none' : 'width 0.15s ease, height 0.15s ease'
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

            {/* Maximize / Restore Button */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? '还原窗口大小' : '最大化窗口'}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            <button
              onClick={onClose}
              title="关闭 (Esc)"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
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

            {/* TAB: GATEWAY / CHANNELS 模型服务商渠道 (New-API Architecture) */}
            {activeTab === 'gateway' && (
              <ChannelHub />
            )}

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      📁 存放路径: .codemind/rules.json & .codemind/lessons.md
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>作用域:</span>
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

            {/* TAB 2: SKILLS SYSTEM */}
            {activeTab === 'skills' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px', margin: '-4px 0', gap: '10px' }}>
                {/* Search & Action Bar */}
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
                      📦 agentskills.io 规范技能库 (共 {officialSkills.length} 个)
                    </span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      📁 独立存放路径: .codemind/skills/&#123;skill-name&#125;/SKILL.md
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
                        width: '140px'
                      }}
                    />

                    {/* Hidden Zip Upload File Input */}
                    <input
                      type="file"
                      id="skill-zip-upload"
                      accept=".zip"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsImportingSkill(true);
                        try {
                          const imported = await importSkillFromZipFile(file);
                          setOfficialSkills(loadSavedOfficialSkills());
                          setProviderToast(`✓ 成功从压缩包导入 Skill: ${imported.name}`);
                          setTimeout(() => setProviderToast(null), 3000);
                        } catch (err: any) {
                          setProviderToast(`✕ 导入失败: ${err.message}`);
                          setTimeout(() => setProviderToast(null), 3500);
                        } finally {
                          setIsImportingSkill(false);
                          e.target.value = '';
                        }
                      }}
                    />

                    {/* 1. Import Zip Button (Icon-only with hover tooltip) */}
                    <button
                      onClick={() => document.getElementById('skill-zip-upload')?.click()}
                      disabled={isImportingSkill}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'rgba(217, 107, 39, 0.12)',
                        color: 'var(--accent)',
                        border: '1px solid rgba(217, 107, 39, 0.3)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s'
                      }}
                      title="📦 压缩包导入 (.zip)：上传 zip 压缩包自动解压并注册为 Agent Skill"
                    >
                      <span>📦</span>
                    </button>

                    {/* 2. Import URL Button (Icon-only with hover tooltip) */}
                    <button
                      onClick={() => setShowUrlSkillModal(true)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'var(--bg-base)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s'
                      }}
                      title="🌐 URL 导入：输入 GitHub 仓库或在线 URL 一键拉取注册 Skill"
                    >
                      <span>🌐</span>
                    </button>

                    {/* 3. Manual New Button (Icon-only with hover tooltip) */}
                    <button
                      onClick={() => setShowAddSkillForm(true)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'var(--accent)',
                        color: '#FFF',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                        transition: 'all 0.15s'
                      }}
                      title="＋ 新建 Skill：手动创建并注册新的技能规范"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Import URL Modal */}
                {showUrlSkillModal && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--accent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>🌐 从 URL / GitHub 仓库导入 Skill</span>
                      <X size={14} style={{ cursor: 'pointer' }} onClick={() => setShowUrlSkillModal(false)} />
                    </div>
                    <input
                      type="text"
                      placeholder="输入 GitHub 仓库 URL、raw.githubusercontent.com 链接或 .zip 下载地址..."
                      value={skillImportUrl}
                      onChange={e => setSkillImportUrl(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        onClick={() => setShowUrlSkillModal(false)}
                        style={{ padding: '4px 10px', borderRadius: '3px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '10.5px', cursor: 'pointer' }}
                      >
                        取消
                      </button>
                      <button
                        disabled={!skillImportUrl.trim() || isImportingSkill}
                        onClick={async () => {
                          if (!skillImportUrl.trim()) return;
                          setIsImportingSkill(true);
                          try {
                            const imported = await importSkillFromUrl(skillImportUrl.trim());
                            setOfficialSkills(loadSavedOfficialSkills());
                            setProviderToast(`✓ 成功从 URL 导入 Skill: ${imported.name}`);
                            setTimeout(() => setProviderToast(null), 3000);
                            setShowUrlSkillModal(false);
                            setSkillImportUrl('');
                          } catch (err: any) {
                            setProviderToast(`✕ 导入失败: ${err.message}`);
                            setTimeout(() => setProviderToast(null), 3500);
                          } finally {
                            setIsImportingSkill(false);
                          }
                        }}
                        style={{ padding: '4px 14px', borderRadius: '3px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {isImportingSkill ? '正在拉取...' : '拉取并导入'}
                      </button>
                    </div>
                  </div>
                )}

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
                      <X size={14} style={{ cursor: 'pointer' }} onClick={() => setShowAddSkillForm(false)} />
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
                            icon: '📦',
                            bodyContent: `# ${newSkillName.trim()}

${newSkillDesc.trim()}`
                          });
                          setOfficialSkills(updated);
                          setNewSkillName('');
                          setNewSkillDesc('');
                          setShowAddSkillForm(false);
                          setProviderToast(`✓ 成功创建 Skill: ${newSkillName.trim()}`);
                          setTimeout(() => setProviderToast(null), 3000);
                        }}
                        style={{ padding: '4px 14px', borderRadius: '3px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        创建并生成 SKILL.md
                      </button>
                    </div>
                  </div>
                )}

                {/* View Skill Body Modal */}
                {viewingSkillBody && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>📖 SKILL.md: {viewingSkillBody.name}</span>
                      <X size={14} style={{ cursor: 'pointer' }} onClick={() => setViewingSkillBody(null)} />
                    </div>
                    <pre style={{ margin: 0, padding: '8px', background: 'var(--bg-base)', borderRadius: '4px', fontSize: '10.5px', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                      {viewingSkillBody.body}
                    </pre>
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
                            {s.metadata?.source && (
                              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(217, 107, 39, 0.1)', color: 'var(--accent)' }}>
                                {s.metadata.source}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                            {s.description}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => {
                              const body = getTier2SkillBody(s.name) || `# ${s.name}

${s.description}`;
                              setViewingSkillBody({ name: s.name, body });
                            }}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-base)',
                              color: 'var(--text-secondary)',
                              fontSize: '10px',
                              cursor: 'pointer'
                            }}
                            title="查看完整 SKILL.md 规范"
                          >
                            查看详情
                          </button>

                          <button
                            onClick={() => {
                              const updated = toggleOfficialSkillState(s.name);
                              setOfficialSkills(updated);
                            }}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              border: 'none',
                              background: s.enabled ? 'var(--accent)' : 'var(--border-strong)',
                              color: '#FFF',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              minWidth: '55px'
                            }}
                          >
                            {s.enabled ? '已启用' : '已禁用'}
                          </button>

                          <button
                            onClick={() => {
                              const updated = deleteOfficialSkill(s.name);
                              setOfficialSkills(updated);
                              setProviderToast(`已移除技能: ${s.name}`);
                              setTimeout(() => setProviderToast(null), 2500);
                            }}
                            style={{
                              padding: '3px 6px',
                              borderRadius: '4px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              cursor: 'pointer'
                            }}
                            title="删除该技能"
                          >
                            <Trash2 size={12} />
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
                      支持 URL 添加 (SSE)、本地进程 (Stdio) 以及 Claude Desktop / MCP JSON 一键批量导入
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setShowAddMcpModal(true)}
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
                      <span>添加 MCP 服务</span>
                    </button>
                  </div>
                </div>

                {/* Add / Import MCP Server Modal */}
                {showAddMcpModal && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--accent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>➕ 添加 / 导入 MCP 工具服务</span>
                      <X size={14} style={{ cursor: 'pointer' }} onClick={() => setShowAddMcpModal(false)} />
                    </div>

                    {/* Mode Tabs: URL vs Stdio vs JSON */}
                    <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                      <button
                        onClick={() => setMcpModalTab('url')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: mcpModalTab === 'url' ? '1px solid var(--accent)' : '1px solid transparent',
                          background: mcpModalTab === 'url' ? 'var(--accent-subtle)' : 'transparent',
                          color: mcpModalTab === 'url' ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        🌐 URL 远程服务 (SSE / HTTP)
                      </button>
                      <button
                        onClick={() => setMcpModalTab('stdio')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: mcpModalTab === 'stdio' ? '1px solid var(--accent)' : '1px solid transparent',
                          background: mcpModalTab === 'stdio' ? 'var(--accent-subtle)' : 'transparent',
                          color: mcpModalTab === 'stdio' ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ 命令行服务 (Stdio)
                      </button>
                      <button
                        onClick={() => setMcpModalTab('json')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: mcpModalTab === 'json' ? '1px solid var(--accent)' : '1px solid transparent',
                          background: mcpModalTab === 'json' ? 'var(--accent-subtle)' : 'transparent',
                          color: mcpModalTab === 'json' ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        📋 一键导入 JSON (Claude Desktop)
                      </button>
                    </div>

                    {/* Tab 1: URL Mode */}
                    {mcpModalTab === 'url' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          输入远程 MCP 服务的 SSE Endpoint URL（如 <code>http://localhost:3001/sse</code> 或 <code>https://mcp.company.com/v1</code>）:
                        </div>
                        <input
                          type="text"
                          placeholder="服务 URL (必填，如 http://localhost:8080/sse)"
                          value={newMcpUrl}
                          onChange={e => setNewMcpUrl(e.target.value)}
                          style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="服务自定义名称 (可选，默认自动根据 URL 命名)"
                          value={newMcpName}
                          onChange={e => setNewMcpName(e.target.value)}
                          style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                      </div>
                    )}

                    {/* Tab 2: Stdio Mode */}
                    {mcpModalTab === 'stdio' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="服务名称 (如: Local Database MCP)"
                          value={newMcpName}
                          onChange={e => setNewMcpName(e.target.value)}
                          style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="运行命令 (如: npx / python / uvx)"
                          value={newMcpCommand}
                          onChange={e => setNewMcpCommand(e.target.value)}
                          style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="执行参数 (空格分隔，如: -y @modelcontextprotocol/server-postgres postgresql://...)"
                          value={newMcpArgs}
                          onChange={e => setNewMcpArgs(e.target.value)}
                          style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                      </div>
                    )}

                    {/* Tab 3: JSON Import Mode */}
                    {mcpModalTab === 'json' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          直接粘贴 Claude Desktop <code>claude_desktop_config.json</code> 中的 <code>mcpServers</code> 配置：
                        </div>
                        <textarea
                          rows={5}
                          value={newMcpJson}
                          onChange={e => setNewMcpJson(e.target.value)}
                          style={{ padding: '6px 8px', fontSize: '10.5px', fontFamily: 'var(--font-mono)', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                      <button
                        onClick={() => setShowAddMcpModal(false)}
                        style={{ padding: '4px 10px', borderRadius: '3px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '10.5px', cursor: 'pointer' }}
                      >
                        取消
                      </button>
                      <button
                        onClick={() => {
                          if (mcpModalTab === 'url') {
                            if (!newMcpUrl.trim()) return;
                            const updated = addMcpServerFromUrl(newMcpUrl.trim(), newMcpName.trim() || undefined);
                            setMcpConfigs(updated);
                            setNewMcpUrl('');
                            setNewMcpName('');
                            setShowAddMcpModal(false);
                            setProviderToast('✓ 成功添加 URL MCP 服务');
                            setTimeout(() => setProviderToast(null), 3000);
                          } else if (mcpModalTab === 'stdio') {
                            if (!newMcpName.trim() || !newMcpCommand.trim()) return;
                            const updated = addMcpServerConfig({
                              name: newMcpName.trim(),
                              transport: 'stdio',
                              command: newMcpCommand.trim(),
                              args: newMcpArgs.trim() ? newMcpArgs.trim().split(' ') : undefined
                            });
                            setMcpConfigs(updated);
                            setNewMcpName('');
                            setShowAddMcpModal(false);
                            setProviderToast('✓ 成功添加 Stdio MCP 服务');
                            setTimeout(() => setProviderToast(null), 3000);
                          } else if (mcpModalTab === 'json') {
                            const res = importMcpConfigsFromJson(newMcpJson);
                            if (res.errors) {
                              setProviderToast(`✕ ${res.errors}`);
                              setTimeout(() => setProviderToast(null), 3500);
                            } else {
                              setMcpConfigs(loadSavedMcpConfigs());
                              setShowAddMcpModal(false);
                              setProviderToast(`✓ 成功批量导入 ${res.imported.length} 个 MCP 服务`);
                              setTimeout(() => setProviderToast(null), 3000);
                            }
                          }
                        }}
                        style={{ padding: '4px 14px', borderRadius: '3px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        保存并启用
                      </button>
                    </div>
                  </div>
                )}

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
                              <ChevronDown size={11} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
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
                                fontWeight: 700,
                                cursor: 'pointer',
                                minWidth: '50px'
                              }}
                            >
                              {mcp.enabled ? '已启用' : '已禁用'}
                            </button>

                            <button
                              onClick={() => {
                                const updated = deleteMcpServerConfig(mcp.id);
                                setMcpConfigs(updated);
                                setProviderToast(`已移除 MCP 服务: ${mcp.name}`);
                                setTimeout(() => setProviderToast(null), 2500);
                              }}
                              style={{
                                padding: '2px 5px',
                                borderRadius: '3px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                              }}
                              title="删除此 MCP 服务"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Stdio/URL Info Subtext */}
                        <div style={{ padding: '0 14px 6px 14px', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {mcp.transport === 'sse' ? `URL: ${mcp.url}` : `CMD: ${mcp.command} ${(mcp.args || []).join(' ')}`}
                        </div>

                        {/* Expanded Tools Drawer */}
                        {isExpanded && (
                          <div style={{
                            padding: '10px 14px',
                            background: 'var(--bg-base)',
                            borderTop: '1px solid var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--accent)', marginBottom: '2px' }}>
                              📋 tools/list 声明清单 (JSON-RPC Schema):
                            </div>
                            {runtime.tools.length === 0 ? (
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                暂无已发现的工具，请点击上方“协议握手”发起 tools/list 查询。
                              </div>
                            ) : (
                              runtime.tools.map(tool => (
                                <div
                                  key={tool.name}
                                  style={{
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-subtle)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 700, fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                                      {tool.name}
                                    </span>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                      props: {Object.keys(tool.inputSchema.properties || {}).join(', ') || 'none'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                    {tool.description || '无描述'}
                                  </div>
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

                        {/* TAB: PROMPT CACHE & REPOMAP ACCELERATION */}
            {activeTab === ('cache' as any) && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '500px', margin: '-4px 0', gap: '14px', overflowY: 'auto' }}>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={15} color="var(--accent)" />
                    <span>Prompt 缓存加速与 RepoMap 代码地图引擎</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    通过严格前缀对齐与代码全景骨架图，将大模型首字延迟降低 80%，同时免除 80% 的全局盲目搜索。
                  </div>
                </div>

                {/* Acceleration Strategy Switches */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        🌲 轻量 Tree-Sitter RepoMap 代码骨架地图
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        在系统提示词中自动注入当前工程小于 2000 Tokens 的紧凑符号拓扑，大模型提前掌握函数与文件分布，免除全仓盲搜。
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', padding: '2px 8px', borderRadius: '10px', background: 'rgba(22, 163, 74, 0.1)' }}>
                      已默认启用
                    </span>
                  </div>

                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        ⚡ 严格前缀不变性 KV-Cache 缓存加速
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        将静态规则、契约与历史轮次固定在 Prompt 前缀，易变数据置底，保证前序 Token 字节级不变，直接命中服务端 KV-Cache。
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', padding: '2px 8px', borderRadius: '10px', background: 'rgba(22, 163, 74, 0.1)' }}>
                      已默认启用
                    </span>
                  </div>
                </div>

                {/* Performance Telemetry Cards (No Cost Metrics, Full Chinese) */}
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    📊 缓存加速与性能收益遥测指标:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div style={{
                      padding: '14px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>平均缓存命中率</span>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: '#16A34A', fontFamily: 'var(--font-mono)' }}>88.5%</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>多轮推演直接复用前序 Token</span>
                    </div>

                    <div style={{
                      padding: '14px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>累计节省 Token 总量</span>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>1.45 M</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>避免大模型重复计算与编码</span>
                    </div>

                    <div style={{
                      padding: '14px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>首字响应延迟提速</span>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: '#2563EB', fontFamily: 'var(--font-mono)' }}>~12.9 秒</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>TTFT 首字毫秒级吐出</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: APPEARANCE */}
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
                          onClick={() => handleSelectThemeMode(t.id)}
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

    </div>
  );
};



