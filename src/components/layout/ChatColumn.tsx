import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  Sparkles,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Paperclip,
  GitBranch,
  Brain,
  Globe,
  X,
  Check,
  FileCode,
  Cpu,
  Server,
  AlertTriangle,
  Settings,
  Zap,
  Layers,
  Square,
  Copy,
  Code,
  RotateCcw,
  CheckCheck,
  Search,
  FolderPlus,
  Compass,
  Network,
} from "lucide-react";
import { LLMChannel } from "../../types";
import { llmConfigService } from "../../services/llmConfigService";
import { contextCompressor, ChatMessage } from "../../services/contextCompressor";
import { llmGatewayEngine } from "../../services/llmGatewayEngine";
import { nativeService } from "../../services/nativeService";
import { projectMemoryService } from "../../services/projectMemoryService";
import { projectKnowledgeGraphService } from "../../services/projectKnowledgeGraphService";
import { KnowledgeGraphModal } from "../knowledge/KnowledgeGraphModal";

export interface SlashItem {
  id: string;
  name: string;
  category: "skill" | "mcp" | "command";
  description: string;
  icon: string;
  command: string;
}

export const SLASH_ITEMS: SlashItem[] = [
  // 1. 核心 Skills
  {
    id: "skill-java-guard",
    name: "/java-enterprise-guard",
    category: "skill",
    description: "Java 5 维企业级架构守卫（NPE防御、DTO分离、MyBatis安全与规约扫描）",
    icon: "🛡️",
    command: "/java-enterprise-guard ",
  },
  {
    id: "skill-cloud-guard",
    name: "/cloud-distributed-guard",
    category: "skill",
    description: "分布式锁 / 缓存一致性 / Feign 通信 / Nacos 避坑守卫",
    icon: "☁️",
    command: "/cloud-distributed-guard ",
  },
  {
    id: "skill-mysql-tuning",
    name: "/mysql-ddl-tuning",
    category: "skill",
    description: "MySQL 表设计 / 索引最左匹配 / 慢 SQL / 深分页治理",
    icon: "🐬",
    command: "/mysql-ddl-tuning ",
  },
  {
    id: "skill-thermo-review",
    name: "/thermo-nuclear-review",
    category: "skill",
    description: "严苛代码质量审查与 Code Judo 降维简化",
    icon: "⚡",
    command: "/thermo-nuclear-review ",
  },
  {
    id: "skill-ui-ux",
    name: "/ui-ux-pro-max",
    category: "skill",
    description: "前端 UI/UX 设计规范先行与 6 态交互覆盖",
    icon: "🎨",
    command: "/ui-ux-pro-max ",
  },
  {
    id: "skill-test-gov",
    name: "/test-governance",
    category: "skill",
    description: "自动化测试设计 / TDD 红绿循环与 Mock 边界治理",
    icon: "🧪",
    command: "/test-governance ",
  },
  {
    id: "skill-steelman",
    name: "/steelman",
    category: "skill",
    description: "深度思辨 / 双向钢人原则与技术方案抗压推演",
    icon: "🧠",
    command: "/steelman ",
  },

  // 2. 外部 MCP 工具协议 (Model Context Protocol)
  {
    id: "mcp-filesystem",
    name: "/mcp:filesystem",
    category: "mcp",
    description: "本地磁盘文件系统深度遍历、读写与监控",
    icon: "📁",
    command: "/mcp:filesystem ",
  },
  {
    id: "mcp-git",
    name: "/mcp:git",
    category: "mcp",
    description: "Git 仓库分支管理、Commit 比对与工作流",
    icon: "🌿",
    command: "/mcp:git ",
  },
  {
    id: "mcp-fetch",
    name: "/mcp:fetch",
    category: "mcp",
    description: "远程 HTTP / Web 协议与外部 API 调用探针",
    icon: "🌐",
    command: "/mcp:fetch ",
  },
  {
    id: "mcp-database",
    name: "/mcp:postgres-mysql",
    category: "mcp",
    description: "数据库连接池与参数化 SQL 执行工具",
    icon: "🗄️",
    command: "/mcp:postgres-mysql ",
  },

  // 3. 快速开发 Commands
  {
    id: "cmd-explain",
    name: "/explain",
    category: "command",
    description: "深度剖析选定代码实现、架构设计与调用链",
    icon: "📖",
    command: "/explain ",
  },
  {
    id: "cmd-refactor",
    name: "/refactor",
    category: "command",
    description: "重构当前逻辑并消除冗余分支与圈复杂度",
    icon: "♻️",
    command: "/refactor ",
  },
  {
    id: "cmd-fix",
    name: "/fix",
    category: "command",
    description: "快速定位排查 Bug 并输出修复补丁",
    icon: "🔧",
    command: "/fix ",
  },
  {
    id: "cmd-test",
    name: "/test",
    category: "command",
    description: "为当前模块编写覆盖正常/异常/边界的单元测试",
    icon: "🔬",
    command: "/test ",
  },
];

export interface StandardMessage extends ChatMessage {
  channelName?: string;
  modelName?: string;
  reasoningContent?: string;
  durationMs?: number;
  tokensCount?: number;
  tokensPerSec?: number;
  status?: "streaming" | "completed" | "error" | "aborted";
  errorDetail?: string;
  statusCode?: number;
}

interface ChatColumnProps {
  width?: number;
  activeSessionId?: string;
  sessionTitle?: string;
  projectName?: string;
  onOpenSettings?: () => void;
}

