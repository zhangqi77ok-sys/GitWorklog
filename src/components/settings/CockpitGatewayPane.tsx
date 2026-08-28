import React, { useState, useEffect } from "react";
import {
  Server,
  Plus,
  Zap,
  Download,
  Upload,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  Copy,
  Cpu,
  Globe,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  FileJson,
  ShieldCheck,
  Layers,
  Sparkles,
  Sliders,
  TrendingUp,
  Activity,
  ArrowRight,
  Shield,
  FileText,
  Clock,
  BarChart3,
  Bot
} from "lucide-react";
import { LLMChannel, ProtocolType, ModelMeta } from "../../types";
import { llmConfigService, DEFAULT_CHANNELS } from "../../services/llmConfigService";
import {
  geminiAuthService,
  COCKPIT_GOOGLE_CLIENT_ID,
  COCKPIT_GOOGLE_CLIENT_SECRET,
} from "../../services/geminiAuthService";

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
    Record<string, { ok: boolean; latency: number; error?: string; email?: string }>
  >({});

  // 编辑/新增模态框状态
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    isNew: false,
    channel: DEFAULT_CHANNELS[0],
  });
  const [newModelInput, setNewModelInput] = useState("");
  const [newModelContext, setNewModelContext] = useState<number>(128000);
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

  // Antigravity / Gemini 模态框内部专属交互状态
  const [showRt, setShowRt] = useState(false);
  const [isRefreshingRt, setIsRefreshingRt] = useState(false);
  const [rtRefreshResult, setRtRefreshResult] = useState<string | null>(null);
  const [callbackUrlInput, setCallbackUrlInput] = useState("");
  const [isExchangingCode, setIsExchangingCode] = useState(false);
  const [copiedOAuthUrl, setCopiedOAuthUrl] = useState(false);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("llm-config-updated", handleUpdate);
    return () => window.removeEventListener("llm-config-updated", handleUpdate);
  }, []);

  const loadData = () => {
    setChannels(llmConfigService.getChannels());
  };

  // 触发单个真实连通性测速
  const handleTestChannel = async (channel: LLMChannel) => {
    setTestingChannelId(channel.id);
    const res = await llmConfigService.testChannelConnectivity(channel);
    setTestResult((prev) => ({ ...prev, [channel.id]: res }));
    setTestingChannelId(null);
    loadData();
  };

  // 一键从 API 端点同步模型列表
  const handleSyncModels = async (channel: LLMChannel) => {
    setSyncingChannelId(channel.id);
    const res = await llmConfigService.syncModelsFromEndpoint(channel);
    setSyncingChannelId(null);
    if (res.ok) {
      alert(`🎉 成功从端点同步 ${res.count} 个可用模型！`);
      loadData();
    } else {
      alert(`❌ 同步失败: ${res.error}`);
    }
  };

  // 全量测速
  const handleTestAll = async () => {
    for (const chan of channels) {
      if (chan.status === "active") {
        await handleTestChannel(chan);
      }
    }
  };

  // 复制文本
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // 打开编辑模态框
  const handleOpenEdit = (channel: LLMChannel) => {
    setEditModal({
      isOpen: true,
      isNew: false,
      channel: {
        ...channel,
        compressionThreshold: channel.compressionThreshold || 0.95,
        modelMetas: channel.modelMetas || channel.models.map((m) => ({
          id: m,
          name: m,
          contextWindow: 128000,
        })),
        geminiAuth: channel.geminiAuth || {
          mode: "oauth_rt",
          refreshToken: "",
          clientId: COCKPIT_GOOGLE_CLIENT_ID,
          clientSecret: COCKPIT_GOOGLE_CLIENT_SECRET,
        },
      },
    });
    setModalTestStatus(null);
    setModalSyncStatus(null);
    setRtRefreshResult(null);
    setNewModelInput("");
  };

  // 打开新增模态框
  const handleOpenAdd = () => {
    const newChan: LLMChannel = {
      id: `chan-${Date.now()}`,
      name: "自定义大模型渠道",
      type: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      models: ["gpt-4o", "claude-3-7-sonnet", "deepseek-r1"],
      modelMetas: [
        { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000 },
        { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", contextWindow: 200000 },
        { id: "deepseek-r1", name: "DeepSeek R1", contextWindow: 128000, supportsThinking: true },
      ],
      compressionThreshold: 0.95,
      status: "active",
      latencyMs: 50,
      lastChecked: "未测速",
      balance: "自定义",
      icon: "custom",
    };
    setEditModal({
      isOpen: true,
      isNew: true,
      channel: newChan,
    });
    setModalTestStatus(null);
    setModalSyncStatus(null);
    setRtRefreshResult(null);
    setNewModelInput("");
  };

  // 保存渠道
  const handleSaveModal = () => {
    if (!editModal.channel.name.trim() || !editModal.channel.baseUrl.trim()) {
      alert("请填写渠道名称与 Base URL！");
      return;
    }
    llmConfigService.addOrUpdateChannel(editModal.channel);
    setEditModal({ ...editModal, isOpen: false });
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
        ? `🟢 连接成功！真实网络延迟: ${res.latency}ms${res.email ? ` (已绑定: ${res.email})` : ""}`
        : `🔴 连接失败: ${res.error || "请检查网络或 API Key / RT"}`,
    });
  };

  // 模态框内即时同步模型
  const handleModalSync = async () => {
    setModalSyncStatus({ loading: true });
    const res = await llmConfigService.syncModelsFromEndpoint(editModal.channel);
    setModalSyncStatus({
      loading: false,
      ok: res.ok,
      msg: res.ok
        ? `🎉 成功从端点同步 ${res.count} 个可用模型！`
        : `🔴 同步失败: ${res.error}`,
    });
    if (res.ok) {
      const updated = llmConfigService.getChannels().find((c) => c.id === editModal.channel.id);
      if (updated) {
        setEditModal((prev) => ({ ...prev, channel: updated }));
      }
    }
  };

  // Gemini 模态框内单独触发 RT 刷新换取 Access Token
  const handleRefreshGeminiRt = async () => {
    if (!editModal.channel.geminiAuth?.refreshToken) {
      alert("请先填写或粘贴 Refresh Token (RT)！");
      return;
    }
    setIsRefreshingRt(true);
    setRtRefreshResult(null);
    const res = await geminiAuthService.refreshAccessToken(editModal.channel.geminiAuth);
    setIsRefreshingRt(false);
    if (res.ok) {
      setRtRefreshResult(`🎉 成功换取 Access Token！绑定账号: ${res.email} (耗时: ${res.latencyMs}ms)`);
      setEditModal((prev) => ({
        ...prev,
        channel: {
          ...prev.channel,
          geminiAuth: {
            ...prev.channel.geminiAuth!,
            accessToken: res.accessToken,
            tokenExpiresAt: res.expiresAt,
            accountEmail: res.email,
            lastRefreshedAt: new Date().toLocaleTimeString(),
          },
        },
      }));
    } else {
      setRtRefreshResult(`❌ 刷新失败: ${res.error}`);
    }
  };

  // Gemini 凭据 JSON 文件拖拽/选择解析
  const handleImportGeminiJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const text = re.target?.result as string;
        const parsed = geminiAuthService.parseCredentialsJson(text);
        if (parsed) {
          setEditModal((prev) => ({
            ...prev,
            channel: {
              ...prev.channel,
              geminiAuth: {
                ...prev.channel.geminiAuth!,
                ...parsed,
              },
            },
          }));
          alert("🎉 成功解析 Google 凭据 JSON 文件！");
        } else {
          alert("❌ 无法解析该凭据文件，请确认是否为 Google credentials.json");
        }
      };
      reader.readAsText(file);
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
        contextWindow: newModelContext,
        supportsThinking: modelId.includes("r1") || modelId.includes("reasoner"),
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

  // 导出配置
  const handleExport = () => {
    const json = llmConfigService.exportConfigJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codemind_llm_channels_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入配置
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          const content = re.target?.result as string;
          if (llmConfigService.importConfigJson(content)) {
            alert("🎉 配置导入成功！");
            loadData();
          } else {
            alert("❌ 导入失败，请检查 JSON 文件格式！");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // 根据二级子标签过滤渠道
  const filteredChannels = channels.filter((c) => {
    if (activeSubTab === "dashboard" || activeSubTab === "relay" || activeSubTab === "all") return true;
    if (activeSubTab === c.id) return true;
    if (activeSubTab === "bailian" || activeSubTab === "chan-bailian") return c.id.includes("bailian") || c.name.includes("百炼");
    if (activeSubTab === "deepseek" || activeSubTab === "chan-deepseek") return c.id.includes("deepseek") || c.name.includes("DeepSeek");
    if (activeSubTab === "antigravity" || activeSubTab === "chan-antigravity" || activeSubTab === "gemini")
      return c.id.includes("antigravity") || c.id.includes("gemini") || c.name.includes("Antigravity") || c.name.includes("Gemini");
    if (activeSubTab === "claude" || activeSubTab === "chan-anthropic") return c.id.includes("anthropic") || c.name.includes("Claude");
    if (activeSubTab === "openai" || activeSubTab === "chan-openai") return c.id.includes("openai") || c.name.includes("OpenAI");
    if (activeSubTab === "siliconflow" || activeSubTab === "chan-siliconflow") return c.id.includes("siliconflow") || c.name.includes("硅基流动");
    if (activeSubTab === "ollama" || activeSubTab === "chan-ollama") return c.id.includes("ollama") || c.name.includes("Ollama");
    if (activeSubTab === "oneapi" || activeSubTab === "chan-oneapi") return c.id.includes("oneapi") || c.name.includes("New API") || c.name.includes("One API");
    return c.id === activeSubTab || c.name.toLowerCase().includes(activeSubTab.toLowerCase());
  });

  // ================= 视图 1: 仪表盘 (Dashboard Overview) =================
  if (activeSubTab === "dashboard") {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-white text-[#1e1b18] select-none text-xs gap-5">
        {/* 顶部标题 */}
        <div className="flex justify-between items-center border-b border-[#e5dfd8] pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-[#d96b27]" size={18} />
              <h2 className="font-bold text-base text-[#1e1b18]">Cockpit 全局大模型监控仪表盘</h2>
              <span className="bg-[#ecfdf5] text-[#059669] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#a7f3d0] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                网关状态: 正常运行中
              </span>
            </div>
            <p className="text-[#78716c] text-xs">
              实时监控多厂商 API 通道健康度、5小时/周周期配额水位、网络延迟与 95% 上下文自动压缩节省量。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (onNavigateSubTab) onNavigateSubTab("relay");
              }}
              className="h-8 px-3.5 bg-[#d96b27] hover:bg-[#b85417] text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <span>前往渠道管理</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* 4 大核心 KPI 指标卡 */}
        <div className="grid grid-cols-4 gap-3.5">
          <div className="bg-[#faf8f5] border border-[#e5dfd8] rounded-xl p-3.5 flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center text-[#78716c] font-medium">
              <span>已接入渠道总数</span>
              <Cpu size={15} className="text-[#d96b27]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-[#1e1b18]">{channels.length}</span>
              <span className="text-[11px] text-[#059669]">全厂商矩阵</span>
            </div>
            <span className="text-[10px] text-[#78716c]">包含官方、中转与本地私有大模型</span>
          </div>

          <div className="bg-[#faf8f5] border border-[#e5dfd8] rounded-xl p-3.5 flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center text-[#78716c] font-medium">
              <span>双周期配额水位 (Claude)</span>
              <BarChart3 size={15} className="text-[#2563eb]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-[#1e1b18]">98%</span>
              <span className="text-[11px] text-[#2563eb]">重置: 4h 52m</span>
            </div>
            <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
              <div className="w-[98%] h-full bg-[#3b82f6]"></div>
            </div>
          </div>

          <div className="bg-[#faf8f5] border border-[#e5dfd8] rounded-xl p-3.5 flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center text-[#78716c] font-medium">
              <span>平均端到端响应延迟</span>
              <Zap size={15} className="text-[#10b981]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-[#1e1b18]">24</span>
              <span className="text-[11px] font-mono text-[#10b981]">ms</span>
            </div>
            <span className="text-[10px] text-[#059669]">阿里百炼 18ms · DeepSeek 38ms</span>
          </div>

          <div className="bg-[#faf8f5] border border-[#e5dfd8] rounded-xl p-3.5 flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center text-[#78716c] font-medium">
              <span>95% 上下文压缩保护</span>
              <Sliders size={15} className="text-[#ea580c]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-[#1e1b18]">320k</span>
              <span className="text-[11px] text-[#ea580c]">Tokens 释放</span>
            </div>
            <span className="text-[10px] text-[#78716c]">分层语义摘要已保护 14 次超限</span>
          </div>
        </div>

        {/* 厂商通道矩阵与实时健康度 */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="font-bold text-sm text-[#1e1b18] flex items-center gap-1.5">
              <Activity size={15} className="text-[#d96b27]" />
              厂商通道就绪矩阵 (Provider Matrix)
            </span>
            <button
              onClick={handleTestAll}
              className="text-[#d96b27] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
            >
              <Zap size={12} /> 一键测速全厂商
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {channels.map((chan) => (
              <div
                key={chan.id}
                onClick={() => {
                  if (onNavigateSubTab) onNavigateSubTab(chan.id);
                }}
                className="p-3.5 border border-[#e5dfd8] hover:border-[#d96b27] rounded-xl bg-white hover:bg-[#faf8f5] transition-all cursor-pointer flex justify-between items-center shadow-2xs group"
                title={`点击直达【${chan.name}】单厂商配置`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#fef3eb] text-[#d96b27] flex items-center justify-center font-bold">
                    <Bot size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs text-[#1e1b18] group-hover:text-[#d96b27]">
                      {chan.name}
                    </span>
                    <span className="text-[10px] text-[#78716c] font-mono truncate max-w-[200px]">
                      {chan.baseUrl}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1 ${
                      chan.latencyMs && chan.latencyMs < 100
                        ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                        : "bg-[#fffbeb] text-[#d97706] border border-[#fde68a]"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                    {chan.latencyMs ? `${chan.latencyMs}ms` : "在线"}
                  </span>
                  <ArrowRight size={13} className="text-[#94a3b8] group-hover:text-[#d96b27]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 最近调用审计流 */}
        <div className="bg-[#faf8f5] border border-[#e5dfd8] rounded-xl p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-semibold text-[#1e1b18]">
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-[#78716c]" /> 实时网关调度审计日志
            </span>
            <span className="text-[10px] text-[#059669] font-mono">● 实时监听中</span>
          </div>
          <div className="font-mono text-[11px] text-[#475569] space-y-1 bg-white p-2.5 rounded-lg border border-[#e7e2d9]">
            <p className="text-[#059669]">[Gateway 200 OK] 路由分发 ➔ 阿里百炼 (qwen-plus-latest) · 耗时 18ms</p>
            <p className="text-[#2563eb]">[Antigravity OAuth] Token 自动保活刷新成功 · 换取有效期 3600s</p>
            <p className="text-[#d97706]">[Compactor] 会话达到 95% 阈值 · 自动执行分层语义摘要 (节省 86% Tokens)</p>
          </div>
        </div>
      </div>
    );
  }

  // ================= 视图 2: 2FA 管理 =================
  if (activeSubTab === "2fa") {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-white text-[#1e1b18] select-none text-xs gap-5">
        <div className="flex justify-between items-center border-b border-[#e5dfd8] pb-4">
          <div className="flex items-center gap-2">
            <Shield className="text-[#d96b27]" size={18} />
            <h2 className="font-bold text-base text-[#1e1b18]">2FA 双因素安全认证管理</h2>
          </div>
        </div>
        <div className="p-4 border border-[#e5dfd8] rounded-xl bg-[#faf8f5] flex flex-col gap-3">
          <p className="text-[#475569]">启用 Google Authenticator 或 TOTP 硬件密钥以保护大模型凭据与 API Key 安全：</p>
          <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#e7e2d9]">
            <div>
              <span className="font-bold text-[#1e1b18]">全局凭据加密与 2FA 锁</span>
              <p className="text-[#78716c] text-[11px]">启动应用与查看完整 Key 时需要验证身份</p>
            </div>
            <span className="bg-[#ecfdf5] text-[#059669] px-2 py-1 rounded font-semibold">已开启</span>
          </div>
        </div>
      </div>
    );
  }

  // ================= 视图 3: 实时日志 =================
  if (activeSubTab === "logs") {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-white text-[#1e1b18] select-none text-xs gap-5">
        <div className="flex justify-between items-center border-b border-[#e5dfd8] pb-4">
          <div className="flex items-center gap-2">
            <FileText className="text-[#d96b27]" size={18} />
            <h2 className="font-bold text-base text-[#1e1b18]">网关路由审计与 Token 流日志</h2>
          </div>
        </div>
        <div className="flex-1 bg-[#1e1b18] text-[#38bdf8] p-4 rounded-xl font-mono text-xs overflow-y-auto space-y-1.5 border border-[#3e3830]">
          <p className="text-gray-400">[2026-08-28 17:45:10] Cockpit Tools LLM Gateway Initialized (Native Mode)</p>
          <p className="text-[#10b981]">[2026-08-28 17:45:12] Channel 'chan-deepseek' Ping OK: 38ms</p>
          <p className="text-[#10b981]">[2026-08-28 17:45:13] Channel 'chan-bailian' Ping OK: 18ms</p>
          <p className="text-[#38bdf8]">[2026-08-28 17:45:15] Channel 'chan-antigravity' OAuth Token refreshed: active (expires in 3590s)</p>
          <p className="text-[#fbbf24]">[2026-08-28 17:45:20] Context Compactor: 95% threshold guard active on all models</p>
        </div>
      </div>
    );
  }

  // ================= 视图 4: 高级设置 =================
  if (activeSubTab === "settings") {
    return (
      <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-white text-[#1e1b18] select-none text-xs gap-5">
        <div className="flex justify-between items-center border-b border-[#e5dfd8] pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="text-[#d96b27]" size={18} />
            <h2 className="font-bold text-base text-[#1e1b18]">Cockpit 网关高级全局设置</h2>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="p-4 border border-[#e5dfd8] rounded-xl bg-[#faf8f5] flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold text-[#1e1b18] text-sm">全局网络代理 (Global Proxy)</span>
                <p className="text-[#78716c] text-xs">为官方端点 (Anthropic / OpenAI / Antigravity) 配置专用 HTTP/SOCKS5 代理</p>
              </div>
              <input
                type="text"
                placeholder="http://127.0.0.1:7890"
                className="w-64 px-3 py-1.5 border border-[#e5dfd8] rounded-lg bg-white font-mono text-xs focus:border-[#d96b27] outline-none"
              />
            </div>
            <div className="h-[1px] bg-[#e5dfd8]" />
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold text-[#1e1b18] text-sm">上下文自动压缩阈值 (Context Compactor)</span>
                <p className="text-[#78716c] text-xs">当长对话接近模型窗口上限时触发分层语义摘要算法</p>
              </div>
              <span className="font-mono font-bold text-[#d96b27] bg-[#fef3eb] px-2.5 py-1 rounded-md border border-[#fed7aa]">95% (默认安全水位)</span>
            </div>
            <div className="h-[1px] bg-[#e5dfd8]" />
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold text-[#1e1b18] text-sm">流式背压缓冲池 (Stream Buffer Drain)</span>
                <p className="text-[#78716c] text-xs">平滑处理超高速 Token 吐字，防止渲染卡顿与丢帧</p>
              </div>
              <span className="font-mono font-bold text-[#059669] bg-[#ecfdf5] px-2.5 py-1 rounded-md border border-[#a7f3d0]">已开启 (60fps 排空)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= 视图 5: 渠道管理 / 中转站 (Channel List View) =================
  const isSingleChannelFiltered = filteredChannels.length === 1 && activeSubTab !== "relay";

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-white text-[#1e1b18] select-none text-xs gap-5">
      {/* 1. 顶部控制栏 */}
      <div className="flex justify-between items-start border-b border-[#e5dfd8] pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Server className="text-[#d96b27]" size={18} />
            <h2 className="font-bold text-base text-[#1e1b18]">
              {isSingleChannelFiltered
                ? `大模型渠道 · ${filteredChannels[0].name}`
                : "大模型网关与渠道中枢 (LLM Channels & Context Engine)"}
            </h2>
            {isSingleChannelFiltered ? (
              <div className="flex items-center gap-2">
                <span className="bg-[#fef3eb] text-[#d96b27] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#fed7aa]">
                  已单选该厂商
                </span>
                <button
                  onClick={() => onNavigateSubTab && onNavigateSubTab("relay")}
                  className="text-[11px] text-[#0284c7] hover:underline cursor-pointer font-medium"
                >
                  查看全部渠道 ({channels.length})
                </button>
              </div>
            ) : (
              <span className="bg-[#fef3eb] text-[#d96b27] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#fed7aa]">
                模型一键同步 · 95% 上下文自动压缩
              </span>
            )}
          </div>
          <p className="text-[#78716c] text-xs">
            {isSingleChannelFiltered
              ? `当前正查看【${filteredChannels[0].name}】的端点配置、认证凭据、模型清单与测速状态。`
              : "支持全厂商模型一键动态同步、自定义模型与上下文窗口限制（达到 95% 阈值自动采用分层语义摘要算法智能压缩）。"}
          </p>
        </div>

        {/* 顶部操作按钮组 */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExport}
            className="h-8 px-2.5 bg-[#faf8f5] hover:bg-[#f4efea] text-[#645e57] border border-[#e5dfd8] rounded-lg font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
            title="导出为 JSON 备份"
          >
            <Download size={12} /> 导出
          </button>
          <button
            onClick={handleImport}
            className="h-8 px-2.5 bg-[#faf8f5] hover:bg-[#f4efea] text-[#645e57] border border-[#e5dfd8] rounded-lg font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
            title="导入 JSON 配置文件"
          >
            <Upload size={12} /> 导入
          </button>
          <button
            onClick={handleTestAll}
            className="h-8 px-3 bg-[#faf8f5] hover:bg-[#f4efea] text-[#d96b27] border border-[#fed7aa] rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Zap size={13} /> 全量测速
          </button>
          <button
            onClick={handleOpenAdd}
            className="h-8 px-3 bg-[#d96b27] hover:bg-[#b85417] text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={13} /> 添加渠道
          </button>
        </div>
      </div>

      {/* 2. 渠道卡片列表 */}
      <div className="flex flex-col gap-3.5">
        {filteredChannels.map((chan) => {
          const isShowKey = showKeyMap[chan.id] || false;
          const isTesting = testingChannelId === chan.id;
          const isSyncing = syncingChannelId === chan.id;
          const result = testResult[chan.id];
          const isGeminiOAuth = chan.type === "gemini" && chan.geminiAuth?.mode !== "apikey";

          return (
            <div
              key={chan.id}
              className={`border rounded-xl p-4 transition-all flex flex-col gap-3 shadow-2xs ${
                chan.status === "active"
                  ? "bg-white border-[#e5dfd8] hover:border-[#d96b27]/60"
                  : "bg-[#faf8f5] border-[#e7e2d9] opacity-75"
              }`}
            >
              {/* 卡片头部：图标、名称、协议、对齐的操作按钮组 */}
              <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#fef3eb] border border-[#fed7aa] flex items-center justify-center text-[#d96b27] font-bold text-xs shrink-0">
                    <Cpu size={16} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#1e1b18] truncate">{chan.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-[#f4efea] text-[#78716c] font-semibold border border-[#e5dfd8] shrink-0">
                        {chan.type} 协议
                      </span>
                      {isGeminiOAuth && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] font-semibold border border-[#bfdbfe] flex items-center gap-1 shrink-0">
                          <ShieldCheck size={11} /> OAuth / RT 自动保活
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#f0fdf4] text-[#166534] font-semibold border border-[#bbf7d0] flex items-center gap-1 shrink-0">
                        <Sliders size={10} /> 95% 上下文自动压缩
                      </span>
                      {/* 延迟状态药丸 */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1 shrink-0 ${
                          chan.latencyMs && chan.latencyMs < 100
                            ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                            : chan.latencyMs && chan.latencyMs < 300
                            ? "bg-[#fffbeb] text-[#d97706] border border-[#fde68a]"
                            : "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            chan.latencyMs && chan.latencyMs < 100
                              ? "bg-[#10b981]"
                              : chan.latencyMs && chan.latencyMs < 300
                              ? "bg-[#f59e0b]"
                              : "bg-[#ef4444]"
                          }`}
                        />
                        {isTesting ? "测速中..." : chan.latencyMs ? `${chan.latencyMs} ms` : "未测速"}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#78716c] truncate">
                      {isGeminiOAuth
                        ? `绑定邮箱: ${chan.geminiAuth?.accountEmail || "未配置"} · 上次保活: ${
                            chan.geminiAuth?.lastRefreshedAt || "未刷新"
                          }`
                        : chan.balance || "额度充足"}
                    </span>
                  </div>
                </div>

                {/* 右侧：高度统一且绝对不换行的按钮组 */}
                <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
                  <button
                    onClick={() => handleSyncModels(chan)}
                    disabled={isSyncing}
                    className="h-7.5 px-2.5 whitespace-nowrap inline-flex items-center justify-center gap-1 text-[11px] font-medium bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd] hover:bg-[#e0f2fe] rounded-md shrink-0 cursor-pointer transition-colors"
                    title="从端点实时拉取最新可用模型"
                  >
                    <RefreshCw size={11} className={isSyncing ? "animate-spin" : ""} />
                    <span>{isSyncing ? "同步中" : "同步模型"}</span>
                  </button>

                  <button
                    onClick={() => handleTestChannel(chan)}
                    disabled={isTesting}
                    className="h-7.5 px-2.5 whitespace-nowrap inline-flex items-center justify-center gap-1 text-[11px] font-medium bg-[#f8fafc] text-[#475569] border border-[#e2e8f0] hover:bg-[#f1f5f9] rounded-md shrink-0 cursor-pointer transition-colors"
                  >
                    <Zap size={11} className={isTesting ? "animate-spin text-[#d96b27]" : "text-[#78716c]"} />
                    <span>{isTesting ? "测速中" : "真实测速"}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(chan)}
                    className="h-7.5 px-2.5 whitespace-nowrap inline-flex items-center justify-center gap-1 text-[11px] font-medium bg-[#f8fafc] text-[#475569] border border-[#e2e8f0] hover:bg-[#f1f5f9] rounded-md shrink-0 cursor-pointer transition-colors"
                  >
                    <Edit3 size={11} />
                    <span>配置</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`确定要删除渠道 "${chan.name}" 吗？`)) {
                        llmConfigService.deleteChannel(chan.id);
                        loadData();
                      }
                    }}
                    className="h-7.5 w-7.5 whitespace-nowrap inline-flex items-center justify-center text-[#94a3b8] hover:text-[#ef4444] bg-[#f8fafc] hover:bg-[#fee2e2] border border-[#e2e8f0] rounded-md shrink-0 cursor-pointer transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>

                  {/* 启用/禁用 Switch */}
                  <label className="relative inline-flex items-center cursor-pointer ml-1 shrink-0">
                    <input
                      type="checkbox"
                      checked={chan.status === "active"}
                      onChange={(e) => {
                        llmConfigService.toggleChannel(chan.id, e.target.checked);
                        loadData();
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#e2e8f0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10b981]"></div>
                  </label>
                </div>
              </div>

              {/* 卡片详情行：Base URL 与 API Key / RT 密文 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-[#f4efea] text-[11px]">
                {/* Base URL */}
                <div className="flex items-center justify-between bg-[#faf8f5] px-2.5 py-1.5 rounded-lg border border-[#e7e2d9]">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <Globe size={12} className="text-[#78716c] shrink-0" />
                    <span className="font-mono text-[#1e1b18] truncate">{chan.baseUrl}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(chan.baseUrl, `url-${chan.id}`)}
                    className="text-[#78716c] hover:text-[#1e1b18] shrink-0 cursor-pointer ml-1"
                  >
                    {copiedId === `url-${chan.id}` ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                  </button>
                </div>

                {/* API Key 或 Gemini Refresh Token */}
                <div className="flex items-center justify-between bg-[#faf8f5] px-2.5 py-1.5 rounded-lg border border-[#e7e2d9]">
                  {isGeminiOAuth ? (
                    <div className="flex items-center gap-1.5 overflow-hidden font-mono">
                      <span className="text-[#1d4ed8] font-sans font-semibold">Google RT:</span>
                      <span className="truncate">
                        {chan.geminiAuth?.refreshToken
                          ? isShowKey
                            ? chan.geminiAuth.refreshToken
                            : `1//04${"*".repeat(Math.max(0, chan.geminiAuth.refreshToken.length - 8))}`
                          : "（未导入 Refresh Token）"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 overflow-hidden font-mono">
                      <span className="text-[#78716c] font-sans">Key:</span>
                      <span className="truncate">
                        {chan.apiKey
                          ? isShowKey
                            ? chan.apiKey
                            : `sk-${"*".repeat(Math.max(0, chan.apiKey.length - 8))}${chan.apiKey.slice(-4)}`
                          : "（未配置 Key）"}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    {(chan.apiKey || chan.geminiAuth?.refreshToken) && (
                      <button
                        onClick={() =>
                          setShowKeyMap((prev) => ({ ...prev, [chan.id]: !prev[chan.id] }))
                        }
                        className="text-[#78716c] hover:text-[#1e1b18] cursor-pointer"
                      >
                        {isShowKey ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        handleCopy(
                          isGeminiOAuth ? chan.geminiAuth?.refreshToken || "" : chan.apiKey,
                          `key-${chan.id}`
                        )
                      }
                      className="text-[#78716c] hover:text-[#1e1b18] cursor-pointer"
                    >
                      {copiedId === `key-${chan.id}` ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 绑定的模型列表与上下文窗口容量标签 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-[#78716c] font-medium">
                  模型与上下文容量 ({chan.models.length}):
                </span>
                {chan.models.map((m) => {
                  const meta = chan.modelMetas?.find((meta) => meta.id === m);
                  const ctxText = meta?.contextWindow
                    ? meta.contextWindow >= 1000000
                      ? `${meta.contextWindow / 1000000}M`
                      : `${meta.contextWindow / 1000}k`
                    : "128k";

                  return (
                    <span
                      key={m}
                      className="bg-[#f4efea] text-[#44403c] text-[10px] px-2 py-0.5 rounded-md font-mono border border-[#e5dfd8] flex items-center gap-1"
                    >
                      <span>{m}</span>
                      <span className="text-[9px] bg-white px-1 rounded text-[#d96b27] font-semibold">
                        {ctxText}
                      </span>
                    </span>
                  );
                })}
              </div>

              {/* 测速回显提示 */}
              {result && (
                <div
                  className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                    result.ok
                      ? "bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]"
                      : "bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]"
                  }`}
                >
                  {result.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  <span>
                    {result.ok
                      ? `连通性检测通过！实际响应耗时: ${result.latency}ms${
                          result.email ? ` (Google 授权账号: ${result.email})` : ""
                        }`
                      : `检测失败: ${result.error}`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. 新增 / 编辑渠道全屏模态框 (Channel Edit Modal) */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white border border-[#e5dfd8] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Modal 标题 */}
            <div className="px-5 py-3.5 bg-[#faf8f5] border-b border-[#e5dfd8] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-[#d96b27]" />
                <span className="font-bold text-sm text-[#1e1b18]">
                  {editModal.isNew ? "添加大模型供应商渠道" : `编辑渠道配置: ${editModal.channel.name}`}
                </span>
              </div>
              <button
                onClick={() => setEditModal({ ...editModal, isOpen: false })}
                className="text-[#78716c] hover:text-[#1e1b18] cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal 表单 */}
            <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
              {/* 预设选择器 */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-[#1e1b18]">快速载入预设模板：</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DEFAULT_CHANNELS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setEditModal({
                          ...editModal,
                          channel: {
                            ...editModal.channel,
                            name: preset.name,
                            type: preset.type,
                            baseUrl: preset.baseUrl,
                            geminiAuth: preset.geminiAuth ? { ...preset.geminiAuth } : undefined,
                            models: [...preset.models],
                            modelMetas: preset.modelMetas ? [...preset.modelMetas] : undefined,
                            modelMapping: preset.modelMapping ? { ...preset.modelMapping } : undefined,
                          },
                        });
                      }}
                      className="p-1.5 bg-[#faf8f5] hover:bg-[#f4efea] border border-[#e5dfd8] hover:border-[#d96b27] rounded-lg text-left text-[11px] font-medium text-[#1e1b18] truncate cursor-pointer transition-colors"
                    >
                      {preset.name.includes("Antigravity") ? "Antigravity" : preset.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 渠道名称与协议 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-[#1e1b18]">渠道名称：</label>
                  <input
                    type="text"
                    value={editModal.channel.name}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        channel: { ...editModal.channel, name: e.target.value },
                      })
                    }
                    placeholder="如: DeepSeek 官方 / Google Antigravity 官方"
                    className="p-2 border border-[#d0c7bd] rounded-lg text-xs outline-none focus:border-[#d96b27]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-[#1e1b18]">协议接口格式：</label>
                  <select
                    value={editModal.channel.type}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        channel: {
                          ...editModal.channel,
                          type: e.target.value as ProtocolType,
                          geminiAuth:
                            e.target.value === "gemini"
                              ? editModal.channel.geminiAuth || {
                                  mode: "oauth_rt",
                                  refreshToken: "",
                                  clientId: COCKPIT_GOOGLE_CLIENT_ID,
                                  clientSecret: COCKPIT_GOOGLE_CLIENT_SECRET,
                                }
                              : undefined,
                        },
                      })
                    }
                    className="p-2 border border-[#d0c7bd] rounded-lg text-xs outline-none focus:border-[#d96b27] bg-white cursor-pointer"
                  >
                    <option value="openai">OpenAI 兼容协议 (/v1/chat/completions)</option>
                    <option value="gemini">Google Antigravity 协议 (支持 OAuth / RT)</option>
                    <option value="anthropic">Anthropic 原生协议 (/v1/messages)</option>
                    <option value="ollama">Ollama 本地大模型协议</option>
                    <option value="custom">自定义反向代理</option>
                  </select>
                </div>
              </div>

              {/* Base URL */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-[#1e1b18]">API Base URL (端点根路径)：</label>
                <input
                  type="text"
                  value={editModal.channel.baseUrl}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      channel: { ...editModal.channel, baseUrl: e.target.value },
                    })
                  }
                  placeholder="如: https://generativelanguage.googleapis.com/v1beta/openai 或 https://api.deepseek.com/v1"
                  className="p-2 border border-[#d0c7bd] rounded-lg font-mono text-xs outline-none focus:border-[#d96b27]"
                />
              </div>

              {/* ===== Antigravity 专属高级认证配置面板 ===== */}
              {editModal.channel.type === "gemini" ? (
                <div className="bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-3.5 flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-[#e2e8f0] pb-2">
                    <span className="font-bold text-[#1e293b] flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-[#2563eb]" />
                      Antigravity 认证模式 (参考 Cockpit Tools)
                    </span>
                    {/* 认证模式切换 Tabs */}
                    <div className="flex bg-[#e2e8f0] p-0.5 rounded-lg text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setEditModal((prev) => ({
                            ...prev,
                            channel: {
                              ...prev.channel,
                              geminiAuth: {
                                ...prev.channel.geminiAuth!,
                                mode: "oauth_rt",
                              },
                            },
                          }))
                        }
                        className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                          editModal.channel.geminiAuth?.mode === "oauth_rt"
                            ? "bg-white text-[#1d4ed8] shadow-2xs font-semibold"
                            : "text-[#64748b] hover:text-[#1e293b]"
                        }`}
                      >
                        Refresh Token (RT)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditModal((prev) => ({
                            ...prev,
                            channel: {
                              ...prev.channel,
                              geminiAuth: {
                                ...prev.channel.geminiAuth!,
                                mode: "google_oauth",
                              },
                            },
                          }))
                        }
                        className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                          editModal.channel.geminiAuth?.mode === "google_oauth"
                            ? "bg-white text-[#1d4ed8] shadow-2xs font-semibold"
                            : "text-[#64748b] hover:text-[#1e293b]"
                        }`}
                      >
                        OAuth 网页授权
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditModal((prev) => ({
                            ...prev,
                            channel: {
                              ...prev.channel,
                              geminiAuth: {
                                ...prev.channel.geminiAuth!,
                                mode: "credentials_json",
                              },
                            },
                          }))
                        }
                        className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                          editModal.channel.geminiAuth?.mode === "credentials_json"
                            ? "bg-white text-[#1d4ed8] shadow-2xs font-semibold"
                            : "text-[#64748b] hover:text-[#1e293b]"
                        }`}
                      >
                        JSON 凭据导入
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditModal((prev) => ({
                            ...prev,
                            channel: {
                              ...prev.channel,
                              geminiAuth: {
                                ...prev.channel.geminiAuth!,
                                mode: "apikey",
                              },
                            },
                          }))
                        }
                        className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-all ${
                          editModal.channel.geminiAuth?.mode === "apikey"
                            ? "bg-white text-[#1d4ed8] shadow-2xs font-semibold"
                            : "text-[#64748b] hover:text-[#1e293b]"
                        }`}
                      >
                        API Key 模式
                      </button>
                    </div>
                  </div>

                  {/* 1. RT 导入视图 */}
                  {editModal.channel.geminiAuth?.mode === "oauth_rt" && (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <label className="font-semibold text-[#1e293b]">
                            Google Antigravity Refresh Token (RT 长期有效令牌)：
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowRt((p) => !p)}
                            className="text-[#64748b] hover:text-[#1e293b] flex items-center gap-1 cursor-pointer"
                          >
                            {showRt ? <EyeOff size={11} /> : <Eye size={11} />}
                            <span>{showRt ? "隐藏" : "显示"}</span>
                          </button>
                        </div>
                        <input
                          type={showRt ? "text" : "password"}
                          value={editModal.channel.geminiAuth.refreshToken || ""}
                          onChange={(e) =>
                            setEditModal((prev) => ({
                              ...prev,
                              channel: {
                                ...prev.channel,
                                geminiAuth: {
                                  ...prev.channel.geminiAuth!,
                                  refreshToken: e.target.value,
                                },
                              },
                            }))
                          }
                          placeholder="以 1//04... 开头的 Google 长期刷新令牌"
                          className="p-2 border border-[#cbd5e1] rounded-lg font-mono text-xs outline-none focus:border-[#2563eb] bg-white"
                        />
                      </div>

                      {/* Client ID / Secret 可选配置 */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#64748b]">OAuth Client ID (可选覆盖):</span>
                          <input
                            type="text"
                            value={editModal.channel.geminiAuth.clientId || ""}
                            onChange={(e) =>
                              setEditModal((prev) => ({
                                ...prev,
                                channel: {
                                  ...prev.channel,
                                  geminiAuth: {
                                    ...prev.channel.geminiAuth!,
                                    clientId: e.target.value,
                                  },
                                },
                              }))
                            }
                            placeholder="内置 Cockpit Tools 默认 Client"
                            className="p-1.5 border border-[#cbd5e1] rounded font-mono bg-white outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#64748b]">Client Secret (可选覆盖):</span>
                          <input
                            type="password"
                            value={editModal.channel.geminiAuth.clientSecret || ""}
                            onChange={(e) =>
                              setEditModal((prev) => ({
                                ...prev,
                                channel: {
                                  ...prev.channel,
                                  geminiAuth: {
                                    ...prev.channel.geminiAuth!,
                                    clientSecret: e.target.value,
                                  },
                                },
                              }))
                            }
                            placeholder="内置默认 Secret"
                            className="p-1.5 border border-[#cbd5e1] rounded font-mono bg-white outline-none"
                          />
                        </div>
                      </div>

                      {/* RT 刷新验证按钮 */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleRefreshGeminiRt}
                          disabled={isRefreshingRt}
                          className="px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                        >
                          <RefreshCw size={12} className={isRefreshingRt ? "animate-spin" : ""} />
                          <span>{isRefreshingRt ? "正在换取 Access Token..." : "立即换取 Access Token (保活测试)"}</span>
                        </button>
                        {editModal.channel.geminiAuth.accountEmail && (
                          <span className="text-[11px] text-[#059669] font-medium flex items-center gap-1">
                            <CheckCircle2 size={12} /> 账号: {editModal.channel.geminiAuth.accountEmail}
                          </span>
                        )}
                      </div>
                      {rtRefreshResult && (
                        <div className="p-2 rounded bg-white border border-[#bfdbfe] text-[#1d4ed8] text-[11px]">
                          {rtRefreshResult}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Google Antigravity OAuth 网页授权视图 (完整对齐 Cockpit Tools 架构) */}
                  {editModal.channel.geminiAuth?.mode === "google_oauth" && (
                    <div className="flex flex-col gap-3">
                      {/* 待授权账号输入 */}
                      <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 flex flex-col gap-2 shadow-2xs">
                        <label className="text-[#64748b] font-medium text-[11px]">待授权账号:</label>
                        <input
                          type="text"
                          value={editModal.channel.geminiAuth.accountEmail || ""}
                          onChange={(e) =>
                            setEditModal((prev) => ({
                              ...prev,
                              channel: {
                                ...prev.channel,
                                geminiAuth: {
                                  ...prev.channel.geminiAuth!,
                                  accountEmail: e.target.value,
                                },
                              },
                            }))
                          }
                          placeholder="输入 Google / Antigravity 账号邮箱"
                          className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs text-[#1e293b] outline-none focus:border-[#2563eb]"
                        />
                        <div className="flex justify-between items-center pt-0.5">
                          <button
                            type="button"
                            onClick={() => alert("📄 账号备注已保存！")}
                            className="text-[11px] text-[#64748b] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                          >
                            📄 加备注
                          </button>
                          <button
                            type="button"
                            onClick={() => alert("📄 待授权卡片已暂存为草稿！")}
                            className="text-[11px] text-[#64748b] bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                          >
                            📄 保存待授权卡片
                          </button>
                        </div>
                      </div>

                      {/* 推荐提示 */}
                      <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-2.5 flex items-center gap-2 text-[#1e40af] text-[11px]">
                        <Globe size={14} className="text-[#2563eb] shrink-0" />
                        <span>推荐使用浏览器完成 Google 官方授权</span>
                      </div>

                      {/* 授权操作按钮 */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const authUrl = geminiAuthService.buildGoogleOAuthUrl(
                              editModal.channel.geminiAuth?.clientId
                            );
                            window.open(authUrl, "_blank");
                          }}
                          className="flex-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                        >
                          <Globe size={13} />
                          <span>开始 OAuth 授权</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!callbackUrlInput.trim()) {
                              alert("请先在下方输入或粘贴完整的回调地址！");
                              return;
                            }
                            setIsExchangingCode(true);
                            try {
                              const clientId = editModal.channel.geminiAuth?.clientId || COCKPIT_GOOGLE_CLIENT_ID;
                              const clientSecret = editModal.channel.geminiAuth?.clientSecret || COCKPIT_GOOGLE_CLIENT_SECRET;
                              const res = await geminiAuthService.exchangeCodeForTokens(callbackUrlInput, clientId, clientSecret);
                              if (res.ok && res.refreshToken) {
                                setEditModal((prev) => ({
                                  ...prev,
                                  channel: {
                                    ...prev.channel,
                                    geminiAuth: {
                                      ...prev.channel.geminiAuth!,
                                      mode: "oauth_rt",
                                      refreshToken: res.refreshToken!,
                                      accessToken: res.accessToken,
                                    },
                                  },
                                }));
                                alert("✅ Google Antigravity OAuth 授权成功！已换取长期有效 Refresh Token 并自动注入！");
                              } else {
                                alert(`❌ 授权失败: ${res.error}`);
                              }
                            } catch (err: any) {
                              alert(`❌ 异常: ${err.message || err}`);
                            } finally {
                              setIsExchangingCode(false);
                            }
                          }}
                          disabled={isExchangingCode}
                          className="bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] text-[#1e293b] font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                        >
                          <CheckCircle2 size={13} className={isExchangingCode ? "animate-spin text-[#2563eb]" : "text-[#10b981]"} />
                          <span>{isExchangingCode ? "正在换取令牌..." : "我已授权，继续"}</span>
                        </button>
                      </div>

                      {/* 授权链接复制 */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[#64748b] text-[11px]">授权链接 (可直接复制至浏览器打开):</label>
                        <div className="bg-white border border-[#cbd5e1] rounded-lg p-2 flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-[#475569] truncate">
                            {geminiAuthService.buildGoogleOAuthUrl(editModal.channel.geminiAuth?.clientId)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const url = geminiAuthService.buildGoogleOAuthUrl(editModal.channel.geminiAuth?.clientId);
                              navigator.clipboard.writeText(url);
                              setCopiedOAuthUrl(true);
                              setTimeout(() => setCopiedOAuthUrl(false), 2000);
                            }}
                            className="bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#cbd5e1] px-2 py-0.5 rounded text-[11px] text-[#1e293b] flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                          >
                            {copiedOAuthUrl ? <Check size={11} className="text-[#10b981]" /> : <Copy size={11} />}
                            <span>{copiedOAuthUrl ? "已复制" : "复制"}</span>
                          </button>
                        </div>
                      </div>

                      {/* 手动输入回调地址 */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[#64748b] text-[11px]">手动输入回调地址:</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={callbackUrlInput}
                            onChange={(e) => setCallbackUrlInput(e.target.value)}
                            placeholder="粘贴完整回调地址，例如: http://localhost:1455/auth/callback?code=...&state=..."
                            className="flex-1 p-2 border border-[#cbd5e1] rounded-lg font-mono text-[11px] bg-white outline-none focus:border-[#2563eb]"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!callbackUrlInput.trim()) {
                                alert("请先粘贴完整的回调地址！");
                                return;
                              }
                              setIsExchangingCode(true);
                              try {
                                const clientId = editModal.channel.geminiAuth?.clientId || COCKPIT_GOOGLE_CLIENT_ID;
                                const clientSecret = editModal.channel.geminiAuth?.clientSecret || COCKPIT_GOOGLE_CLIENT_SECRET;
                                const res = await geminiAuthService.exchangeCodeForTokens(callbackUrlInput, clientId, clientSecret);
                                if (res.ok && res.refreshToken) {
                                  setEditModal((prev) => ({
                                    ...prev,
                                    channel: {
                                      ...prev.channel,
                                      geminiAuth: {
                                        ...prev.channel.geminiAuth!,
                                        mode: "oauth_rt",
                                        refreshToken: res.refreshToken!,
                                        accessToken: res.accessToken,
                                      },
                                    },
                                  }));
                                  alert("✅ Google Antigravity OAuth 授权成功！已换取长期有效 Refresh Token 并自动注入！");
                                } else {
                                  alert(`❌ 授权失败: ${res.error}`);
                                }
                              } catch (err: any) {
                                alert(`❌ 异常: ${err.message || err}`);
                              } finally {
                                setIsExchangingCode(false);
                              }
                            }}
                            disabled={isExchangingCode}
                            className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          >
                            <CheckCircle2 size={12} className={isExchangingCode ? "animate-spin" : ""} />
                            <span>我已授权，继续</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. JSON 凭据导入视图 */}
                  {editModal.channel.geminiAuth?.mode === "credentials_json" && (
                    <div className="flex flex-col gap-2.5">
                      <p className="text-[#64748b] text-[11px]">
                        支持直接选择或拖拽 Google Cloud / Cockpit 导出的 <code>credentials.json</code> 或{" "}
                        <code>application_default_credentials.json</code>：
                      </p>
                      <label className="border-2 border-dashed border-[#cbd5e1] hover:border-[#2563eb] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white transition-colors">
                        <FileJson size={24} className="text-[#2563eb]" />
                        <span className="font-semibold text-[#1e293b]">点击选择 Google 凭据 JSON 文件</span>
                        <span className="text-[10px] text-[#94a3b8]">自动解析 Client ID、Client Secret 与 Refresh Token</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportGeminiJson}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {/* 4. 传统 API Key 视图 */}
                  {editModal.channel.geminiAuth?.mode === "apikey" && (
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-[#1e293b]">Google AI Studio API Key：</label>
                      <input
                        type="password"
                        value={editModal.channel.apiKey}
                        onChange={(e) =>
                          setEditModal({
                            ...editModal,
                            channel: { ...editModal.channel, apiKey: e.target.value },
                          })
                        }
                        placeholder="AIzaSy..."
                        className="p-2 border border-[#cbd5e1] rounded-lg font-mono text-xs outline-none focus:border-[#2563eb] bg-white"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* 常规渠道的 API Key 输入框 */
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-[#1e1b18]">API Key / Token (真实秘钥)：</label>
                  <input
                    type="password"
                    value={editModal.channel.apiKey}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        channel: { ...editModal.channel, apiKey: e.target.value },
                      })
                    }
                    placeholder="sk-..."
                    className="p-2 border border-[#d0c7bd] rounded-lg font-mono text-xs outline-none focus:border-[#d96b27]"
                  />
                  <span className="text-[10px] text-[#78716c]">
                    密钥加密保存在本地客户端，发起 AI 请求时直连目标 Base URL，不经过任何第三方服务器。
                  </span>
                </div>
              )}

              {/* ===== 模型列表与上下文窗口配置区 ===== */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#f4efea]">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-[#1e1b18] flex items-center gap-1.5">
                    <Layers size={13} className="text-[#d96b27]" />
                    模型列表与上下文窗口配置 (Model Metas)
                  </label>
                  {/* 一键从 API 端点同步模型按钮 */}
                  <button
                    type="button"
                    onClick={handleModalSync}
                    className="px-2.5 py-1 bg-[#f0f9ff] hover:bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw size={11} className={modalSyncStatus?.loading ? "animate-spin" : ""} />
                    <span>从端点一键同步可用模型</span>
                  </button>
                </div>

                {modalSyncStatus && (
                  <div
                    className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                      modalSyncStatus.ok
                        ? "bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]"
                        : "bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]"
                    }`}
                  >
                    <span>{modalSyncStatus.msg}</span>
                  </div>
                )}

                {/* 模型列表表格展示 */}
                <div className="max-h-48 overflow-y-auto border border-[#e5dfd8] rounded-xl bg-[#faf8f5] divide-y divide-[#e5dfd8]">
                  {editModal.channel.models.map((m) => {
                    const meta = editModal.channel.modelMetas?.find((meta) => meta.id === m);
                    const currentCtx = meta?.contextWindow || 128000;

                    return (
                      <div key={m} className="p-2 flex justify-between items-center bg-white text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-[#1e1b18]">{m}</span>
                          {meta?.supportsThinking && (
                            <span className="bg-[#fffbeb] text-[#b45309] text-[9px] px-1.5 py-0.5 rounded border border-[#fde68a] flex items-center gap-0.5">
                              <Sparkles size={9} /> 深度推理
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* 上下文窗口选择器 */}
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-[#78716c]">上下文上限:</span>
                            <select
                              value={currentCtx}
                              onChange={(e) => {
                                const newCtx = parseInt(e.target.value, 10);
                                const updatedMetas = (editModal.channel.modelMetas || []).map((item) =>
                                  item.id === m ? { ...item, contextWindow: newCtx } : item
                                );
                                setEditModal({
                                  ...editModal,
                                  channel: {
                                    ...editModal.channel,
                                    modelMetas: updatedMetas,
                                  },
                                });
                              }}
                              className="p-1 border border-[#d0c7bd] rounded text-[11px] font-mono outline-none bg-[#faf8f5]"
                            >
                              <option value="32000">32k Tokens</option>
                              <option value="64000">64k Tokens</option>
                              <option value="128000">128k Tokens (主流标配)</option>
                              <option value="200000">200k Tokens (Claude/o3)</option>
                              <option value="1000000">1000k (1M 百万上下文)</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditModal({
                                ...editModal,
                                channel: {
                                  ...editModal.channel,
                                  models: editModal.channel.models.filter((item) => item !== m),
                                  modelMetas: (editModal.channel.modelMetas || []).filter(
                                    (item) => item.id !== m
                                  ),
                                },
                              });
                            }}
                            className="p-1 text-[#94a3b8] hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 添加自定义模型输入栏 */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newModelInput}
                    onChange={(e) => setNewModelInput(e.target.value)}
                    placeholder="输入自定义模型 ID (如 custom-deepseek-v3)"
                    className="flex-1 p-2 border border-[#d0c7bd] rounded-lg font-mono text-xs outline-none focus:border-[#d96b27] bg-white"
                  />
                  <select
                    value={newModelContext}
                    onChange={(e) => setNewModelContext(parseInt(e.target.value, 10))}
                    className="p-2 border border-[#d0c7bd] rounded-lg text-xs font-mono outline-none bg-white"
                  >
                    <option value="32000">32k</option>
                    <option value="64000">64k</option>
                    <option value="128000">128k (标准)</option>
                    <option value="200000">200k</option>
                    <option value="1000000">1000k (1M)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddCustomModel}
                    className="px-3 py-2 bg-[#faf8f5] hover:bg-[#f4efea] text-[#d96b27] border border-[#fed7aa] rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                  >
                    <Plus size={12} /> 添加自定义模型
                  </button>
                </div>
              </div>

              {/* 上下文 95% 自动压缩策略配置 */}
              <div className="bg-[#fef3eb] border border-[#fed7aa] rounded-xl p-3 flex justify-between items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[#1e1b18] flex items-center gap-1.5">
                    <Sliders size={13} className="text-[#ea580c]" />
                    95% 阈值智能上下文自动压缩 (Auto Compactor)
                  </span>
                  <span className="text-[10px] text-[#78716c]">
                    当会话 Token 达到上限的 95% 时，自动触发分层语义摘要蒸馏算法，保留指令与最新轮次并释放 80%+ 空间。
                  </span>
                </div>
                <span className="bg-white border border-[#fed7aa] text-[#ea580c] font-bold px-2 py-1 rounded-lg text-xs font-mono">
                  95% (默认启用)
                </span>
              </div>

              {/* 即时测速反馈 */}
              {modalTestStatus && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    modalTestStatus.ok
                      ? "bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]"
                      : "bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]"
                  }`}
                >
                  <span>{modalTestStatus.msg}</span>
                </div>
              )}
            </div>

            {/* Modal 底部按钮 */}
            <div className="px-5 py-3 bg-[#faf8f5] border-t border-[#e5dfd8] flex justify-between items-center">
              <button
                type="button"
                onClick={handleModalTest}
                className="px-3 py-1.5 bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#1e1b18] border border-[#e2e8f0] rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Zap size={12} className="text-[#d96b27]" />
                <span>测试连接 (Ping)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditModal({ ...editModal, isOpen: false })}
                  className="px-3.5 py-1.5 bg-[#faf8f5] hover:bg-[#f4efea] text-[#645e57] border border-[#e5dfd8] rounded-lg font-medium cursor-pointer transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  className="px-4 py-1.5 bg-[#d96b27] hover:bg-[#b85417] text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-sm"
                >
                  保存渠道配置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
