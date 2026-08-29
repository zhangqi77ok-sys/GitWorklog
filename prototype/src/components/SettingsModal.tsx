import React, { useState, useEffect } from 'react';
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
  SlidersHorizontal
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
  RuleItem,
  INITIAL_RULES,
  toggleRuleItem,
  ProviderHealth,
  McpServerInfo
} from '../types/contracts';

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
  const [activeTab, setActiveTab] = useState<'gateway' | 'rules' | 'skills' | 'mcp' | 'appearance' | 'keybindings' | 'system'>('rules');
  const [searchFilter, setSearchFilter] = useState('');
  const [rules, setRules] = useState<RuleItem[]>(INITIAL_RULES);


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

  // 1. Gateway State
  const [providers, setProviders] = useState<ProviderHealth[]>([
    { id: 'anthropic', name: 'Anthropic (Claude 3.5/3.7)', status: 'healthy', latencyMs: 128, endpoint: 'https://api.anthropic.com/v1', activeModel: 'claude-3-5-sonnet-20241022' },
    { id: 'deepseek', name: 'DeepSeek (百炼推理总线)', status: 'healthy', latencyMs: 85, endpoint: 'https://api.deepseek.com/v1', activeModel: 'deepseek-reasoner' },
    { id: 'openai', name: 'OpenAI (GPT-4o/o3-mini)', status: 'healthy', latencyMs: 142, endpoint: 'https://api.openai.com/v1', activeModel: 'gpt-4o' },
    { id: 'ollama', name: '本地私有 Ollama (物理隔离)', status: 'healthy', latencyMs: 0, endpoint: 'http://localhost:11434', activeModel: 'qwen2.5-coder:32b' }
  ]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>(['anthropic', 'deepseek']);
  const [testingId, setTestingId] = useState<string | null>(null);

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

  if (!isOpen) return null;

  const handleTestProvider = (id: string) => {
    setTestingId(id);
    setTimeout(() => {
      setProviders(prev =>
        prev.map(p => (p.id === id ? { ...p, latencyMs: p.id === 'ollama' ? 0 : Math.floor(Math.random() * 60) + 70 } : p))
      );
      setTestingId(null);
    }, 500);
  };

  const navTabs = [
    { id: 'gateway', label: '模型网关', icon: Cpu },
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
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700 }}>Rule 规则管理 (Rules for AI)</h3>
                  <button style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'var(--accent)',
                    color: '#FFF',
                    border: 'none',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}>
                    <Plus size={11} />
                    <span>添加自定义规则</span>
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  参考 Cursor <code>.cursorrules</code> 与 Antigravity 架构，问答发起与 Act 任务启动前会自动前置注入处于生效状态的 Rule 规则。
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rules.map(r => (
                    <div
                      key={r.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: r.enabled ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}
                    >
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, fontSize: '12px' }}>{r.title}</span>
                          <span style={{
                            fontSize: '9px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: r.scope === 'project' ? 'rgba(217, 107, 39, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                            color: r.scope === 'project' ? 'var(--accent)' : '#2563EB',
                            fontWeight: 600
                          }}>
                            {r.scope === 'project' ? '📁 工程级规则' : '🌐 全局通用规则'}
                          </span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {r.content}
                        </p>
                      </div>

                      <button
                        onClick={() => setRules(toggleRuleItem(rules, r.id))}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          border: 'none',
                          background: r.enabled ? 'var(--accent)' : 'var(--border-strong)',
                          color: '#FFF',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minWidth: '55px'
                        }}
                      >
                        {r.enabled ? '已生效' : '已禁用'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

                        {/* TAB 1: MODEL GATEWAY FULL ARCHITECTURE */}
            {activeTab === 'gateway' && (
              <div style={{ position: 'relative' }}>
                {channelNotice && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--accent)',
                    color: '#FFF',
                    fontSize: '11px',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {channelNotice}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '13px', fontWeight: 700 }}>模型网关与调度中心 (Model Gateway & Routing)</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      具备工业级“智能任务角色路由”与“多渠道凭证/模型池统一管理”。
                    </p>
                  </div>
                </div>

                {/* Sub-Tabs Switcher */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <button
                    onClick={() => setGatewaySubTab('roles')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      background: gatewaySubTab === 'roles' ? 'var(--accent)' : 'var(--bg-surface)',
                      color: gatewaySubTab === 'roles' ? '#FFF' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <SlidersHorizontal size={12} />
                    <span>🎯 智能任务角色路由 (Role Routing)</span>
                  </button>
                  <button
                    onClick={() => setGatewaySubTab('channels')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      background: gatewaySubTab === 'channels' ? 'var(--accent)' : 'var(--bg-surface)',
                      color: gatewaySubTab === 'channels' ? '#FFF' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Server size={12} />
                    <span>🌐 渠道凭据与模型池 ({channels.length} 个渠道)</span>
                  </button>
                </div>

                {/* ============================================================= */}
                {/* SUBTAB 1: MODEL ROLES ROUTING                                 */}
                {/* ============================================================= */}
                {gatewaySubTab === 'roles' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ padding: '8px 10px', background: 'rgba(217, 107, 39, 0.08)', borderRadius: '6px', border: '1px solid rgba(217, 107, 39, 0.25)', fontSize: '11px', color: 'var(--accent)', lineHeight: 1.5 }}>
                      💡 <strong>智能角色分工机理</strong>：底座杜绝全局使用单一模型，不同开发任务交由最擅长该领域的专有模型调度（例如思考方案交给 R1 推理模型，修改落地代码交给 3.5 Sonnet，断网或限流时零感知平滑降级至本地私有 Ollama）。
                    </div>

                    {/* 1. Planner Model */}
                    <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '12px' }}>📐 架构规划与思考模型 (Plan / Reasoner)</span>
                            <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px', background: 'rgba(147, 51, 234, 0.1)', color: '#9333EA', fontWeight: 600 }}>深度思维链</span>
                          </div>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            用于 SDD 契约制定、复杂跨文件重构方案决策、深度架构选型（不直接写盘）
                          </p>
                        </div>
                        <select
                          value={roleRouting.planModelId}
                          onChange={e => setRoleRouting(updateModelRoleRouting(roleRouting, 'planModelId', e.target.value))}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
                        >
                          <option value="deepseek-reasoner">DeepSeek R1 (百炼推理总线)</option>
                          <option value="claude-3-7-sonnet">Claude 3.7 Sonnet (Thinking Mode)</option>
                          <option value="o3-mini">OpenAI o3-mini (深度推理)</option>
                        </select>
                      </div>
                    </div>

                    {/* 2. Act Model */}
                    <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '12px' }}>⚡ 代码工程落地执行模型 (Act / Coder)</span>
                            <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px', background: 'rgba(217, 107, 39, 0.15)', color: 'var(--accent)', fontWeight: 600 }}>高准确率落地</span>
                          </div>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            用于极速改写代码、运行 Vitest 自动化单测、根据报错自动自愈纠错
                          </p>
                        </div>
                        <select
                          value={roleRouting.actModelId}
                          onChange={e => setRoleRouting(updateModelRoleRouting(roleRouting, 'actModelId', e.target.value))}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
                        >
                          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (主力旗舰)</option>
                          <option value="deepseek-chat">DeepSeek-V3 (极速代码)</option>
                          <option value="gpt-4o">OpenAI GPT-4o</option>
                        </select>
                      </div>
                    </div>

                    {/* 3. Inline Model */}
                    <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '12px' }}>⚡ 行内极速补全模型 (Inline / Fast)</span>
                            <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', fontWeight: 600 }}>毫秒级时延</span>
                          </div>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            用于代码编辑器行内 Ghost Text 补全预测与单行代码解释
                          </p>
                        </div>
                        <select
                          value={roleRouting.inlineModelId}
                          onChange={e => setRoleRouting(updateModelRoleRouting(roleRouting, 'inlineModelId', e.target.value))}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
                        >
                          <option value="claude-3-5-haiku">Claude 3.5 Haiku (轻快低时延)</option>
                          <option value="deepseek-chat">DeepSeek-V3 (低延迟)</option>
                          <option value="gpt-4o-mini">GPT-4o-mini</option>
                        </select>
                      </div>
                    </div>

                    {/* 4. Fallback Model */}
                    <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '12px' }}>🛡️ 离线与限流容灾兜底模型 (Fallback / Offline)</span>
                            <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', fontWeight: 600 }}>物理私有防故障</span>
                          </div>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            当云端出现 429 限流、网络中断或进入涉密脱密模式时，自动无损无感知接管
                          </p>
                        </div>
                        <select
                          value={roleRouting.fallbackModelId}
                          onChange={e => setRoleRouting(updateModelRoleRouting(roleRouting, 'fallbackModelId', e.target.value))}
                          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '11px', outline: 'none' }}
                        >
                          <option value="qwen2.5-coder:32b">本地 Ollama (Qwen2.5-Coder 32B)</option>
                          <option value="deepseek-r1:14b">本地 Ollama (DeepSeek-R1 14B)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============================================================= */}
                {/* SUBTAB 2: PROVIDERS & MODEL POOLS                             */}
                {/* ============================================================= */}
                {gatewaySubTab === 'channels' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        已配置的 upstream 上游服务商渠道
                      </span>
                      <button
                        onClick={() => setShowAddChannelModal(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'var(--accent)',
                          color: '#FFF',
                          border: 'none',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={11} />
                        <span>添加自定义渠道 / 中转</span>
                      </button>
                    </div>

                    {channels.map(chan => {
                      const isShowKey = showKeyMap[chan.id] ?? false;
                      const isTestingThis = channelTestingId === chan.id;

                      return (
                        <div
                          key={chan.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-surface)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          {/* Channel Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '12px' }}>{chan.name}</span>
                              <span style={{
                                fontSize: '9px',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10B981',
                                fontWeight: 600
                              }}>
                                {isTestingThis ? '探测测速中...' : (chan.latencyMs === 0 ? '🟢 本地直连 · 0ms' : `🟢 正常 · ${chan.latencyMs}ms`)}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                onClick={() => handleTestChannel(chan)}
                                title="测试此渠道网络连通性与延迟"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '2px 7px',
                                  borderRadius: '3px',
                                  border: '1px solid var(--border-subtle)',
                                  background: 'var(--bg-base)',
                                  color: 'var(--accent)',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                <Zap size={10} />
                                <span>连通性测试</span>
                              </button>
                              <button
                                onClick={() => handleFetchModels(chan)}
                                title="自动向 /v1/models 拉取该渠道的最新可用模型"
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
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                <RefreshCw size={10} />
                                <span>拉取模型列表</span>
                              </button>
                            </div>
                          </div>

                          {/* Base URL & API Key Inputs */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                Base URL (端点服务地址):
                              </label>
                              <input
                                type="text"
                                value={chan.baseUrl}
                                onChange={e => {
                                  const val = e.target.value;
                                  setChannels(prev => prev.map(c => c.id === chan.id ? { ...c, baseUrl: val } : c));
                                }}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-strong)',
                                  background: 'var(--bg-base)',
                                  color: 'var(--text-primary)',
                                  fontFamily: 'var(--font-mono)',
                                  outline: 'none'
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                                API Key 凭据:
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px solid var(--border-strong)', padding: '0 6px' }}>
                                <input
                                  type={isShowKey ? 'text' : 'password'}
                                  value={chan.apiKey}
                                  placeholder={chan.id === 'chan-ollama' ? '本地 Ollama 免秘钥' : 'sk-...'}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setChannels(prev => prev.map(c => c.id === chan.id ? { ...c, apiKey: val } : c));
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '4px 0',
                                    fontSize: '11px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-mono)',
                                    outline: 'none'
                                  }}
                                />
                                {chan.apiKey && (
                                  <button
                                    onClick={() => toggleShowKey(chan.id)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                  >
                                    {isShowKey ? <EyeOff size={12} /> : <Eye size={12} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Model Checklist */}
                          <div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              该渠道下已启用的模型池 ({chan.models.filter(m => m.enabled).length}/{chan.models.length}):
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {chan.models.map(m => (
                                <div
                                  key={m.id}
                                  onClick={() => setChannels(toggleChannelModel(channels, chan.id, m.id))}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    border: m.enabled ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                                    background: m.enabled ? 'var(--accent-subtle)' : 'var(--bg-base)',
                                    color: m.enabled ? 'var(--accent)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    fontFamily: 'var(--font-mono)'
                                  }}
                                >
                                  {m.enabled ? <CheckSquare size={11} /> : <Square size={11} />}
                                  <span>{m.name}</span>
                                  <span style={{ fontSize: '9px', opacity: 0.7 }}>({Math.round(m.contextLimit / 1000)}k)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Custom Channel Modal */}
                {showAddChannelModal && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 90
                  }}>
                    <div style={{
                      width: '380px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '8px',
                      padding: '16px',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.25)'
                    }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>添加自定义服务商渠道 / 中转站</h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>渠道别名:</label>
                          <input
                            type="text"
                            placeholder="例如: 硅基流动 / OpenRouter / 自建反代"
                            value={newChanName}
                            onChange={e => setNewChanName(e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Base URL (兼容 OpenAI 格式):</label>
                          <input
                            type="text"
                            placeholder="https://api.siliconflow.cn/v1"
                            value={newChanUrl}
                            onChange={e => setNewChanUrl(e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>API Key:</label>
                          <input
                            type="password"
                            placeholder="sk-..."
                            value={newChanKey}
                            onChange={e => setNewChanKey(e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => setShowAddChannelModal(false)}
                          style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}
                        >
                          取消
                        </button>
                        <button
                          onClick={handleAddCustomChannel}
                          disabled={!newChanName.trim() || !newChanUrl.trim()}
                          style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', background: 'var(--accent)', color: '#FFF', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          确认添加
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SKILLS SYSTEM */}
            {activeTab === 'skills' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700 }}>智能体专业技能库 (Agent Skills)</h3>
                  <button style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'var(--accent-subtle)',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}>
                    + 导入新 Skill
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  参考 Roo Code / Cline 模块化设计，Skill 为智能体注入领域规范，开启后可在对话中直接键入快捷指令（如 <code>/tdd</code>）。
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {skills.map(s => (
                    <div
                      key={s.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 600, fontSize: '12px' }}>{s.name}</span>
                          {s.slashCommand && (
                            <span style={{
                              fontSize: '10px',
                              fontFamily: 'var(--font-mono)',
                              background: 'rgba(0,0,0,0.06)',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              color: 'var(--text-secondary)'
                            }}>
                              {s.slashCommand}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.description}</p>
                      </div>

                      <button
                        onClick={() => setSkills(toggleSkillItem(skills, s.id))}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          border: 'none',
                          background: s.enabled ? 'var(--accent)' : 'var(--border-strong)',
                          color: '#FFF',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minWidth: '55px'
                        }}
                      >
                        {s.enabled ? '已启用' : '已禁用'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: MCP MANAGEMENT */}
            {activeTab === 'mcp' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700 }}>MCP 工具生态管理 (Model Context Protocol)</h3>
                  <button style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'var(--accent)',
                    color: '#FFF',
                    border: 'none',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}>
                    + 添加 MCP Server
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  无缝兼容 Cursor 与 Continue 标准 <code>mcpServers</code> 规约，支持本地命令行工具与远程服务即插即用。
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mcpServers.map(mcp => (
                    <div
                      key={mcp.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Server size={14} color="var(--accent)" />
                          <span style={{ fontWeight: 600, fontSize: '12px' }}>{mcp.name}</span>
                          <span style={{
                            fontSize: '9px',
                            color: mcp.status === 'connected' ? '#10B981' : 'var(--text-muted)'
                          }}>
                            ● {mcp.status === 'connected' ? '运行中 (Connected)' : '未连接'}
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{mcp.toolsCount} 个工具可用</span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {mcp.tools.map(t => (
                          <span
                            key={t}
                            style={{
                              fontSize: '9px',
                              fontFamily: 'var(--font-mono)',
                              padding: '2px 5px',
                              borderRadius: '3px',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: APPEARANCE & CUSTOM COLORS */}
            {activeTab === 'appearance' && (
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>外观与自定义主题色盘 (Appearance & Colors)</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  人体工程学护眼视觉系统，支持实时热切主题基调、品牌强调色与代码排版。
                </p>

                {/* 1. Theme Mode */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    全局界面主题模式:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setThemeMode('cream')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '6px',
                        border: themeMode === 'cream' ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                        background: '#FAF8F5',
                        color: '#1E1C1A',
                        fontWeight: 600,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      暖米白纸质 (Light Cream)
                    </button>
                    <button
                      onClick={() => setThemeMode('dark_charcoal')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '6px',
                        border: themeMode === 'dark_charcoal' ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                        background: '#1E1C1A',
                        color: '#FAF8F5',
                        fontWeight: 600,
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      暖炭黑极夜 (Dark Charcoal)
                    </button>
                  </div>
                </div>

                {/* 2. Accent Color Palette */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    品牌强调主色 (Accent Color - 实时应用):
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {ACCENT_COLOR_PRESETS.map(c => {
                      const isChosen = currentAccentHex.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <div
                          key={c.id}
                          onClick={() => onSelectAccentHex(c.hex)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: isChosen ? `2px solid ${c.hex}` : '1px solid var(--border-subtle)',
                            background: isChosen ? c.bgSubtle : 'var(--bg-surface)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: c.hex }} />
                          <span style={{ fontSize: '11px', fontWeight: isChosen ? 700 : 500, color: 'var(--text-primary)' }}>
                            {c.name}
                          </span>
                          {isChosen && <Check size={13} color={c.hex} style={{ marginLeft: 'auto' }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Editor Font & Typography */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    代码编辑器字体与字号:
                  </label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                      <option value="Cascadia Code">Cascadia Code</option>
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
                            fontSize: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          {size}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: KEYBOARD SHORTCUTS */}
            {activeTab === 'keybindings' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700 }}>自定义快捷键 (Keyboard Shortcuts)</h3>
                  <button
                    onClick={() => setKeybindings(prev => prev.map(k => ({ ...k, currentKey: k.defaultKey })))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={10} />
                    <span>恢复默认设置</span>
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  单击右侧快捷键胶囊可进入录制模式，自定义最契合肌肉记忆的操作键位。
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {keybindings.map(kb => (
                    <div
                      key={kb.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '11px' }}>{kb.actionName}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          ({kb.category})
                        </span>
                      </div>

                      {editingKbId === kb.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="text"
                            placeholder="请按下新组合键..."
                            autoFocus
                            onKeyDown={e => {
                              e.preventDefault();
                              const keys = [];
                              if (e.ctrlKey) keys.push('Ctrl');
                              if (e.altKey) keys.push('Alt');
                              if (e.shiftKey) keys.push('Shift');
                              if (!['Control', 'Alt', 'Shift'].includes(e.key)) {
                                keys.push(e.key.toUpperCase());
                                setKeybindings(updateKeybinding(keybindings, kb.id, keys.join(' + ')));
                                setEditingKbId(null);
                              }
                            }}
                            style={{
                              padding: '2px 6px',
                              borderRadius: '3px',
                              border: '1px solid var(--accent)',
                              fontSize: '10px',
                              background: 'var(--bg-base)',
                              color: 'var(--text-primary)',
                              outline: 'none'
                            }}
                          />
                          <button
                            onClick={() => setEditingKbId(null)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingKbId(kb.id)}
                          title="点击录制新按键"
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'var(--bg-base)',
                            border: '1px solid var(--border-strong)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--accent)',
                            cursor: 'pointer'
                          }}
                        >
                          {kb.currentKey}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: SYSTEM & SECURITY */}
            {activeTab === 'system' && (
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>系统与安全合规策略 (System & Security)</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  掌控物理离线阻断、自主放行权限与 Token 消耗财务警戒线。
                </p>

                {/* 1. Air-Gapped Mode */}
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: airGapped ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface)',
                  border: `1px solid ${airGapped ? '#10B981' : 'var(--border-subtle)'}`,
                  marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '12px' }}>
                      <Lock size={14} color={airGapped ? '#10B981' : 'var(--accent)'} />
                      <span>物理级纯离线断网模式 (Air-Gapped Mode)</span>
                    </div>
                    <button
                      onClick={() => setAirGapped(!airGapped)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '12px',
                        border: 'none',
                        background: airGapped ? '#10B981' : 'var(--border-strong)',
                        color: '#FFF',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {airGapped ? '已开启物理离线' : '已关闭'}
                    </button>
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    硬阻断所有外部出站网络连接，所有 AST 语法分析、推理与代码生成 100% 直连本地私有 Ollama。
                  </p>
                </div>

                {/* 2. Auto-Approve Permissions */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    自主放行安全授权策略 (Auto-Approve):
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div
                      onClick={() => setAutoApproveReads(!autoApproveReads)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}
                    >
                      <div style={{ color: autoApproveReads ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {autoApproveReads ? <CheckSquare size={14} /> : <Square size={14} />}
                      </div>
                      <span>只读操作静默放行 (读取文件、目录清单、代码 AST 检索)</span>
                    </div>

                    <div
                      onClick={() => setAutoApproveAstVerified(!autoApproveAstVerified)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px' }}
                    >
                      <div style={{ color: autoApproveAstVerified ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {autoApproveAstVerified ? <CheckSquare size={14} /> : <Square size={14} />}
                      </div>
                      <span>语法校验通过的文件落盘自动放行 (落盘前自动触发影子快照备份)</span>
                    </div>
                  </div>
                </div>

                {/* 3. Daily Budget */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Token 每日财务上限警戒线:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px' }}>$</span>
                    <input
                      type="number"
                      value={dailyTokenLimit}
                      onChange={e => setDailyTokenLimit(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '80px',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-strong)',
                        background: 'var(--bg-base)',
                        color: 'var(--text-primary)',
                        fontSize: '11px'
                      }}
                    />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      USD / 天 (超出后自动阻断高成本云端模型，降级切换至本地免费模型)
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div style={{
          height: '42px',
          borderTop: '1px solid var(--border-subtle)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)',
          fontSize: '11px'
        }}>
          <span style={{ color: 'var(--text-muted)' }}>
            CodeMind-Hub v1.0 · 配置已持久化至本地 SQLite / JSON
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '4px 16px',
              borderRadius: '4px',
              border: 'none',
              background: 'var(--accent)',
              color: '#FFF',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