export const ChatColumn: React.FC<ChatColumnProps> = ({
  width,
  activeSessionId = "sess-1",
  sessionTitle,
  projectName = "agent-learning",
  onOpenSettings,
}) => {
  const [input, setInput] = useState("");
  const [channels, setChannels] = useState<LLMChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<LLMChannel | undefined>(undefined);
  const [activeModel, setActiveModel] = useState<string>("qwen-plus-latest");

  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [detectedGitBranch, setDetectedGitBranch] = useState<string | null>(null);

  // 知识图谱查看弹窗状态
  const [isKgModalOpen, setIsKgModalOpen] = useState(false);

  // 文件选择模态弹窗状态 (独立弹窗选择文件)
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [fileModalSearch, setFileModalSearch] = useState("");
  const localFileInputRef = useRef<HTMLInputElement>(null);

  // Slash Command / Skill / MCP 联想菜单状态
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  // 新建会话默认不关联任何文件 (空数组)
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(true);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [compressionNotice, setCompressionNotice] = useState<string | null>(null);

  // 回车发送模式：默认 "enter" (Enter发送，Shift+Enter换行)，可切换 "ctrl_enter" (Ctrl+Enter发送)
  const [sendShortcut, setSendShortcut] = useState<"enter" | "ctrl_enter">(() => {
    return (localStorage.getItem("codemind_send_shortcut") as any) || "enter";
  });

  const toggleSendShortcut = () => {
    const next = sendShortcut === "enter" ? "ctrl_enter" : "enter";
    setSendShortcut(next);
    localStorage.setItem("codemind_send_shortcut", next);
  };

  // 探测真实 Git 分支
  useEffect(() => {
    const checkGit = async () => {
      const branch = await nativeService.getGitBranch();
      setDetectedGitBranch(branch);
    };
    checkGit();
  }, []);

  // 过滤后的 Slash / Skill / MCP 列表
  const filteredSlashItems = SLASH_ITEMS.filter((item) => {
    if (!slashQuery.trim()) return true;
    const q = slashQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // 处理输入变化与 / 唤起
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastSlashIdx = textBeforeCursor.lastIndexOf("/");

    if (lastSlashIdx !== -1) {
      const query = textBeforeCursor.slice(lastSlashIdx + 1);
      if (!/\s/.test(query)) {
        setSlashQuery(query);
        setIsSlashMenuOpen(true);
        setSelectedSlashIdx(0);
        return;
      }
    }
    setIsSlashMenuOpen(false);
  };

  // 选中 Skill / MCP / Command 项
  const handleSelectSlashItem = (item: SlashItem) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);
    const lastSlashIdx = textBeforeCursor.lastIndexOf("/");

    if (lastSlashIdx !== -1) {
      const prefix = textBeforeCursor.slice(0, lastSlashIdx);
      const newInput = `${prefix}${item.command}${textAfterCursor}`;
      setInput(newInput);
      setIsSlashMenuOpen(false);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = prefix.length + item.command.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 50);
    }
  };

  // 从 Windows 系统选择本地文件并挂载
  const handleOpenLocalWindowsFileDialog = async () => {
    if (typeof (window as any).showOpenFilePicker === "function") {
      try {
        const fileHandles = await (window as any).showOpenFilePicker({
          multiple: true,
        });
        if (fileHandles && fileHandles.length > 0) {
          const names: string[] = [];
          for (const handle of fileHandles) {
            names.push(handle.name);
          }
          setAttachedFiles((prev) => Array.from(new Set([...prev, ...names])));
          setIsFileModalOpen(false);
          return;
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.warn("showOpenFilePicker fallback:", err);
      }
    }

    if (localFileInputRef.current) {
      localFileInputRef.current.value = "";
      localFileInputRef.current.click();
    }
  };

  const handleLocalFileNativeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const names: string[] = [];
    for (let i = 0; i < files.length; i++) {
      names.push(files[i].name);
    }
    setAttachedFiles((prev) => Array.from(new Set([...prev, ...names])));
    setIsFileModalOpen(false);
  };

  // 粘贴图片附件状态与多模态检测
  const [pastedImages, setPastedImages] = useState<
    { id: string; name: string; dataUrl: string; size: number }[]
  >([]);

  // 视觉多模态检测支持判定 (判断模型是否支持图片输入)
  const isVisionSupported = (modelName: string): boolean => {
    const m = modelName.toLowerCase();
    return (
      m.includes("vl") ||
      m.includes("vision") ||
      m.includes("gpt-4o") ||
      m.includes("gpt-4-turbo") ||
      m.includes("gemini-1.5") ||
      m.includes("gemini-2.0") ||
      m.includes("claude-3") ||
      m.includes("qwen-vl")
    );
  };

  // 处理剪贴板粘贴事件 (支持直接 Ctrl+V 粘贴截图、图片与拖入文件)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            const dataUrl = loadEvt.target?.result as string;
            setPastedImages((prev) => [
              ...prev,
              {
                id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: file.name || `screenshot_${Date.now()}.png`,
                dataUrl,
                size: file.size,
              },
            ]);
          };
          reader.readAsDataURL(file);
        }
      } else if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          setAttachedFiles((prev) => Array.from(new Set([...prev, file.name])));
        }
      }
    }
  };

  // 流式生成与中断控制器
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [collapsedThinking, setCollapsedThinking] = useState<Record<number, boolean>>({});

  const channelDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // 加载指定会话的消息历史 (短期高保真记忆持久化)
  const [messages, setMessages] = useState<StandardMessage[]>(() => {
    const saved = projectMemoryService.getSessionMessages(activeSessionId);
    if (saved && saved.length > 0) return saved as StandardMessage[];
    return [
      {
        role: "assistant",
        channelName: "阿里百炼 (DashScope)",
        modelName: "qwen-plus-latest",
        content:
          "您好！我是 CodeMind 统一大模型编程助手。已为您接入 **New API / Cockpit 级生产级流式网关**。\n\n• 所有厂商输出采用统一标准结构回显（性能元数据、深度推理链、语法高亮与操作条）\n• 实时 **SSE 逐 Token 流式输出**，已融合 **工程知识图谱 (Graph-RAG)** 与 **双层长短期记忆机制**。",
        status: "completed",
      },
    ];
  });

  // 当活跃会话 ID 切换时，平滑切换并加载对应会话的历史记录 (绝不丢失之前回答)
  useEffect(() => {
    const sid = activeSessionId || "sess-1";
    const saved = projectMemoryService.getSessionMessages(sid);
    if (saved && saved.length > 0) {
      setMessages(saved as StandardMessage[]);
    } else {
      setMessages([
        {
          role: "assistant",
          channelName: activeChannel?.name || "阿里百炼 (DashScope)",
          modelName: activeModel,
          content: `已为您就绪新会话【${sessionTitle || sid}】。已挂载 **【${projectName}】** 真实工程知识图谱与长期情景记忆！`,
          status: "completed",
        },
      ]);
    }
  }, [activeSessionId]);

  // 消息变更时自动同步写入持久化存储
  useEffect(() => {
    const sid = activeSessionId || "sess-1";
    if (messages.length > 0) {
      projectMemoryService.saveSessionMessages(sid, messages);
    }
  }, [messages, activeSessionId]);

  // 使用 rAF 节流执行平滑滚底 (防止高频 Token 流式吐字拖垮 UI 渲染线程)
  const scrollRafIdRef = useRef<number | null>(null);
  const scrollToBottom = () => {
    if (scrollRafIdRef.current) return;
    scrollRafIdRef.current = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      scrollRafIdRef.current = null;
    });
  };

  // 渲染格式化 Markdown 与代码块 (带行号、复制与一键插入编辑器按钮)
  const renderFormattedMarkdown = (content: string) => {
    if (!content) return null;
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, partIdx) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const firstLineEnd = part.indexOf("\n");
        const lang = firstLineEnd !== -1 ? part.slice(3, firstLineEnd).trim() : "";
        const code = firstLineEnd !== -1 ? part.slice(firstLineEnd + 1, -3) : part.slice(3, -3);
        const lines = code.split("\n");

        return (
          <div
            key={partIdx}
            className="my-2 rounded-xl overflow-hidden border border-[#e5dfd8] bg-[#18181b] text-white font-mono text-[11px] shadow-sm select-text"
          >
            <div className="h-7 bg-[#27272a] px-3 flex items-center justify-between border-b border-[#3f3f46] text-[10px] text-[#a1a1aa] select-none">
              <span className="font-semibold text-[#38bdf8] uppercase">{lang || "code"}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  title="复制代码"
                >
                  <Copy size={10} /> 复制
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-workspace-file", {
                        detail: {
                          name: `snippet_${partIdx}.${lang || "ts"}`,
                          content: code,
                          path: `src/snippet_${partIdx}.${lang || "ts"}`,
                        },
                      })
                    );
                  }}
                  className="hover:text-[#d96b27] flex items-center gap-1 cursor-pointer transition-colors text-[#fb923c]"
                  title="插入到右侧代码工作区"
                >
                  <Code size={10} /> ‹/› 插入编辑器
                </button>
              </div>
            </div>
            <div className="p-3 overflow-x-auto leading-relaxed select-text flex">
              <div className="text-[#52525b] pr-3 select-none text-right border-r border-[#27272a] mr-3 font-mono">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <pre className="flex-1 font-mono text-[#e4e4e7] overflow-x-auto">{code}</pre>
            </div>
          </div>
        );
      }

      return (
        <div key={partIdx} className="whitespace-pre-wrap leading-relaxed">
          {part}
        </div>
      );
    });
  };

  useEffect(() => {
    scrollToBottom();
    return () => {
      if (scrollRafIdRef.current) {
        cancelAnimationFrame(scrollRafIdRef.current);
        scrollRafIdRef.current = null;
      }
    };
  }, [messages, isGenerating]);

  // 计算当前 Token 占用与上下文容量
  const currentTokens = contextCompressor.estimateMessagesTokens(messages);
  const contextWindow = llmConfigService.getActiveModelContextWindow();
  const tokenUsagePercent = Math.min(100, Math.round((currentTokens / contextWindow) * 100));

  // 载入真实渠道配置
  const syncConfig = () => {
    const all = llmConfigService.getChannels();
    setChannels(all);
    const curr = llmConfigService.getActiveChannel();
    setActiveChannel(curr);
    setActiveModel(llmConfigService.getActiveModel());
  };

  useEffect(() => {
    syncConfig();
    const handleUpdate = () => syncConfig();
    window.addEventListener("llm-config-updated", handleUpdate);
    return () => window.removeEventListener("llm-config-updated", handleUpdate);
  }, []);

  const [availableFiles, setAvailableFiles] = useState<string[]>([
    "src/App.tsx",
    "src/components/layout/ChatColumn.tsx",
    "src/components/layout/LeftPanel.tsx",
    "src/services/llmGatewayEngine.ts",
    "src-tauri/tauri.conf.json",
    "package.json",
    "README.md"
  ]);
  const [currentProjectName, setCurrentProjectName] = useState(projectName);

  useEffect(() => {
    const handleProjectSwitched = async (e: any) => {
      const { projectName: pName, files, fullPath } = e.detail || {};
      if (pName) {
        setCurrentProjectName(pName);
        if (Array.isArray(files) && files.length > 0) {
          setAvailableFiles(files);
        }
        // 切换项目时不默认关联文件，由用户自主点击添加
        setAttachedFiles([]);

        // 探测新项目所在路径的 Git 分支
        const realBranch = await nativeService.getGitBranch(fullPath);
        setDetectedGitBranch(realBranch);
      }
    };
    window.addEventListener("project-switched", handleProjectSwitched);
    return () => window.removeEventListener("project-switched", handleProjectSwitched);
  }, [activeChannel, activeModel]);

  // 点击外部关闭下拉菜单与 Slash 菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(e.target as Node)) {
        setIsChannelDropdownOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(e.target as Node) &&
        !textareaRef.current?.contains(e.target as Node)
      ) {
        setIsSlashMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 手动/自动触发 95% 上下文分层压缩
  const triggerContextCompression = () => {
    const res = contextCompressor.compressContext(messages, contextWindow, 0.95);
    if (res.wasCompressed) {
      setMessages(res.compressedMessages as StandardMessage[]);
      setCompressionNotice(
        `⚡ 95% 分层语义压缩生效：已释放 ${res.savedTokens} Tokens (${res.ratioPercent}% 节省)`
      );
      setTimeout(() => setCompressionNotice(null), 5000);
    } else {
      setCompressionNotice("当前上下文未达到 95% 压缩阈值，当前空间充裕无需精简。");
      setTimeout(() => setCompressionNotice(null), 3000);
    }
  };

  // 核心统一网关发送与真实流式调度
  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    const userPrompt = input.trim();
    const imagesToAttach = [...pastedImages];
    setInput("");
    setPastedImages([]);

    const targetChan = activeChannel || channels[0];
    const targetModel = activeModel;

    // 1. 追加用户消息 (含图片附件提示)
    let displayPrompt = userPrompt;
    if (imagesToAttach.length > 0) {
      displayPrompt = `[🖼️ 已挂载 ${imagesToAttach.length} 张图片附件: ${imagesToAttach.map((img) => img.name).join(", ")}]\n\n` + userPrompt;
    }

    const userMsg: StandardMessage = {
      role: "user",
      content: displayPrompt,
    };

    // 2. 预先创建 AI 回复占位卡片 (统一标准结构)
    const assistantPlaceholder: StandardMessage = {
      role: "assistant",
      channelName: targetChan.name,
      modelName: targetModel,
      content: "",
      reasoningContent: "",
      status: "streaming",
    };

    const currentHistory = [...messages, userMsg];
    setMessages([...currentHistory, assistantPlaceholder]);
    setIsGenerating(true);
    // 派发运行中状态 (绿色旋转圆标)
    window.dispatchEvent(new CustomEvent("session-status-changed", { detail: { status: "running" } }));

    // 创建中断控制器
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 1. 意图驱动检索真实工程知识图谱 (Graph-RAG)
    const graphContext = projectKnowledgeGraphService.queryRelevantGraphContext(
      currentProjectName,
      userMsg.content,
      availableFiles
    );

    // 2. 意图驱动检索项目长期情景记忆 (LTM)
    const relevantMemories = projectMemoryService.queryRelevantMemories(
      currentProjectName,
      userMsg.content,
      3
    );
    const memoryContext =
      relevantMemories.length > 0
        ? `\n### 🧠 【${currentProjectName}】长期情景与架构记忆 (Project Long-Term Memory):\n` +
          relevantMemories.map((m) => `• [${m.category.toUpperCase()}] ${m.summary}`).join("\n")
        : "";

    // 3. 构建 ReAct 智能体系统上下文 (融合知识图谱与双层记忆)
    const reactSystemPrompt = `You are CodeMind AI, an expert ReAct (Reasoning + Acting) software engineering assistant.
Current Workspace Project: "${currentProjectName}"
Git Branch: ${detectedGitBranch || "None (Not a git repository)"}
Project Files: ${availableFiles.slice(0, 15).join(", ")}
${attachedFiles.length > 0 ? `Attached Context Files: ${attachedFiles.join(", ")}` : "No explicit files attached."}

${graphContext}
${memoryContext}

Instructions:
1. Always ground your technical answers in the current project codebase, knowledge graph topology, and architectural memories.
2. Follow the ReAct paradigm: Analyze intent -> Plan -> Produce clean, production-grade solutions.
3. Respond in concise, professional Simplified Chinese (简体中文).`;

    const requestMessages = [
      { role: "system", content: reactSystemPrompt },
      ...currentHistory.map((m) => ({ role: m.role, content: m.content })),
    ];

    // 4. 调度网关流式引擎
    await llmGatewayEngine.dispatchStream({
      channel: targetChan,
      model: targetModel,
      messages: requestMessages,
      enableThinking: isThinkingEnabled,
      abortSignal: controller.signal,
      callbacks: {
        onToken: (contentChunk, reasoningChunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const target = updated[updated.length - 1];
            if (target && target.role === "assistant") {
              if (contentChunk) {
                target.content += contentChunk;
              }
              if (reasoningChunk) {
                target.reasoningContent = (target.reasoningContent || "") + reasoningChunk;
              }
              target.status = "streaming";
            }
            return updated;
          });
        },
        onComplete: (meta) => {
          setIsGenerating(false);
          // 派发空闲状态 (蓝色圆标)
          window.dispatchEvent(new CustomEvent("session-status-changed", { detail: { status: "idle" } }));
          setMessages((prev) => {
            const updated = [...prev];
            const target = updated[updated.length - 1];
            if (target && target.role === "assistant") {
              target.status = "completed";
              target.durationMs = meta.durationMs;
              target.tokensCount = meta.tokensCount;
              target.tokensPerSec = meta.tokensPerSec;

              // 自动提取长期情景记忆沉淀到项目存储库
              projectMemoryService.autoExtractMemoriesFromTurn(
                currentProjectName,
                userMsg.content,
                target.content
              );
            }
            return updated;
          });
        },
        onError: (errMsg, statusCode) => {
          setIsGenerating(false);
          // 派发失败状态 (红色圆标)
          window.dispatchEvent(new CustomEvent("session-status-changed", { detail: { status: "error" } }));
          setMessages((prev) => {
            const updated = [...prev];
            const target = updated[updated.length - 1];
            if (target && target.role === "assistant") {
              target.status = "error";
              target.errorDetail = errMsg;
              target.statusCode = statusCode;
            }
            return updated;
          });
        },
      },
    });
  };

  // 停止生成
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    window.dispatchEvent(new CustomEvent("session-status-changed", { detail: { status: "idle" } }));
    setMessages((prev) => {
      const updated = [...prev];
      const target = updated[updated.length - 1];
      if (target && target.role === "assistant" && target.status === "streaming") {
        target.status = "aborted";
      }
      return updated;
    });
  };

  // 复制单条消息
  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 1500);
  };

  const toggleAttachFile = (file: string) => {
    setAttachedFiles((prev) =>
      prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file]
    );
  };

  return (
    <section
      style={width !== undefined ? { width: `${width}px` } : undefined}
      className={`bg-white border-r border-[#e5dfd8] flex flex-col justify-between relative overflow-hidden select-none ${
        width !== undefined ? "shrink-0" : "flex-1"
      }`}
    >
      {/* 顶部标题与状态 */}
      <div className="px-4 py-2.5 border-b border-[#e5dfd8] flex justify-between items-center text-xs bg-[#faf8f5]">
        <div className="flex items-center gap-1.5 font-bold text-[#1e1b18]">
          <Sparkles size={13} className="text-[#d96b27]" />
          <span>AI 编程协同 · {currentProjectName}</span>
        </div>
        <div className="flex items-center gap-2">
          {activeChannel && (
            <span className="text-[10px] text-[#475569] bg-[#f1f5f9] border border-[#cbd5e1] px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
              {activeChannel.name.split(" ")[0]} · {activeModel}
            </span>
          )}
        </div>
      </div>

      {/* 消息滚动区 */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 text-xs leading-relaxed select-text">
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          const isThinkingOpen = !collapsedThinking[idx];

          if (isUser) {
            return (
              <div
                key={idx}
                className="flex flex-col gap-1 p-3.5 rounded-xl shadow-2xs bg-[#fef0e7] border border-[#fed7aa] ml-8"
              >
                <div className="flex items-center justify-between font-semibold text-[11px] text-[#645e57]">
                  <div className="flex items-center gap-1.5">
                    <UserIcon size={12} className="text-[#d96b27]" />
                    <span>您</span>
                  </div>
                  <span className="text-[10px] text-[#9c948a] font-normal">刚刚</span>
                </div>
                <div className="text-[#1e1b18] whitespace-pre-wrap">{m.content}</div>
              </div>
            );
          }

          // 标准统一 AI 网关响应卡片 (Standard Gateway Output Structure)
          return (
            <div
              key={idx}
              className="flex flex-col gap-2 p-3.5 rounded-xl shadow-2xs bg-white border border-[#e5dfd8] mr-2"
            >
              {/* Layer 1: 厂商路由与性能元数据头部条 */}
              <div className="flex items-center justify-between border-b border-[#f4efea] pb-2 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 font-bold text-[#1e1b18]">
                    <Bot size={13} className="text-[#10b981]" />
                    <span>CodeMind AI</span>
                  </div>
                  <span className="bg-[#f4efea] text-[#78716c] px-1.5 py-0.5 rounded font-mono text-[10px]">
                    {m.channelName || "网关路由"}
                  </span>
                  <span className="bg-[#eff6ff] text-[#1d4ed8] px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold border border-[#bfdbfe]">
                    {m.modelName || "model"}
                  </span>
                </div>

                {/* 状态与吞吐性能标签 */}
                <div className="flex items-center gap-2 text-[10px] text-[#78716c] font-mono">
                  {m.status === "streaming" && (
                    <span className="text-[#d96b27] flex items-center gap-1 animate-pulse font-semibold">
                      <Zap size={10} /> 正在流式生成...
                    </span>
                  )}
                  {m.status === "completed" && (
                    <span className="text-[#059669] flex items-center gap-1">
                      <Check size={10} /> 耗时 {(m.durationMs ? m.durationMs / 1000 : 0.8).toFixed(1)}s
                      {m.tokensPerSec ? ` (${m.tokensPerSec} t/s)` : ""}
                    </span>
                  )}
                  {m.status === "aborted" && (
                    <span className="text-[#ea580c] flex items-center gap-1">
                      <Square size={10} /> 已中断
                    </span>
                  )}
                  {m.status === "error" && (
                    <span className="text-[#dc2626] font-semibold flex items-center gap-1">
                      <AlertTriangle size={10} /> 调度异常
                    </span>
                  )}
                </div>
              </div>

              {/* Layer 2: 深度推理思考过程卡片 (Deep Thinking Process) */}
              {m.reasoningContent && (
                <div className="bg-[#fffbeb] border border-[#fde68a] rounded-lg p-2.5 flex flex-col gap-1.5 text-xs">
                  <div
                    onClick={() =>
                      setCollapsedThinking((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                    className="flex justify-between items-center cursor-pointer select-none text-[#b45309] font-semibold text-[11px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <Brain size={12} className="text-[#d97706] animate-pulse" />
                      <span>深度思考链 (Deep Thinking Process)</span>
                    </div>
                    {isThinkingOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>
                  {isThinkingOpen && (
                    <div className="text-[#78350f] text-[11px] leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-[#f59e0b] font-mono">
                      {m.reasoningContent}
                    </div>
                  )}
                </div>
              )}

              {/* Layer 3: 实时正文 Markdown / 代码流式渲染区 */}
              {m.status === "error" ? (
                /* 错误与未配置 Key 诊断卡片 */
                <div className="bg-[#fef2f2] border border-[#fecaca] p-3 rounded-lg flex flex-col gap-2 text-[#991b1b]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-[#dc2626] shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <span className="font-bold">网关调用鉴权或连接失败</span>
                      <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{m.errorDetail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-[#fee2e2]">
                    <button
                      onClick={onOpenSettings}
                      className="px-3 py-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Settings size={11} /> 前往配置 API Key
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[#1e1b18] leading-relaxed">
                  {renderFormattedMarkdown(m.content)}
                  {/* 流式打字光标 */}
                  {m.status === "streaming" && (
                    <span className="inline-block w-2 h-3.5 bg-[#d96b27] ml-1 animate-pulse align-middle" />
                  )}
                </div>
              )}

              {/* Layer 4: 统一标准化快捷操作栏 */}
              {m.content && m.status !== "streaming" && (
                <div className="pt-2 border-t border-[#f4efea] flex justify-between items-center text-[10px] text-[#78716c]">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyMessage(m.content, idx)}
                      className="hover:text-[#1e1b18] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedMsgIdx === idx ? (
                        <>
                          <CheckCheck size={11} className="text-green-600" />
                          <span className="text-green-600 font-semibold">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>复制全文</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        let codeToInsert = m.content;
                        const match = m.content.match(/```(?:\w+)?\n([\s\S]*?)```/);
                        if (match && match[1]) {
                          codeToInsert = match[1];
                        }
                        window.dispatchEvent(
                          new CustomEvent("open-workspace-file", {
                            detail: {
                              name: "solution.ts",
                              content: codeToInsert,
                              path: "src/solution.ts",
                            },
                          })
                        );
                      }}
                      className="hover:text-[#d96b27] flex items-center gap-1 cursor-pointer transition-colors"
                      title="展开右侧工作区并载入生成代码"
                    >
                      <Code size={11} />
                      <span>‹/› 插入到代码区</span>
                    </button>
                  </div>

                  <button
                    onClick={handleSend}
                    className="hover:text-[#1e1b18] flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={10} />
                    <span>重新生成</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 底部输入框与一体化控制台 */}
      <div className="p-3 border-t border-[#e5dfd8] bg-[#faf8f5] flex flex-col gap-2">
        {/* 上下文压缩实时反馈横幅 */}
        {compressionNotice && (
          <div className="bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] animate-in fade-in">
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-[#10b981] shrink-0" />
              <span>{compressionNotice}</span>
            </div>
            <button
              onClick={() => setCompressionNotice(null)}
              className="text-[#059669] hover:text-[#064e3b] cursor-pointer"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* 上下文容量实时进度指示条 (达到 95% 自动压缩) */}
        <div className="flex items-center justify-between px-1 text-[10px] text-[#78716c]">
          <div className="flex items-center gap-1.5">
            <Layers size={11} className="text-[#d96b27]" />
            <span>
              上下文: <strong>{(currentTokens / 1000).toFixed(1)}k</strong> /{" "}
              {(contextWindow / 1000).toFixed(0)}k ({tokenUsagePercent}%)
            </span>
            <div className="w-16 h-1.5 bg-[#e5dfd8] rounded-full overflow-hidden ml-1">
              <div
                style={{ width: `${tokenUsagePercent}%` }}
                className={`h-full transition-all ${
                  tokenUsagePercent >= 95
                    ? "bg-[#ef4444]"
                    : tokenUsagePercent >= 80
                    ? "bg-[#f59e0b]"
                    : "bg-[#10b981]"
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] bg-[#f4efea] px-1.5 py-0.5 rounded text-[#78716c] font-mono">
              95% 自动压缩就绪
            </span>
            <button
              type="button"
              onClick={triggerContextCompression}
              className="text-[#d96b27] hover:underline cursor-pointer flex items-center gap-0.5"
              title="手动立即触发上下文分层压缩"
            >
              <Zap size={9} /> 压缩
            </button>
          </div>
        </div>

        {/* 已选文件上下文标签条 */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-[10px] text-[#78716c] font-medium flex items-center gap-1">
              <Paperclip size={10} /> 上下文:
            </span>
            {attachedFiles.map((file) => (
              <span
                key={file}
                className="bg-white border border-[#e7e2d9] text-[#44403c] text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs"
              >
                <FileCode size={10} className="text-[#d96b27]" />
                <span className="max-w-[130px] truncate">{file.split("/").pop()}</span>
                <button
                  type="button"
                  onClick={() => toggleAttachFile(file)}
                  className="hover:text-red-500 cursor-pointer"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 核心输入框容器 (含 / 键触发的 Skill / MCP 智能联想菜单) */}
        <div className="bg-white border border-[#d0c7bd] focus-within:border-[#d96b27] focus-within:ring-2 focus-within:ring-[#fed7aa]/50 rounded-xl p-2.5 flex flex-col gap-2 shadow-2xs transition-all relative">
          
          {/* 输入框键入 / 触发的 Skills & MCP 选择浮层 */}
          {isSlashMenuOpen && (
            <div
              ref={slashMenuRef}
              className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-[#e5dfd8] rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 scrollbar-thin"
            >
              <div className="px-2 py-1 border-b border-[#f4efea] flex justify-between items-center text-[10px] text-[#78716c] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1 text-[#d96b27]">
                  <Compass size={12} /> 快捷技能 (Skills) & MCP 工具选择
                </span>
                <span className="font-normal lowercase">
                  ↑↓ 切换 · Enter / Tab 插入 · Esc 关闭
                </span>
              </div>

              {filteredSlashItems.length === 0 ? (
                <div className="p-3 text-center text-[#9ca3af] text-xs">
                  未找到匹配的 Skill 或 MCP 工具
                </div>
              ) : (
                filteredSlashItems.map((item, idx) => {
                  const isSelected = idx === selectedSlashIdx;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSlashItem(item)}
                      onMouseEnter={() => setSelectedSlashIdx(idx)}
                      className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected
                          ? "bg-[#fef3eb] text-[#1e1b18] border border-[#fed7aa]"
                          : "hover:bg-[#faf8f5] text-[#374151]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{item.icon}</span>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-[#1e1b18] font-mono">
                              {item.name}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                item.category === "skill"
                                  ? "bg-[#fef3c7] text-[#92400e]"
                                  : item.category === "mcp"
                                  ? "bg-[#e0e7ff] text-[#3730a3]"
                                  : "bg-[#f3f4f6] text-[#4b5563]"
                              }`}
                            >
                              {item.category}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#6b7280] truncate">
                            {item.description}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] text-[#ea580c] font-semibold shrink-0">
                          插入 ↵
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 粘贴图片与附件预览栏 */}
          {(pastedImages.length > 0 || attachedFiles.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 mb-2 p-1.5 bg-[#faf8f5] rounded-lg border border-[#f4efea]">
              {pastedImages.map((img) => (
                <div key={img.id} className="relative group shrink-0">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-14 h-14 object-cover rounded-md border border-[#e5dfd8] shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setPastedImages((prev) => prev.filter((p) => p.id !== img.id))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] cursor-pointer shadow-xs hover:bg-red-600 transition-colors"
                    title="移除图片"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {attachedFiles.map((file) => (
                <span
                  key={file}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] rounded-md text-[11px] font-mono"
                >
                  <Paperclip size={11} />
                  <span className="max-w-[120px] truncate">{file.split("/").pop()}</span>
                  <button
                    type="button"
                    onClick={() => toggleAttachFile(file)}
                    className="hover:text-red-500 cursor-pointer ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 若粘贴了图片但当前模型不支持视觉多模态，给出醒目提示 */}
          {pastedImages.length > 0 && !isVisionSupported(activeModel) && (
            <div className="mb-2 px-2.5 py-1.5 bg-[#fffbeb] border border-[#fde68a] rounded-lg text-[11px] text-[#b45309] flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-[#d97706] shrink-0" />
                <span>
                  ⚠️ 当前模型【<b>{activeModel}</b>】暂未开启多模态视觉 (Vision)。已挂载图片，建议切换至【<b>qwen-vl-max / gpt-4o / gemini-2.0-flash / claude-3-5-sonnet</b>】。
                </span>
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (isSlashMenuOpen && filteredSlashItems.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedSlashIdx((prev) => (prev + 1) % filteredSlashItems.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedSlashIdx((prev) => (prev - 1 + filteredSlashItems.length) % filteredSlashItems.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  handleSelectSlashItem(filteredSlashItems[selectedSlashIdx]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setIsSlashMenuOpen(false);
                  return;
                }
              }

              if (sendShortcut === "enter") {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              } else {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }
            }}
            placeholder={
              sendShortcut === "enter"
                ? "输入代码指令、问题或输入 / 选择 Skill / MCP... (支持 Ctrl+V 粘贴图片与文件，Enter 发送)"
                : "输入代码指令、问题或输入 / 选择 Skill / MCP... (支持 Ctrl+V 粘贴图片与文件，Ctrl+Enter 发送)"
            }
            className="w-full text-xs text-[#1e1b18] outline-none resize-none h-16 leading-relaxed select-text"
          />

          {/* 输入框底部双级选择器与功能条 (厂商选择 ➔ 模型选择 ➔ 文件 ➔ 分支 ➔ 发送/停止) */}
          <div className="pt-2 border-t border-[#f1f5f9] flex flex-wrap items-center justify-between gap-2 relative">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 1. 一级：厂商/渠道选择器 (Provider / Channel) */}
              <div className="relative" ref={channelDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsChannelDropdownOpen((prev) => !prev);
                    setIsModelDropdownOpen(false);
                  }}
                  className="h-6.5 px-2 bg-[#fef3eb] hover:bg-[#fed7aa]/60 text-[#c2410c] rounded-md text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer border border-[#fed7aa] transition-colors"
                >
                  <Server size={11} className="text-[#ea580c]" />
                  <span className="max-w-[95px] truncate">{activeChannel?.name || "选择厂商"}</span>
                  <ChevronDown size={10} className="text-[#c2410c]" />
                </button>

                {/* 渠道下拉菜单浮层 */}
                {isChannelDropdownOpen && (
                  <div className="absolute bottom-8 left-0 w-72 bg-white border border-[#e5dfd8] rounded-xl shadow-xl p-1.5 z-50 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95">
                    <div className="px-2 py-1 text-[10px] font-bold text-[#78716c] uppercase tracking-wider border-b border-[#f4efea] flex justify-between items-center">
                      <span>选择大模型供应商 / 渠道</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsChannelDropdownOpen(false);
                          if (onOpenSettings) onOpenSettings();
                        }}
                        className="text-[#d96b27] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <Settings size={9} /> 管理
                      </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto flex flex-col gap-1">
                      {channels.map((chan) => (
                        <div
                          key={chan.id}
                          onClick={() => {
                            llmConfigService.setActiveChannel(chan.id);
                            setIsChannelDropdownOpen(false);
                          }}
                          className={`p-2 rounded-lg cursor-pointer flex flex-col gap-0.5 transition-colors ${
                            activeChannel?.id === chan.id
                              ? "bg-[#fef3eb] border border-[#fed7aa]"
                              : "hover:bg-[#faf8f5]"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-[#1e1b18] text-[11px]">
                              {chan.name}
                            </span>
                            <span className="text-[9px] bg-[#f4efea] text-[#78716c] px-1.5 py-0.5 rounded font-mono uppercase">
                              {chan.type}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#78716c] font-mono truncate">{chan.baseUrl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. 二级：模型选择器 (Model) */}
              <div className="relative" ref={modelDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setIsModelDropdownOpen((prev) => !prev);
                    setIsChannelDropdownOpen(false);
                  }}
                  className="h-6.5 px-2 bg-[#f4efea] hover:bg-[#ebe4dc] text-[#1e1b18] rounded-md text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer border border-[#e5dfd8] transition-colors"
                >
                  <Cpu size={12} className="text-[#d96b27]" />
                  <span className="max-w-[125px] truncate">{activeModel}</span>
                  <ChevronDown size={10} className="text-[#78716c]" />
                </button>

                {/* 模型下拉菜单浮层 */}
                {isModelDropdownOpen && (
                  <div className="absolute bottom-8 left-0 w-64 bg-white border border-[#e5dfd8] rounded-xl shadow-xl p-1.5 z-50 flex flex-col gap-1 text-xs animate-in fade-in zoom-in-95">
                    <div className="px-2 py-1 text-[10px] font-bold text-[#78716c] uppercase tracking-wider border-b border-[#f4efea]">
                      {activeChannel?.name.split(" ")[0]} 可用模型
                    </div>
                    <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5">
                      {activeChannel?.models.map((m) => {
                        const meta = activeChannel.modelMetas?.find((item) => item.id === m);
                        const ctx = meta?.contextWindow
                          ? meta.contextWindow >= 1000000
                            ? "1M"
                            : `${meta.contextWindow / 1000}k`
                          : "128k";

                        return (
                          <div
                            key={m}
                            onClick={() => {
                              llmConfigService.setActiveModel(m);
                              setActiveModel(m);
                              setIsModelDropdownOpen(false);
                            }}
                            className={`px-2 py-1.5 rounded-lg cursor-pointer flex items-center justify-between text-[11px] font-mono transition-colors ${
                              activeModel === m
                                ? "bg-[#fef3eb] text-[#c2410c] font-semibold"
                                : "hover:bg-[#faf8f5] text-[#1e1b18]"
                            }`}
                          >
                            <span className="truncate">{m}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] bg-[#f4efea] text-[#78716c] px-1 rounded">
                                {ctx}
                              </span>
                              {activeModel === m && <Check size={12} className="text-[#ea580c] shrink-0" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. 上下文文件选择器 (点击弹出全功能文件选择模态弹窗) */}
              <button
                type="button"
                onClick={() => setIsFileModalOpen(true)}
                className={`h-6.5 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
                  attachedFiles.length > 0
                    ? "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]"
                    : "bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]"
                }`}
                title="打开工程文件选择弹窗"
              >
                <Paperclip size={11} />
                <span>@ 文件</span>
                {attachedFiles.length > 0 && (
                  <span className="w-3.5 h-3.5 rounded-full bg-[#2563eb] text-white text-[9px] flex items-center justify-center font-bold">
                    {attachedFiles.length}
                  </span>
                )}
              </button>

              {/* 4. 真实 Git 分支展示 (仅当探测到真实 Git 分支时展示) */}
              {detectedGitBranch && (
                <div
                  className="h-6.5 px-2 bg-[#f0f9ff] text-[#0284c7] border border-[#bae6fd] rounded-md text-[11px] font-medium flex items-center gap-1"
                  title={`当前项目 Git 分支: ${detectedGitBranch}`}
                >
                  <GitBranch size={11} className="text-[#0284c7]" />
                  <span className="max-w-[90px] truncate">{detectedGitBranch}</span>
                </div>
              )}

              {/* 5. 深度思考开关 */}
              <button
                type="button"
                onClick={() => setIsThinkingEnabled((prev) => !prev)}
                title="开启深度推理与逐步推导思考"
                className={`h-6.5 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
                  isThinkingEnabled
                    ? "bg-[#fffbeb] text-[#b45309] border-[#fde68a]"
                    : "bg-[#f8fafc] text-[#94a3b8] border-[#e2e8f0] opacity-70"
                }`}
              >
                <Brain size={11} className={isThinkingEnabled ? "text-[#d97706]" : "text-[#94a3b8]"} />
                <span>思考</span>
              </button>

              {/* 6. 联网检索开关 */}
              <button
                type="button"
                onClick={() => setIsWebSearchEnabled((prev) => !prev)}
                title="允许 AI 联网检索最新技术文档"
                className={`h-6.5 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
                  isWebSearchEnabled
                    ? "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]"
                    : "bg-[#f8fafc] text-[#94a3b8] border-[#e2e8f0] opacity-70"
                }`}
              >
                <Globe size={11} className={isWebSearchEnabled ? "text-[#16a34a]" : "text-[#94a3b8]"} />
                <span>联网</span>
              </button>

              {/* 7. 真实工程知识图谱查看器 (Graph-RAG) */}
              <button
                type="button"
                onClick={() => setIsKgModalOpen(true)}
                title="查看当前项目的真实工程知识图谱 (Graph-RAG)"
                className="h-6.5 px-2 bg-[#fdf4ff] text-[#a21caf] hover:bg-[#fae8ff] border border-[#f5d0fe] rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Network size={11} className="text-[#c026d3]" />
                <span>知识图谱</span>
              </button>
            </div>

            {/* 发送 / 停止生成按钮与快捷键切换器 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSendShortcut}
                className="text-[10px] text-[#78716c] hover:text-[#d96b27] cursor-pointer bg-[#f4efea] hover:bg-[#ebe5df] px-1.5 py-0.5 rounded border border-[#e5dfd8] transition-colors"
                title="点击切换发送快捷键 (Enter / Ctrl+Enter)"
              >
                {sendShortcut === "enter" ? "↵ Enter 发送" : "⌃↵ Ctrl+Enter"}
              </button>

              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleStopGenerating}
                  className="bg-[#ef4444] hover:bg-[#dc2626] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 animate-pulse"
                >
                  <Square size={11} />
                  <span>停止生成</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  className="bg-[#d96b27] hover:bg-[#b85417] text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
                >
                  <Send size={11} />
                  <span>发送</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 📁 文件选择模态弹窗 (File Selection Modal Dialog) */}
      {isFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white border border-[#e5dfd8] rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95">
            {/* 弹窗头部 */}
            <div className="px-5 py-3.5 border-b border-[#f4efea] flex justify-between items-center bg-[#faf8f5]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#eff6ff] text-[#2563eb] flex items-center justify-center">
                  <Paperclip size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1e1b18]">
                    选择工程上下文文件
                  </h3>
                  <p className="text-[11px] text-[#78716c]">
                    勾选工程文件或从本地磁盘添加，注入 AI 对话提示词
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFileModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-[#ebe5df] flex items-center justify-center text-[#78716c] hover:text-[#1e1b18] cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* 搜索与系统文件选择按钮 */}
            <div className="p-4 border-b border-[#f4efea] flex flex-col gap-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-[#9ca3af]" />
                <input
                  type="text"
                  autoFocus
                  value={fileModalSearch}
                  onChange={(e) => setFileModalSearch(e.target.value)}
                  placeholder="搜索工程文件或路径..."
                  className="w-full pl-8 pr-3 py-2 border border-[#e5dfd8] focus:border-[#d96b27] rounded-xl text-xs outline-none bg-[#faf8f5]"
                />
              </div>

              {/* 从 Windows 系统选择本地外部文件 */}
              <button
                type="button"
                onClick={handleOpenLocalWindowsFileDialog}
                className="w-full py-2 px-3 border border-dashed border-[#d96b27] bg-[#fef3eb] hover:bg-[#fed7aa]/50 rounded-xl text-xs font-semibold text-[#c2410c] flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <FolderPlus size={14} />
                <span>🪟 从 Windows 系统资源管理器选择本地文件 (Win32 Open File)</span>
              </button>

              <input
                type="file"
                ref={localFileInputRef}
                multiple
                onChange={handleLocalFileNativeInput}
                className="hidden"
              />
            </div>

            {/* 当前工程文件清单列表 */}
            <div className="flex-1 p-4 overflow-y-auto max-h-72 flex flex-col gap-1 scrollbar-thin">
              <div className="text-[11px] font-bold text-[#78716c] px-1 mb-1">
                当前项目文件清单 ({availableFiles.length})
              </div>

              {availableFiles
                .filter((f) =>
                  !fileModalSearch.trim() ||
                  f.toLowerCase().includes(fileModalSearch.toLowerCase())
                )
                .map((file) => {
                  const isChecked = attachedFiles.includes(file);
                  return (
                    <div
                      key={file}
                      onClick={() => toggleAttachFile(file)}
                      className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between border transition-colors ${
                        isChecked
                          ? "bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]"
                          : "bg-white border-[#f1f5f9] hover:bg-[#faf8f5] text-[#374151]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCode
                          size={14}
                          className={isChecked ? "text-[#16a34a]" : "text-[#9ca3af]"}
                        />
                        <span className="text-xs font-mono truncate">{file}</span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isChecked
                            ? "bg-[#16a34a] border-[#16a34a] text-white"
                            : "border-[#d1d5db]"
                        }`}
                      >
                        {isChecked && <Check size={11} />}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* 弹窗底部操作条 */}
            <div className="px-5 py-3 border-t border-[#f4efea] bg-[#faf8f5] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6b7280]">
                  已选 <b className="text-[#1e1b18]">{attachedFiles.length}</b> 个上下文文件
                </span>
                {attachedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAttachedFiles([])}
                    className="text-xs text-red-500 hover:underline cursor-pointer"
                  >
                    清空已选
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsFileModalOpen(false)}
                className="bg-[#d96b27] hover:bg-[#b85417] text-white px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-all"
              >
                确定挂载 ({attachedFiles.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🕸️ 真实工程知识图谱可视化模态弹窗 (Project Knowledge Graph Modal) */}
      <KnowledgeGraphModal
        isOpen={isKgModalOpen}
        onClose={() => setIsKgModalOpen(false)}
        projectName={currentProjectName}
      />
    </section>
  );
};
