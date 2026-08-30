import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Activity,
  Copy,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ChannelItem,
  ChannelType,
  CHANNEL_PRESETS,
  getPresetForChannelType,
  resolveApiEndpoint
} from '../types/contracts';

interface ChannelMutateModalProps {
  isOpen: boolean;
  channel?: ChannelItem | null;
  onClose: () => void;
  onSave: (savedChannel: ChannelItem) => void;
}

export const ChannelMutateModal: React.FC<ChannelMutateModalProps> = ({
  isOpen,
  channel,
  onClose,
  onSave
}) => {
  const isEditing = Boolean(channel);

  const [selectedType, setSelectedType] = useState<ChannelType>(channel?.type ?? 60);
  const [name, setName] = useState(channel?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(channel?.baseUrl ?? '');
  const [key, setKey] = useState(channel?.key ?? '');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>(channel?.models ?? []);
  const [customModelInput, setCustomModelInput] = useState('');
  const [priority, setPriority] = useState<number>(channel?.priority ?? 10);
  const [weight, setWeight] = useState<number>(channel?.weight ?? 10);
  const [group, setGroup] = useState(channel?.group ?? 'default');
  const [testModel, setTestModel] = useState(channel?.testModel ?? '');
  const [remark, setRemark] = useState(channel?.remark ?? '');

  // Model Mapping Editor State
  const [modelMappingList, setModelMappingList] = useState<Array<{ from: string; to: string }>>(() => {
    if (channel?.modelMapping) {
      return Object.entries(channel.modelMapping).map(([from, to]) => ({ from, to }));
    }
    return [];
  });
  const [newMapFrom, setNewMapFrom] = useState('');
  const [newMapTo, setNewMapTo] = useState('');

  // Probe & Fetch Models State
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testToast, setTestToast] = useState<{ text: string; success: boolean } | null>(null);

  // Initialize form when opening or changing channel
  useEffect(() => {
    if (channel) {
      setSelectedType(channel.type);
      setName(channel.name);
      setBaseUrl(channel.baseUrl);
      setKey(channel.key);
      setModels(channel.models || []);
      setPriority(channel.priority ?? 10);
      setWeight(channel.weight ?? 10);
      setGroup(channel.group || 'default');
      setTestModel(channel.testModel || '');
      setRemark(channel.remark || '');
      if (channel.modelMapping) {
        setModelMappingList(Object.entries(channel.modelMapping).map(([from, to]) => ({ from, to })));
      } else {
        setModelMappingList([]);
      }
    } else {
      const preset = getPresetForChannelType(60);
      setSelectedType(60);
      setName(preset.name);
      setBaseUrl(preset.defaultBaseUrl);
      setKey('');
      setModels([...preset.recommendedModels]);
      setPriority(10);
      setWeight(10);
      setGroup('default');
      setTestModel(preset.defaultTestModel);
      setRemark('');
      setModelMappingList([]);
    }
    setTestToast(null);
  }, [channel, isOpen]);

  if (!isOpen) return null;

  const currentPreset = getPresetForChannelType(selectedType);

  const handleTypeChange = (type: ChannelType) => {
    setSelectedType(type);
    const preset = getPresetForChannelType(type);
    if (!isEditing || !name) setName(preset.name);
    setBaseUrl(preset.defaultBaseUrl);
    setTestModel(preset.defaultTestModel);
    if (!isEditing || models.length === 0) {
      setModels([...preset.recommendedModels]);
    }
  };

  const handleResetBaseUrl = () => {
    setBaseUrl(currentPreset.defaultBaseUrl);
  };

  const handleToggleModel = (m: string) => {
    if (models.includes(m)) {
      setModels(models.filter(item => item !== m));
    } else {
      setModels([...models, m]);
    }
  };

  const handleSelectAllRecommended = () => {
    const merged = Array.from(new Set([...models, ...currentPreset.recommendedModels]));
    setModels(merged);
  };

  const handleClearModels = () => {
    setModels([]);
  };

  const handleAddCustomModel = () => {
    const trimmed = customModelInput.trim();
    if (trimmed && !models.includes(trimmed)) {
      setModels([...models, trimmed]);
      setCustomModelInput('');
    }
  };

  const handleAddModelMapping = () => {
    if (newMapFrom.trim() && newMapTo.trim()) {
      setModelMappingList([...modelMappingList, { from: newMapFrom.trim(), to: newMapTo.trim() }]);
      setNewMapFrom('');
      setNewMapTo('');
    }
  };

  const handleRemoveModelMapping = (index: number) => {
    setModelMappingList(modelMappingList.filter((_, i) => i !== index));
  };

  // Real fetch models from upstream /v1/models
  const handleFetchUpstreamModels = async () => {
    if (!baseUrl.trim()) {
      setTestToast({ text: '请先填写 Base URL', success: false });
      return;
    }
    setIsFetchingModels(true);
    setTestToast(null);
    try {
      let target = baseUrl.trim();
      if (target.endsWith('/')) target = target.slice(0, -1);
      const urlWithEndpoint = target.endsWith('/models') ? target : `${target}/models`;
      const { url: fetchUrl, headers: proxyHeaders } = resolveApiEndpoint(urlWithEndpoint);

      const headers: Record<string, string> = { ...proxyHeaders };
      if (key.trim()) {
        const firstKey = key.trim().split('\n')[0].trim();
        headers['Authorization'] = `Bearer ${firstKey}`;
      }

      const res = await fetch(fetchUrl, { method: 'GET', headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      const rawList: any[] = json.data || json.models || (Array.isArray(json) ? json : []);
      if (rawList.length > 0) {
        const fetchedIds: string[] = rawList.map((m: any) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
        const merged = Array.from(new Set([...models, ...fetchedIds]));
        setModels(merged);
        setTestToast({ text: `✓ 成功从上游真实拉取并同步 ${fetchedIds.length} 个可用模型！`, success: true });
      } else {
        setTestToast({ text: '✓ 接口连通正常，但返回模型列表为空', success: true });
      }
    } catch (err: any) {
      setTestToast({ text: `✕ 拉取模型失败: ${err.message}`, success: false });
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Real test connectivity probe
  const handleTestConnectivity = async () => {
    if (!baseUrl.trim()) {
      setTestToast({ text: '请先填写 Base URL', success: false });
      return;
    }
    setIsTesting(true);
    setTestToast(null);
    const start = Date.now();
    try {
      let target = baseUrl.trim();
      if (target.endsWith('/')) target = target.slice(0, -1);
      const testUrlTarget = target.endsWith('/models') ? target : `${target}/models`;
      const { url: testUrl, headers: proxyHeaders } = resolveApiEndpoint(testUrlTarget);

      const headers: Record<string, string> = { ...proxyHeaders };
      if (key.trim()) {
        const firstKey = key.trim().split('\n')[0].trim();
        headers['Authorization'] = `Bearer ${firstKey}`;
      }

      const res = await fetch(testUrl, { method: 'GET', headers });
      const duration = Date.now() - start;
      if (res.ok) {
        setTestToast({ text: `✓ 连通性测试通过！HTTP ${res.status} OK · 响应时延 ${duration}ms`, success: true });
      } else {
        setTestToast({ text: `✕ 连通异常: HTTP ${res.status} (${res.statusText}) · 耗时 ${duration}ms`, success: false });
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      setTestToast({ text: `✕ 连接失败: ${err.message} (${duration}ms)`, success: false });
    } finally {
      setIsTesting(false);
    }
  };

  const handleFormSubmit = () => {
    if (!name.trim()) {
      setTestToast({ text: '渠道名称不能为空', success: false });
      return;
    }
    if (!baseUrl.trim()) {
      setTestToast({ text: 'Base URL 不能为空', success: false });
      return;
    }

    const mappingObj: Record<string, string> = {};
    modelMappingList.forEach(({ from, to }) => {
      if (from.trim() && to.trim()) {
        mappingObj[from.trim()] = to.trim();
      }
    });

    const updatedChannel: ChannelItem = {
      id: channel?.id ?? `chan-${Date.now()}`,
      name: name.trim(),
      type: selectedType,
      key: key.trim(),
      baseUrl: baseUrl.trim(),
      defaultBaseUrl: currentPreset.defaultBaseUrl,
      models: models.length > 0 ? models : [...currentPreset.recommendedModels],
      modelMapping: Object.keys(mappingObj).length > 0 ? mappingObj : undefined,
      status: channel?.status ?? 'active',
      responseTime: channel?.responseTime ?? 0,
      testTime: channel?.testTime,
      testModel: testModel.trim() || currentPreset.defaultTestModel,
      priority: Number(priority) || 0,
      weight: Number(weight) || 10,
      group: group.trim() || 'default',
      remark: remark.trim() || undefined
    };

    onSave(updatedChannel);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1300
      }}
    >
      <div
        style={{
          width: '740px',
          maxWidth: '94vw',
          maxHeight: '88vh',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.36)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{currentPreset.icon}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isEditing ? `编辑渠道 · ${channel?.name}` : '新建大模型服务商渠道 (New-API Architecture)'}
              </h3>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                对齐 New-API 标准渠道规范 · 支持多 Key 轮询、模型重映射与权重路由
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
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

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Toast feedback */}
          {testToast && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: testToast.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${testToast.success ? '#10B981' : '#EF4444'}`,
                color: testToast.success ? '#10B981' : '#EF4444',
                fontSize: '11.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {testToast.text}
            </div>
          )}

          {/* 1. Channel Type Selection */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              渠道类型 (Channel Type):
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {CHANNEL_PRESETS.map(preset => {
                const isSelected = selectedType === preset.type;
                return (
                  <button
                    key={preset.type}
                    type="button"
                    onClick={() => handleTypeChange(preset.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 9px',
                      borderRadius: '6px',
                      border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-base)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: isSelected ? 700 : 500,
                      textAlign: 'left',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>{preset.icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Basic Info (Name, Base URL, API Key) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                渠道名称 (Name) *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例如: DeepSeek 官方主力"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 9px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Base URL (上游接口端点) *
                </label>
                <button
                  type="button"
                  onClick={handleResetBaseUrl}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--accent)',
                    fontSize: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  <RotateCcw size={10} /> 官方默认
                </button>
              </div>
              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder={currentPreset.defaultBaseUrl}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 9px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* API Key */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                API 密钥 (Key) - 支持多 Key 换行录入实现轮询负载均衡
              </label>
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                {showKey ? <EyeOff size={11} /> : <Eye size={11} />} {showKey ? '隐藏密钥' : '明文显示'}
              </button>
            </div>
            <textarea
              rows={2}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="请输入 API 密钥 (若有多个 Key，请换行输入，系统将自动加权轮询)"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 9px',
                borderRadius: '5px',
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                resize: 'none',
                ...(showKey ? {} : { WebkitTextSecurity: 'disc' } as any)
              }}
            />
          </div>

          {/* 3. Models Whitelist & Live Fetch */}
          <div style={{ padding: '12px', borderRadius: '7px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={13} color="var(--accent)" />
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  已选可用模型 ({models.length} 个)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleFetchUpstreamModels}
                  disabled={isFetchingModels}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--accent)',
                    background: 'var(--accent-subtle)',
                    color: 'var(--accent)',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RotateCcw size={10} className={isFetchingModels ? 'animate-spin' : ''} />
                  {isFetchingModels ? '正在拉取...' : '🔄 真实拉取模型 (/v1/models)'}
                </button>

                <button
                  type="button"
                  onClick={handleSelectAllRecommended}
                  style={{
                    padding: '3px 7px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-secondary)',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  全选推荐
                </button>

                <button
                  type="button"
                  onClick={handleClearModels}
                  style={{
                    padding: '3px 7px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-muted)',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  清空
                </button>
              </div>
            </div>

            {/* Model Badges Grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '110px', overflowY: 'auto', marginBottom: '8px', padding: '4px', background: 'var(--bg-base)', borderRadius: '5px', border: '1px solid var(--border-subtle)' }}>
              {Array.from(new Set([...currentPreset.recommendedModels, ...models])).map(m => {
                const isChecked = models.includes(m);
                return (
                  <div
                    key={m}
                    onClick={() => handleToggleModel(m)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '10.5px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: isChecked ? 'var(--accent)' : 'var(--bg-surface)',
                      color: isChecked ? '#FFF' : 'var(--text-secondary)',
                      border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                      fontWeight: isChecked ? 600 : 400
                    }}
                  >
                    {isChecked && <Check size={10} />}
                    <span>{m}</span>
                  </div>
                );
              })}
            </div>

            {/* Add Custom Model */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="输入自定义模型 ID (如 gpt-4o-custom) 按回车添加..."
                value={customModelInput}
                onChange={e => setCustomModelInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomModel();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={handleAddCustomModel}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Plus size={11} /> 添加
              </button>
            </div>
          </div>

          {/* 4. Model Mapping (Model Redirection) */}
          <div style={{ padding: '10px 12px', borderRadius: '7px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                🔀 模型重映射 (Model Mapping) - 将请求的模型名自动重定向为上游专有模型名
              </div>
              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>例: gpt-4o ➔ claude-3-7-sonnet</span>
            </div>

            {modelMappingList.map((mapItem, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-base)', padding: '2px 6px', borderRadius: '3px', border: '1px solid var(--border-subtle)', flex: 1 }}>
                  {mapItem.from}
                </span>
                <ArrowRight size={11} color="var(--text-muted)" />
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'var(--bg-base)', padding: '2px 6px', borderRadius: '3px', border: '1px solid var(--border-subtle)', flex: 1, color: 'var(--accent)' }}>
                  {mapItem.to}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveModelMapping(idx)}
                  style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="text"
                placeholder="原始请求模型 (如 gpt-4)"
                value={newMapFrom}
                onChange={e => setNewMapFrom(e.target.value)}
                style={{ flex: 1, padding: '4px 6px', fontSize: '10.5px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
              />
              <input
                type="text"
                placeholder="重定向目标模型 (如 deepseek-chat)"
                value={newMapTo}
                onChange={e => setNewMapTo(e.target.value)}
                style={{ flex: 1, padding: '4px 6px', fontSize: '10.5px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none' }}
              />
              <button
                type="button"
                onClick={handleAddModelMapping}
                style={{ padding: '3px 8px', borderRadius: '4px', background: 'var(--accent)', color: '#FFF', border: 'none', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                + 添加映射
              </button>
            </div>
          </div>

          {/* 5. Priority, Weight, Group & Test Model */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                优先级 (Priority)
              </label>
              <input
                type="number"
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                placeholder="10"
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '11px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                权重 (Weight)
              </label>
              <input
                type="number"
                value={weight}
                onChange={e => setWeight(Number(e.target.value))}
                placeholder="10"
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '11px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                分组 (Group)
              </label>
              <input
                type="text"
                value={group}
                onChange={e => setGroup(e.target.value)}
                placeholder="default"
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '11px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                测试模型 (Test Model)
              </label>
              <input
                type="text"
                value={testModel}
                onChange={e => setTestModel(e.target.value)}
                placeholder={currentPreset.defaultTestModel}
                style={{ width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: '4px', border: '1px solid var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '11px' }}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button
            type="button"
            onClick={handleTestConnectivity}
            disabled={isTesting}
            style={{
              padding: '6px 12px',
              borderRadius: '5px',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Activity size={12} color="var(--accent)" />
            {isTesting ? '正在探测...' : '🧪 测试连通性'}
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 14px',
                borderRadius: '5px',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>

            <button
              type="button"
              onClick={handleFormSubmit}
              style={{
                padding: '6px 18px',
                borderRadius: '5px',
                background: 'var(--accent)',
                border: 'none',
                color: '#FFF',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Check size={12} />
              {isEditing ? '保存修改' : '创建渠道'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
