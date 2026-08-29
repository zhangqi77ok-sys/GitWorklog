import React, { useState } from 'react';
import {
  Send,
  Shield,
  Paperclip,
  ScrollText,
  X as XIcon,

  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Sparkles,
  Cpu,
  Check,
  Compass,
  FileCode
} from 'lucide-react';
import {
  SessionItem,
  ChatMessage,
  AttachedFile,
  RuleItem,
  INITIAL_RULES,
  getActiveRules,

  WorkMode,
  PermissionPolicy,
  AIModelOption,
  AVAILABLE_MODELS
} from '../types/contracts';
import { OptionsCard } from './OptionsCard';

interface ChatColumnProps {
  rightWorkspaceOpen: boolean;
  onToggleWorkspace: () => void;
  style?: React.CSSProperties;
  session: SessionItem;
  messages: ChatMessage[];
  workMode: WorkMode;
  setWorkMode: (mode: WorkMode) => void;
  currentModel: AIModelOption;
  onSelectModel: (model: AIModelOption) => void;
  permissionPolicy: PermissionPolicy;
  setPermissionPolicy: (p: PermissionPolicy) => void;
  onSendMessage: (text: string) => void;
  onResolveOptions: (messageId: string, selectedIds: string[], customInput?: string) => void;
}

export const ChatColumn: React.FC<ChatColumnProps> = ({
  rightWorkspaceOpen,
  onToggleWorkspace,
  style,
  session,
  messages,
  workMode,
  setWorkMode,
  currentModel,
  onSelectModel,
  permissionPolicy,
  setPermissionPolicy,
  onSendMessage,
  onResolveOptions
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showRulesPopover, setShowRulesPopover] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const activeRules = getActiveRules(INITIAL_RULES);

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      const files = Array.from(e.clipboardData.files);
      const newItems: AttachedFile[] = files.map(f => ({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        name: f.name || 'clipboard-file',
        size: f.size,
        type: f.type
      }));
      setAttachedFiles(prev => [...prev, ...newItems]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newItems: AttachedFile[] = files.map(f => ({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        name: f.name,
        size: f.size,
        type: f.type
      }));
      setAttachedFiles(prev => [...prev, ...newItems]);
    }
  };

  const [planExpanded, setPlanExpanded] = useState(workMode === 'plan');

  // Popover states for unified mode button and model selector button
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const renderTier1Badge = () => {
    if (session.tier1 === 'global') {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <span>🌐 <strong>全局自由会话</strong> · 无项目边界约束</span>
          <span style={{ color: 'var(--accent)', cursor: 'pointer' }}>➕ 关联到工程</span>
        </div>
      );
    }
    if (session.tier1 === 'project') {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'rgba(217, 107, 39, 0.08)',
          borderBottom: '1px solid rgba(217, 107, 39, 0.2)',
          fontSize: '11px',
          color: 'var(--accent)'
        }}>
          <span>📁 <strong>工程作用域</strong>: {session.projectName || 'agent-learning'} (🌿 {session.gitBranch || 'main'})</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AST 骨架已载入</span>
            <button
              onClick={onToggleWorkspace}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: rightWorkspaceOpen ? 'rgba(217, 107, 39, 0.1)' : 'var(--accent)',
                color: rightWorkspaceOpen ? 'var(--accent)' : '#FFF',
                border: 'none',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <FileCode size={11} />
              <span>{rightWorkspaceOpen ? '收起工作台' : '◫ 打开工作台 (4:6终端)'}</span>
            </button>
          </div>
        </div>
      );
    }
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        background: 'rgba(37, 99, 235, 0.08)',
        borderBottom: '1px solid rgba(37, 99, 235, 0.2)',
        fontSize: '11px',
        color: '#2563EB'
      }}>
        <span>📄 <strong>文件专精</strong>: {session.filePath || 'src/bus/GatewayBus.ts'}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>单文件重构 (立省80% Token)</span>
      </div>
    );
  };

  return (
    <div style={{
      flex: rightWorkspaceOpen ? '0 0 45%' : 1,
      minWidth: '320px',
      maxWidth: rightWorkspaceOpen ? '700px' : 'none',
      height: 'calc(100vh - 38px)',
      background: 'var(--bg-surface-elevated)',
      borderRight: rightWorkspaceOpen ? '1px solid var(--border-subtle)' : 'none',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      transition: 'all 0.2s ease',
      ...style
    }}>
      {/* Pinned Scope Badge */}
      {renderTier1Badge()}

      {/* Task Plan Breathing Capsule */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        transition: 'all 0.2s ease'
      }}>
        <div
          onClick={() => setPlanExpanded(!planExpanded)}
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent)'
            }} />
            <span>📋 2/4 正在执行: 编写 Store 契约与前置测试 (50%)</span>
          </div>
          {planExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>

        {planExpanded && (
          <div style={{ padding: '6px 12px 10px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16A34A' }}>
              <CheckCircle size={13} />
              <span style={{ textDecoration: 'line-through' }}>1. 扫描项目 AST 符号依赖关系并生成雷达</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 600 }}>
              <Clock size={13} />
              <span>2. 编写 Store 契约与前置失败测试 (Red Testing)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <span style={{ width: '13px', textAlign: 'center' }}>○</span>
              <span>3. 生成原子级 Unified Patch 并执行落盘</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <span style={{ width: '13px', textAlign: 'center' }}>○</span>
              <span>4. 执行全套测试治具验证 (Green Passed)</span>
            </div>
          </div>
        )}
      </div>

      {/* Messages Stream Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ marginBottom: '14px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '4px',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}>
              <span style={{ fontWeight: 600, color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--accent)' }}>
                {msg.role === 'user' ? '开发者 (You)' : 'CodeMind 智能体'}
              </span>
              <span>· {new Date(msg.timestamp).toLocaleTimeString()}</span>
              {msg.auditTag && (
                <span style={{ padding: '1px 5px', borderRadius: '3px', background: 'var(--accent-subtle)', color: 'var(--accent)', fontSize: '10px' }}>
                  {msg.auditTag}
                </span>
              )}
            </div>

            <div style={{
              padding: '10px 12px',
              borderRadius: '6px',
              background: msg.role === 'user' ? 'var(--bg-surface)' : 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12px',
              lineHeight: 1.6
            }}>
              {msg.content}
            </div>

            {msg.optionsPayload && (
              <OptionsCard
                payload={msg.optionsPayload}
                onConfirm={(selectedIds, customInput) => onResolveOptions(msg.id, selectedIds, customInput)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Bottom Controls & Input Area */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        position: 'relative'
      }}>
        {/* ========================================================= */}
        {/* 1. TOP TOOLBAR: Fused Mode Selector + Model Switcher + Perm */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>

            {/* 1.1 Fused Mode Button (Default Act, Popover on click) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setShowModeMenu(!showModeMenu);
                  setShowModelMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: workMode === 'act' ? 'var(--accent)' : '#6366F1',
                  color: '#FFF',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                {workMode === 'act' ? <Zap size={12} /> : <Compass size={12} />}
                <span>{workMode === 'act' ? '⚡ Act 落地模式' : '📐 Plan 规划模式'}</span>
                <ChevronDown size={12} />
              </button>

              {/* Mode Selection Popover Dropdown */}
              {showModeMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: '30px',
                  left: '0',
                  width: '240px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '6px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                  padding: '6px',
                  zIndex: 100
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 6px', fontWeight: 600 }}>
                    选择智能体执行策略
                  </div>
                  {/* Act Option (Default) */}
                  <div
                    onClick={() => {
                      setWorkMode('act');
                      setShowModeMenu(false);
                    }}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: workMode === 'act' ? 'var(--accent-subtle)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                      marginBottom: '2px'
                    }}
                  >
                    <Zap size={14} color="var(--accent)" style={{ marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--accent)' }}>⚡ Act 落地模式</span>
                        <span style={{ fontSize: '9px', background: 'rgba(217, 107, 39, 0.15)', color: 'var(--accent)', padding: '0 4px', borderRadius: '3px' }}>默认</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>直接修改代码、落盘补丁并执行自动化测试治具验证</div>
                    </div>
                    {workMode === 'act' && <Check size={12} color="var(--accent)" style={{ marginTop: '2px' }} />}
                  </div>

                  {/* Plan Option */}
                  <div
                    onClick={() => {
                      setWorkMode('plan');
                      setShowModeMenu(false);
                    }}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: workMode === 'plan' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px'
                    }}
                  >
                    <Compass size={14} color="#6366F1" style={{ marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '11px', color: '#6366F1' }}>📐 Plan 规划模式</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>深度解析工程架构并制定计划，严禁修改任何代码</div>
                    </div>
                    {workMode === 'plan' && <Check size={12} color="#6366F1" style={{ marginTop: '2px' }} />}
                  </div>
                </div>
              )}
            </div>

            {/* 1.2 Model Switcher Button (Click to popover, Auto switch) */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setShowModelMenu(!showModelMenu);
                  setShowModeMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <Cpu size={12} color="var(--accent)" />
                <span>{currentModel.name}</span>
                <span style={{ fontSize: '9px', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '0 3px', borderRadius: '2px' }}>
                  {currentModel.badge || currentModel.provider}
                </span>
                <ChevronDown size={11} color="var(--text-muted)" />
              </button>

              {/* Model Switcher Popover Dropdown */}
              {showModelMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: '30px',
                  left: '0',
                  width: '280px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '6px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                  padding: '6px',
                  zIndex: 100,
                  maxHeight: '320px',
                  overflowY: 'auto'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 6px', fontWeight: 600 }}>
                    选择底层推理大模型 (点击自动热切)
                  </div>

                  {AVAILABLE_MODELS.map(model => {
                    const isSelected = model.id === currentModel.id;
                    return (
                      <div
                        key={model.id}
                        onClick={() => {
                          onSelectModel(model);
                          setShowModelMenu(false);
                        }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '4px',
                          background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '2px'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: isSelected ? 600 : 500, fontSize: '11px', color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                              {model.name}
                            </span>
                            {model.badge && (
                              <span style={{
                                fontSize: '9px',
                                padding: '1px 4px',
                                borderRadius: '2px',
                                background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.06)',
                                color: isSelected ? '#FFF' : 'var(--text-muted)'
                              }}>
                                {model.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {model.description} · 上限 {Math.round(model.contextLimit / 1000)}k tokens
                          </div>
                        </div>
                        {isSelected && <Check size={14} color="var(--accent)" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

            {/* 1.2.2 File Upload & Attach Button */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="上传文件或从剪贴板粘贴 (支持代码、图片、文档)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '4px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              <Paperclip size={12} color="var(--accent)" />
              <span>上传文件/粘贴</span>
            </button>

            {/* 1.2.3 Rule Rules Preload Indicator Pill */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowRulesPopover(!showRulesPopover)}
                title="查看当前问答前置加载的顶层规则"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(217, 107, 39, 0.08)',
                  border: '1px solid rgba(217, 107, 39, 0.25)',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <ScrollText size={12} />
                <span>📜 {activeRules.length}条规则前置加载 ▾</span>
              </button>

              {/* Rules Popover */}
              {showRulesPopover && (
                <div style={{
                  position: 'absolute',
                  bottom: '30px',
                  left: 0,
                  width: '320px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '6px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  padding: '10px',
                  zIndex: 80,
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>已生效的顶层 System Rules</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>先行注入 Prompt</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {activeRules.map(r => (
                      <div key={r.id} style={{ padding: '4px 6px', background: 'var(--bg-surface)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                          ● {r.title}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {r.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          {/* 1.3 Dual-Track Permission Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              cursor: 'pointer'
            }}
            onClick={() => {
              if (permissionPolicy === 'strict_approval') setPermissionPolicy('autonomous_agent');
              else if (permissionPolicy === 'autonomous_agent') setPermissionPolicy('risk_adaptive');
              else setPermissionPolicy('strict_approval');
            }}
          >
            <Shield size={12} color="var(--accent)" />
            <span>
              {permissionPolicy === 'strict_approval' && '🛡️ 逐次审核'}
              {permissionPolicy === 'autonomous_agent' && '🤖 智能自决'}
              {permissionPolicy === 'risk_adaptive' && '⚡ 风险熔断'}
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. INPUT BOX                                              */}
        {/* ========================================================= */}
        {/* Attached Files Chips Bar */}
        {attachedFiles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            {attachedFiles.map(f => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'var(--accent-subtle)',
                  border: '1px solid rgba(217, 107, 39, 0.3)',
                  color: 'var(--accent)',
                  fontSize: '11px',
                  fontWeight: 500
                }}
              >
                <Paperclip size={11} />
                <span>{f.name} ({(f.size / 1024).toFixed(1)}KB)</span>
                <XIcon
                  size={12}
                  style={{ cursor: 'pointer', marginLeft: '2px' }}
                  onClick={() => setAttachedFiles(prev => prev.filter(item => item.id !== f.id))}
                />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            placeholder={
              workMode === 'plan'
                ? `[${currentModel.name} · Plan模式] 请输入指令，AI 将进行纯分析与架构规划（不写盘）...`
                : `[${currentModel.name} · Act模式] 请输入需求，AI 将落地修改代码并执行测试自纠...`
            }
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-surface-elevated)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              resize: 'none',
              outline: 'none'
            }}
          />
          <button
            onClick={handleSend}
            style={{
              width: '42px',
              borderRadius: '6px',
              background: 'var(--accent)',
              border: 'none',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
