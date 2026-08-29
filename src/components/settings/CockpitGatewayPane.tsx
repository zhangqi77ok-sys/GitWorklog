import React, { useState, useEffect } from "react";
import {
  Server,
  Plus,
  Zap,
  Eye,
  EyeOff,
  Edit3,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  Download,
  Terminal,
  Activity
} from "lucide-react";
import { LLMChannel, ProtocolType, ModelMeta } from "../../types";
import { llmConfigService, DEFAULT_CHANNELS } from "../../services/llmConfigService";
import { detectOpenCodeLocalServer, OPENCODE_DEFAULT_PORT } from "../../services/opencodeService";
import { OpenCodeInstallModal } from "../opencode/OpenCodeInstallModal";

interface EditModalState {
  isOpen: boolean;
  isNew: boolean;
  channel: LLMChannel;
}

interface CockpitGatewayPaneProps {
  activeSubTab?: string;
  onNavigateSubTab?: (tab: string) => void;
}

export const CockpitGatewayPane: React.FC<CockpitGatewayPaneProps> = ({
  activeSubTab = "dashboard",
  onNavigateSubTab,
}) => {
  const [channels, setChannels] = useState<LLMChannel[]>([]);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null);
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<
    Record<string, { ok: boolean; latency: number; error?: string; balance?: string }>
  >({});

  // 编辑/新增模态框状态
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    isNew: false,
    channel: DEFAULT_CHANNELS[0],
  });
  const [newModelInput, setNewModelInput] = useState("");
  const [modalTestStatus, setModalTestStatus] = useState<{
    loading: boolean;
    msg?: string;
    ok?: boolean;
  } | null>(null);
  const [modalSyncStatus, setModalSyncStatus] = useState<{
    loading: boolean;
    msg?: string;
    ok?: boolean;
  } | null>(null);

  // OpenCode 动态服务检测与安装向导
  const [isDetectingOpenCode, setIsDetectingOpenCode] = useState(false);
  const [openCodeDetectResult, setOpenCodeDetectResult] = useState<string | null>(null);
  const [isOpenCodeInstallModalOpen, setIsOpenCodeInstallModalOpen] = useState(false);

  const loadData = () => {
    const chs = llmConfigService.getChannels();
    setChannels(chs);
  };

  useEffect(() => {
    loadData();
    window.addEventListener("llm-config-updated", loadData);
    return () => window.removeEventListener("llm-config-updated", loadData);
  }, []);

  const handleCopyKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // 全量渠道并发批量测速
  const [isTestingAll, setIsTestingAll] = useState(false);

  const handleTestAllChannels = async () => {
    setIsTestingAll(true);
    const promises = channels.map(async (c) => {
      const res = await llmConfigService.testChannelConnectivity(c);
      return { id: c.id, res };
    });
    const results = await Promise.allSettled(promises);
    const newTestResults: Record<string, { ok: boolean; latency: number; error?: string }> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        newTestResults[r.value.id] = {
          ok: r.value.res.ok,
          latency: r.value.res.latency || 0,
          error: r.value.res.error,
        };
      }
    }
    setTestResult((prev) => ({ ...prev, ...newTestResults }));
    setIsTestingAll(false);
    loadData();
  };

  // 渠道列表中触发测试
  const handleTestChannel = async (channel: LLMChannel) => {
    setTestingChannelId(channel.id);
    const res = await llmConfigService.testChannelConnectivity(channel);
    setTestingChannelId(null);
    setTestResult((prev) => ({
      ...prev,
      [channel.id]: {
        ok: res.ok,
        latency: res.latency || 0,
        error: res.error,
      },
    }));
    loadData();
  };

  // 渠道列表中触发模型同步
  const handleSyncModels = async (channel: LLMChannel) => {
    setSyncingChannelId(channel.id);
    const res = await llmConfigService.syncModelsFromEndpoint(channel);
    setSyncingChannelId(null);
    if (res.ok) {
      alert(`🎉 成功从端点同步 ${res.count} 个可用模型！`);
      loadData();
    } else {
      alert(`❌ 模型同步失败: ${res.error}`);
    }
  };

  // 打开编辑模态框
  const handleOpenEdit = (channel: LLMChannel, isNew = false) => {
    setModalTestStatus(null);
    setModalSyncStatus(null);
    setOpenCodeDetectResult(null);

    const safeChannel: LLMChannel = {
      ...channel,
      relayMode: channel.relayMode || "direct",
      newApiChannelId: channel.newApiChannelId || "",
      sub2ApiUrl: channel.sub2ApiUrl || "",
    };

    setEditModal({
      isOpen: true,
      isNew,
      channel: safeChannel,
    });
  };

  // 保存模态框配置
  const handleSaveModal = () => {
    const target = { ...editModal.channel };
    llmConfigService.addOrUpdateChannel(target);
    setEditModal((prev) => ({ ...prev, isOpen: false }));
    loadData();
  };

  // 模态框内即时测速
  const handleModalTest = async () => {
    setModalTestStatus({ loading: true });
    const res = await llmConfigService.testChannelConnectivity(editModal.channel);
    setModalTestStatus({
      loading: false,
      ok: res.ok,
      msg: res.ok
        ? `🎉 连通正常！真实响应延迟: ${res.latency} ms`
        : `🔴 连接失败: ${res.error || "请检查网络或 API Key"}`,
    });
    if (res.ok) {
      const updated = llmConfigService.getChannels().find((c) => c.id === editModal.channel.id);
      if (updated) {
        setEditModal((prev) => ({ ...prev, channel: updated }));
      }
    }
  };

  // 模态框内即时同步模型
  const handleModalSync = async () => {
    setModalSyncStatus({ loading: true });
    const res = await llmConfigService.syncModelsFromEndpoint(editModal.channel);
    setModalSyncStatus({
      loading: false,
      ok: res.ok,
      msg: res.ok
        ? `🎉 成功从官方中枢与端点同步 ${res.count} 个可用模型！`
        : `🔴 同步失败: ${res.error}`,
    });
    if (res.ok) {
      const updated = llmConfigService.getChannels().find((c) => c.id === editModal.channel.id);
      if (updated) {
        setEditModal((prev) => ({ ...prev, channel: updated }));
      }
    }
  };

  // 探测 OpenCode 本地服务状态 (默认端口 4096)
  const handleDetectOpenCode = async (port?: number) => {
    setIsDetectingOpenCode(true);
    setOpenCodeDetectResult(null);
    const targetPort = port || OPENCODE_DEFAULT_PORT;
    const res = await detectOpenCodeLocalServer(targetPort);
    setIsDetectingOpenCode(false);
    if (res.running) {
      setOpenCodeDetectResult(`🎉 ${res.message}`);
      if (res.models && res.models.length > 0) {
        setEditModal((prev) => ({
          ...prev,
          channel: {
            ...prev.channel,
            models: Array.from(new Set([...prev.channel.models, ...res.models!])),
          },
        }));
      }
    } else {
      setOpenCodeDetectResult(`⚠️ ${res.message}。请在终端执行 'opencode serve'`);
    }
  };

  // 添加自定义模型
  const handleAddCustomModel = () => {
    if (!newModelInput.trim()) return;
    const modelId = newModelInput.trim();
    const currentModels = editModal.channel.models || [];
    const currentMetas = editModal.channel.modelMetas || [];

    if (!currentModels.includes(modelId)) {
      const newMeta: ModelMeta = {
        id: modelId,
        name: modelId,
        contextWindow: 128000,
        supportsThinking: modelId.includes("r1") || modelId.includes("reasoner") || modelId.includes("o1"),
        custom: true,
      };
      setEditModal({
        ...editModal,
        channel: {
          ...editModal.channel,
          models: [...currentModels, modelId],
          modelMetas: [...currentMetas, newMeta],
        },
      });
    }
    setNewModelInput("");
  };

  // 过滤展示的渠道
  const filteredChannels = channels.filter((c) => {
    if (activeSubTab === "dashboard" || activeSubTab === "relay") return true;
    if (activeSubTab === "opencode") return c.type === "opencode" || c.id.includes("opencode");
    if (activeSubTab === "codex") return c.type === "codex" || c.id.includes("codex");
    if (activeSubTab === "claude") return c.type === "anthropic" || c.id.includes("claude");
    if (activeSubTab === "bailian") return c.type === "bailian" || c.id.includes("bailian") || c.name.includes("阿里百炼");
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#faf9f8] overflow-y-auto">
      {/* 顶部总览状态条 */}
      <div className="px-6 py-4 bg-white border-b border-[#e5dfd8] flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-base font-bold text-[#1e1b18] flex items-center gap-2">
            <Server size={18} className="text-[#d96b27]" />
            <span>AI 编程引擎与多渠道调度中心 (Engines & Relays)</span>
          </h2>
          <p className="text-xs text-[#645e57]">
            基于「总线 - 子线 (Bus-Subline)」积木式架构 · 支持 OpenCode、Codex、Claude、阿里百炼 · 官方直连 / NewAPI / sub2api 中转
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateSubTab && (
            <button
              onClick={() => onNavigateSubTab("dashboard")}
              className="px-2.5 py-1.5 rounded-lg border border-[#e5dfd8] text-xs font-semibold text-[#645e57] hover:bg-[#f1f5f9] flex items-center gap-1 cursor-pointer"
            >
              <Activity size={12} />
              <span>总览看板</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleTestAllChannels}
            disabled={isTestingAll}
            className="px-3 py-1.5 bg-white hover:bg-[#f1f5f9] border border-[#fed7aa] rounded-lg text-xs font-semibold text-[#d96b27] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            title="一键并发批量探测所有渠道的连通延迟"
          >
            <Zap size={13} className={isTestingAll ? "animate-spin text-[#d96b27]" : "text-[#d96b27]"} />
            <span>{isTestingAll ? "全量测速中..." : "⚡ 批量测速 (Ping All)"}</span>
          </button>

          <button
            onClick={() =>
              handleOpenEdit(
                {
                  id: `chan-custom-${Date.now()}`,
                  name: "新建大模型渠道",
                  type: "openai",
                  baseUrl: "https://api.openai.com/v1",
                  apiKey: "",
                  relayMode: "direct",
                  models: ["gpt-4o"],
                  modelMetas: [{ id: "gpt-4o", name: "GPT-4o", contextWindow: 128000 }],
                  compressionThreshold: 0.95,
                  status: "active",
                  icon: "openai",
                },
                true
              )
            }
            className="bg-[#d96b27] hover:bg-[#b85417] text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
          >
            <Plus size={14} />
            <span>添加新渠道</span>
          </button>
        </div>
      </div>

      {/* 渠道卡片列表 */}
      <div className="p-6 flex flex-col gap-4">
        {filteredChannels.map((channel) => {
          const isCurrentActive = llmConfigService.getConfig().activeChannelId === channel.id;
          const ping = testResult[channel.id];

          return (
            <div
              key={channel.id}
              className={`bg-white rounded-xl border p-4.5 flex flex-col gap-3 transition-all ${
                isCurrentActive
                  ? "border-[#d96b27] shadow-sm ring-1 ring-[#d96b27]/20"
                  : "border-[#e5dfd8] hover:border-[#cbd5e1]"
              }`}
            >
              {/* 卡片头部 */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#f4efea] flex items-center justify-center font-bold text-sm text-[#d96b27]">
                    {channel.type === "opencode"
                      ? "💻"
                      : channel.type === "codex"
                      ? "🤖"
                      : channel.type === "anthropic"
                      ? "🧠"
                      : channel.type === "bailian"
                      ? "☁️"
                      : "⚡"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#1e1b18]">{channel.name}</span>
                      {isCurrentActive && (
                        <span className="text-[10px] font-bold text-[#d96b27] bg-[#fef0e7] px-2 py-0.5 rounded-full border border-[#fbd3bc]">
                          当前激活引擎
                        </span>
                      )}
                      <span className="text-[10px] font-mono bg-[#f1f5f9] text-[#645e57] px-2 py-0.5 rounded">
                        模式: {channel.relayMode === "newapi" ? "NewAPI 中转" : channel.relayMode === "sub2api" ? "sub2api 网关" : "官方直连"}
                      </span>
                    </div>
                    <div className="text-xs text-[#9c948a] font-mono mt-0.5">
                      端点: {channel.baseUrl}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {channel.type === "opencode" && (
                    <button
                      onClick={() => setIsOpenCodeInstallModalOpen(true)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] text-xs font-semibold text-[#059669] hover:bg-[#d1fae5] flex items-center gap-1 cursor-pointer transition-colors"
                      title="打开 OpenCode 本地安装向导"
                    >
                      <Terminal size={12} />
                      <span>安装部署向导</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleTestChannel(channel)}
                    disabled={testingChannelId === channel.id}
                    className="px-2.5 py-1.5 rounded-lg border border-[#e5dfd8] text-xs font-semibold text-[#645e57] hover:bg-[#f1f5f9] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw size={12} className={testingChannelId === channel.id ? "animate-spin" : ""} />
                    <span>{testingChannelId === channel.id ? "测速中..." : "测试连接 (Ping)"}</span>
                  </button>

                  <button
                    onClick={() => handleSyncModels(channel)}
                    disabled={syncingChannelId === channel.id}
                    className="px-2.5 py-1.5 rounded-lg border border-[#e5dfd8] text-xs font-semibold text-[#645e57] hover:bg-[#f1f5f9] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Download size={12} className={syncingChannelId === channel.id ? "animate-spin" : ""} />
                    <span>{syncingChannelId === channel.id ? "同步中..." : "同步模型"}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(channel)}
                    className="p-1.5 rounded-lg border border-[#e5dfd8] text-[#645e57] hover:bg-[#f1f5f9] cursor-pointer transition-colors"
                    title="编辑渠道配置"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>

              {/* 测速结果显示 */}
              {ping && (
                <div
                  className={`text-xs px-3 py-1.5 rounded-lg font-mono flex items-center gap-2 ${
                    ping.ok ? "bg-[#ecfdf5] text-[#10b981]" : "bg-[#fee2e2] text-[#ef4444]"
                  }`}
                >
                  {ping.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  <span>{ping.ok ? `连通成功 · 延迟: ${ping.latency} ms` : `连接失败: ${ping.error}`}</span>
                </div>
              )}

              {/* 模型标签预览 */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#f4efea]">
                <span className="text-[11px] text-[#9c948a] mr-1">可用模型 ({channel.models.length}):</span>
                {channel.models.slice(0, 8).map((m) => (
                  <span
                    key={m}
                    className="text-[11px] font-mono px-2 py-0.5 bg-[#f4efea] text-[#645e57] rounded"
                  >
                    {m}
                  </span>
                ))}
                {channel.models.length > 8 && (
                  <span className="text-[11px] text-[#9c948a] font-mono">
                    +{channel.models.length - 8} 更多
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 编辑渠道配置模态框 */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[1100] flex items-center justify-center animate-in fade-in duration-150">
          <div className="w-[780px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-[#e5dfd8] flex flex-col overflow-hidden">
            {/* 弹窗标题 */}
            <div className="px-6 py-4 bg-white border-b border-[#e5dfd8] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚙️</span>
                <div>
                  <h3 className="font-bold text-sm text-[#1e1b18]">
                    {editModal.isNew ? "新建渠道与引擎配置" : `编辑渠道配置: ${editModal.channel.name}`}
                  </h3>
                  <p className="text-xs text-[#9c948a]">独立配置 · 积木式总线隔离 · 杜绝厂商属性污染</p>
                </div>
              </div>
              <button
                onClick={() => setEditModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#645e57] hover:bg-[#f1f5f9] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
              {/* 基础信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1e1b18] mb-1">渠道名称:</label>
                  <input
                    type="text"
                    value={editModal.channel.name}
                    onChange={(e) =>
                      setEditModal((prev) => ({
                        ...prev,
                        channel: { ...prev.channel, name: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 bg-white border border-[#e5dfd8] rounded-lg text-xs font-semibold text-[#1e1b18] outline-none focus:border-[#d96b27]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1e1b18] mb-1">协议接口格式:</label>
                  <select
                    value={editModal.channel.type}
                    onChange={(e) =>
                      setEditModal((prev) => ({
                        ...prev,
                        channel: { ...prev.channel, type: e.target.value as ProtocolType },
                      }))
                    }
                    className="w-full px-3 py-2 bg-white border border-[#e5dfd8] rounded-lg text-xs font-semibold text-[#1e1b18] outline-none focus:border-[#d96b27] cursor-pointer"
                  >
                    <option value="opencode">OpenCode 协议 (本地 4096 / models.dev)</option>
                    <option value="codex">OpenAI Codex 协议 (代码增强标准)</option>
                    <option value="anthropic">Claude / Anthropic 原生协议</option>
                    <option value="bailian">阿里百炼 (DashScope / 通义千问)</option>
                    <option value="openai">通用 OpenAI 兼容协议</option>
                    <option value="ollama">Ollama 本地大模型协议</option>
                  </select>
                </div>
              </div>

              {/* OpenCode 专属检测提示 */}
              {editModal.channel.type === "opencode" && (
                <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Terminal size={15} className="text-[#059669]" />
                    <span className="text-xs text-[#065f46]">
                      OpenCode 本地服务探测 (默认监听端口 4096)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDetectOpenCode()}
                      disabled={isDetectingOpenCode}
                      className="px-2.5 py-1 bg-white text-xs font-semibold text-[#059669] border border-[#a7f3d0] rounded-md hover:bg-[#f0fdf4] cursor-pointer"
                    >
                      {isDetectingOpenCode ? "探测中..." : "探测端口"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpenCodeInstallModalOpen(true)}
                      className="px-2.5 py-1 bg-[#059669] text-xs font-semibold text-white rounded-md hover:bg-[#047857] cursor-pointer"
                    >
                      部署向导
                    </button>
                  </div>
                </div>
              )}

              {openCodeDetectResult && (
                <div className="text-xs px-3 py-1.5 rounded-lg bg-[#ecfdf5] text-[#065f46] font-mono">
                  {openCodeDetectResult}
                </div>
              )}

              {/* 中转站接入模式选择 (积木式核心) */}
              <div className="bg-[#f8fafc] border border-[#e5dfd8] rounded-xl p-3.5 flex flex-col gap-2.5">
                <label className="block text-xs font-bold text-[#1e1b18]">
                  中转站接入模式 (Relay Integration Mode):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditModal((prev) => ({
                        ...prev,
                        channel: { ...prev.channel, relayMode: "direct" },
                      }))
                    }
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      (editModal.channel.relayMode || "direct") === "direct"
                        ? "bg-white border-[#d96b27] text-[#d96b27] shadow-xs"
                        : "bg-[#f1f5f9] border-[#e2e8f0] text-[#645e57] hover:bg-white"
                    }`}
                  >
                    <span>🌟 官方直连模式</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditModal((prev) => ({
                        ...prev,
                        channel: { ...prev.channel, relayMode: "newapi" },
                      }))
                    }
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      editModal.channel.relayMode === "newapi"
                        ? "bg-white border-[#d96b27] text-[#d96b27] shadow-xs"
                        : "bg-[#f1f5f9] border-[#e2e8f0] text-[#645e57] hover:bg-white"
                    }`}
                  >
                    <span>🚀 NewAPI / OneAPI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditModal((prev) => ({
                        ...prev,
                        channel: { ...prev.channel, relayMode: "sub2api" },
                      }))
                    }
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      editModal.channel.relayMode === "sub2api"
                        ? "bg-white border-[#d96b27] text-[#d96b27] shadow-xs"
                        : "bg-[#f1f5f9] border-[#e2e8f0] text-[#645e57] hover:bg-white"
                    }`}
                  >
                    <span>⚡ sub2api 聚合网关</span>
                  </button>
                </div>

                {/* NewAPI 专属设置 */}
                {editModal.channel.relayMode === "newapi" && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-[#645e57] shrink-0">指定下游渠道 ID (可选):</span>
                    <input
                      type="text"
                      placeholder="如: 18 (留空自动按权重分发)"
                      value={editModal.channel.newApiChannelId || ""}
                      onChange={(e) =>
                        setEditModal((prev) => ({
                          ...prev,
                          channel: { ...prev.channel, newApiChannelId: e.target.value },
                        }))
                      }
                      className="flex-1 px-2.5 py-1 bg-white border border-[#cbd5e1] rounded text-xs font-mono"
                    />
                  </div>
                )}

                {/* sub2api 专属设置 */}
                {editModal.channel.relayMode === "sub2api" && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-[#645e57] shrink-0">sub2api 订阅节点地址:</span>
                    <input
                      type="text"
                      placeholder="https://your-sub2api-proxy.com/v1"
                      value={editModal.channel.sub2ApiUrl || ""}
                      onChange={(e) =>
                        setEditModal((prev) => ({
                          ...prev,
                          channel: { ...prev.channel, sub2ApiUrl: e.target.value },
                        }))
                      }
                      className="flex-1 px-2.5 py-1 bg-white border border-[#cbd5e1] rounded text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-xs font-bold text-[#1e1b18] mb-1">API Base URL (端点路径):</label>
                <input
                  type="text"
                  value={editModal.channel.baseUrl}
                  onChange={(e) =>
                    setEditModal((prev) => ({
                      ...prev,
                      channel: { ...prev.channel, baseUrl: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 bg-white border border-[#e5dfd8] rounded-lg text-xs font-mono text-[#1e1b18] outline-none focus:border-[#d96b27]"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-bold text-[#1e1b18] mb-1">API Key (密钥/令牌):</label>
                <div className="relative flex items-center">
                  <input
                    type={showKeyMap["modal"] ? "text" : "password"}
                    value={editModal.channel.apiKey}
                    onChange={(e) =>
                      setEditModal((prev) => ({
                        ...prev,
                        channel: { ...prev.channel, apiKey: e.target.value },
                      }))
                    }
                    placeholder="输入该渠道或中转站对应的 API Key"
                    className="w-full px-3 py-2 bg-white border border-[#e5dfd8] rounded-lg text-xs font-mono text-[#1e1b18] outline-none focus:border-[#d96b27] pr-16"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyKey("modal", editModal.channel.apiKey)}
                      className="p-1 text-[#9c948a] hover:text-[#1e1b18]"
                      title="复制 API Key"
                    >
                      {copiedId === "modal" ? <Check size={14} className="text-[#10b981]" /> : <Copy size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowKeyMap((prev) => ({ ...prev, modal: !prev.modal }))}
                      className="p-1 text-[#9c948a] hover:text-[#1e1b18]"
                    >
                      {showKeyMap["modal"] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 模型列表与同步 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-[#1e1b18]">支持的模型列表 (Models):</label>
                  <button
                    type="button"
                    onClick={handleModalSync}
                    disabled={modalSyncStatus?.loading}
                    className="text-xs font-semibold text-[#d96b27] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Download size={12} className={modalSyncStatus?.loading ? "animate-spin" : ""} />
                    <span>
                      {editModal.channel.type === "opencode"
                        ? "从官方 models.dev 与本地同步"
                        : "从端点一键同步可用模型"}
                    </span>
                  </button>
                </div>

                {modalSyncStatus && (
                  <div
                    className={`text-xs px-3 py-1.5 rounded-lg mb-2 font-mono ${
                      modalSyncStatus.ok ? "bg-[#ecfdf5] text-[#10b981]" : "bg-[#fee2e2] text-[#ef4444]"
                    }`}
                  >
                    {modalSyncStatus.msg}
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap p-2 bg-[#f8fafc] border border-[#e5dfd8] rounded-xl max-h-32 overflow-y-auto">
                  {editModal.channel.models.map((m) => (
                    <span
                      key={m}
                      className="text-xs font-mono bg-white border border-[#e2e8f0] px-2 py-0.5 rounded flex items-center gap-1"
                    >
                      <span>{m}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditModal((prev) => ({
                            ...prev,
                            channel: {
                              ...prev.channel,
                              models: prev.channel.models.filter((item) => item !== m),
                            },
                          }))
                        }
                        className="text-[#9c948a] hover:text-[#ef4444] cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {/* 手动添加自定义模型 */}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="输入自定义模型 ID，如: qwen-turbo-latest"
                    value={newModelInput}
                    onChange={(e) => setNewModelInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-[#e5dfd8] rounded-lg text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomModel}
                    className="px-3 py-1.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-xs font-semibold text-[#1e1b18] rounded-lg cursor-pointer"
                  >
                    + 添加模型
                  </button>
                </div>
              </div>

              {/* 测速状态条 */}
              {modalTestStatus && (
                <div
                  className={`text-xs px-3 py-2 rounded-lg font-mono flex items-center gap-2 ${
                    modalTestStatus.ok ? "bg-[#ecfdf5] text-[#10b981]" : "bg-[#fee2e2] text-[#ef4444]"
                  }`}
                >
                  {modalTestStatus.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>{modalTestStatus.msg}</span>
                </div>
              )}
            </div>

            {/* 弹窗底部操作按钮 */}
            <div className="px-6 py-3.5 bg-[#f8fafc] border-t border-[#e5dfd8] flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={handleModalTest}
                disabled={modalTestStatus?.loading}
                className="px-3 py-1.5 bg-white hover:bg-[#f1f5f9] border border-[#e5dfd8] rounded-lg text-xs font-semibold text-[#645e57] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Zap size={13} className={modalTestStatus?.loading ? "animate-spin" : ""} />
                <span>{modalTestStatus?.loading ? "连通测试中..." : "测试连接 (Ping)"}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#f1f5f9] border border-[#e5dfd8] rounded-lg text-xs font-semibold text-[#645e57] cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  className="px-4 py-1.5 bg-[#d96b27] hover:bg-[#b85417] text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm transition-colors"
                >
                  保存配置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OpenCode 实时下载与部署向导弹窗 */}
      <OpenCodeInstallModal
        isOpen={isOpenCodeInstallModalOpen}
        onClose={() => setIsOpenCodeInstallModalOpen(false)}
      />
    </div>
  );
};
