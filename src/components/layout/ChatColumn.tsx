import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
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
  Folder,
  FolderPlus,
  Compass,
  Star,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Edit3,
  Trash2,
  ListOrdered,
  ShieldCheck,
  Gauge,
  ListChecks,
} from "lucide-react";
import { LLMChannel } from "../../types";
import { llmConfigService } from "../../services/llmConfigService";
import { contextCompressor, ChatMessage } from "../../services/contextCompressor";
import { llmGatewayEngine } from "../../services/llmGatewayEngine";
import { nativeService } from "../../services/nativeService";
import { projectMemoryService } from "../../services/projectMemoryService";
import { projectKnowledgeGraphService } from "../../services/projectKnowledgeGraphService";
import { webSearchService, WebSearchResult } from "../../services/webSearchService";
import { GitBranchModal } from "../git/GitBranchModal";

import { OptionsCard, parseAskOptionsBlock } from "../chat/OptionsCard";
import { FileChangeCard, parseToolCallBlock } from "../chat/FileChangeCard";
import { ToolCallCard } from "../chat/ToolCallCard";
import { parsePlanBlock } from "../chat/TaskPopup";
import { TaskPlanPanel } from "../chat/TaskPlanPanel";
import { AskOptionsPayload, FileChangeRecord, TaskPlan, ToolInvocation, WriteFileToolCall } from "../../types/contracts";
import { formatMessageTime, formatFullDateTime } from "../../utils/timeUtils";
import { isOpenCodeBaseUrl } from "../../services/opencodeService";
import { OpenCodeInstallModal } from "../opencode/OpenCodeInstallModal";

export interface SlashItem {
  id: string;
  name: string;
  category: "skill" | "mcp" | "command" | "context";
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

  // 4. Continue 风格 @ 上下文智能引用 (Context Mentions)
  {
    id: "ctx-file",
    name: "@file",
    category: "context",
    description: "选择工程代码文件作为当前对话的精准上下文",
    icon: "📄",
    command: "@file ",
  },
  {
    id: "ctx-git",
    name: "@git",
    category: "context",
    description: "自动提取当前工作区未提交的 Git Diff 变更作为上下文",
    icon: "🌿",
    command: "@git:diff ",
  },
  {
    id: "ctx-doc",
    name: "@doc",
    category: "context",
    description: "注入项目架构与规格设计文档作为规范约束",
    icon: "📐",
    command: "@doc ",
  },
  {
    id: "ctx-tree",
    name: "@tree",
    category: "context",
    description: "注入当前项目的文件目录树结构",
    icon: "🌳",
    command: "@tree ",
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
  rating?: 1 | 2 | 3 | 4 | 5;
  ratingToast?: string;
  webSearchCitations?: WebSearchResult[];
  timestamp?: number;        // 消息真实时间戳（问答发生时间）
  activityTags?: string[];   // 智能体活动标签（思考/命令/工具/文件变更）
}

export interface QueuedQuestion {
  id: string;
  text: string;
  images: { id: string; name: string; dataUrl: string; size: number }[];
  attachedFiles: string[];
  isThinkingEnabled: boolean;
  isWebSearchEnabled: boolean;
  createdAt: number;
}

interface ChatColumnProps {
  width?: number;
  activeSessionId?: string;
  sessionTitle?: string;
  projectName?: string;
  onOpenSettings?: () => void;
  fileChanges: FileChangeRecord[];
  setFileChanges: React.Dispatch<React.SetStateAction<FileChangeRecord[]>>;
  taskPlan: TaskPlan | null;
  setTaskPlan: React.Dispatch<React.SetStateAction<TaskPlan | null>>;
}

export const ChatColumn: React.FC<ChatColumnProps> = ({
  width,
  activeSessionId = "sess-1",
  sessionTitle,
  projectName = "agent-learning",
  onOpenSettings,
  fileChanges,
  setFileChanges,
  taskPlan,
  setTaskPlan,
}) => {
  const [input, setInput] = useState("");
  const [channels, setChannels] = useState<LLMChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<LLMChannel | undefined>(undefined);
  const [activeModel, setActiveModel] = useState<string>("qwen-plus-latest");

  const [isChannelDropdownOpen, setIsChannelDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [detectedGitBranch, setDetectedGitBranch] = useState<string | null>(null);

  // Roo Code 风格双模式：architect(架构设计) | code(高保真代码实现)
  const [workMode, setWorkMode] = useState<"architect" | "code">("code");

  // OpenCode 引擎安装进度弹窗状态
  const [isOpenCodeInstallModalOpen, setIsOpenCodeInstallModalOpen] = useState(false);

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
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [compressionNotice, setCompressionNotice] = useState<string | null>(null);

  // 智能体提问选项卡片 (Ask Options Protocol) 待确认状态
  const [pendingAsk, setPendingAsk] = useState<AskOptionsPayload | null>(null);

  // 智能体通用工具调用展示记录 (skill/mcp/read_file/execute_command 等，仅展示不执行)
  const [toolInvocations, setToolInvocations] = useState<ToolInvocation[]>([]);

  // Agent 模式：approve=文件修改需人工审批（默认）；auto=直接应用可撤回
  const [agentMode, setAgentMode] = useState<"approve" | "auto">("approve");
  // 推理强度：low / medium / high（影响模型思考深度）
  const [reasoningEffort, setReasoningEffort] = useState<"low" | "medium" | "high">("medium");

  // Plan 模式：开启后要求智能体先输出任务计划（[[PLAN]]）
  const [planMode, setPlanMode] = useState(false);


  // 问题排队流水线队列状态 (Queue Pipeline)
  const [questionQueue, setQuestionQueue] = useState<QueuedQuestion[]>([]);
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editingQueueText, setEditingQueueText] = useState("");

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

  // 处理输入变化与 / 和 @ 唤起
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastSlashIdx = textBeforeCursor.lastIndexOf("/");
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");
    const lastTriggerIdx = Math.max(lastSlashIdx, lastAtIdx);

    if (lastTriggerIdx !== -1) {
      const query = textBeforeCursor.slice(lastTriggerIdx + 1);
      if (!/\s/.test(query)) {
        setSlashQuery(query);
        setIsSlashMenuOpen(true);
        setSelectedSlashIdx(0);
        return;
      }
    }
    setIsSlashMenuOpen(false);
  };

  // 选中 Skill / MCP / Command / Context 项
  const handleSelectSlashItem = (item: SlashItem) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart || input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const textAfterCursor = input.slice(cursorPos);
    const lastSlashIdx = textBeforeCursor.lastIndexOf("/");
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");
    const lastTriggerIdx = Math.max(lastSlashIdx, lastAtIdx);

    if (lastTriggerIdx !== -1) {
      const prefix = textBeforeCursor.slice(0, lastTriggerIdx);
      if (item.id === "ctx-file") {
        setIsFileModalOpen(true);
        setIsSlashMenuOpen(false);
        return;
      }
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
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});

  const channelDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // 加载指定会话的消息历史 (短期高保真记忆持久化)
  const [messages, setMessages] = useState<StandardMessage[]>(() => {
    const saved = projectMemoryService.getSessionMessages(activeSessionId);
    if (saved && saved.length > 0) {
      return (saved as StandardMessage[]).map((m, idx) => ({
        ...m,
        timestamp: m.timestamp || (Date.now() - (saved.length - idx) * 30000),
      }));
    }
    return [
      {
        role: "assistant",
        channelName: "阿里百炼 (DashScope)",
        modelName: "qwen-plus-latest",
        content:
          "您好！我是 CodeMind 统一大模型编程助手。已为您接入 **New API / Cockpit 级生产级流式网关**。\n\n• 所有厂商输出采用统一标准结构回显（性能元数据、深度推理链、语法高亮与操作条）\n• 实时 **SSE 逐 Token 流式输出**，已融合 **工程知识图谱 (Graph-RAG)** 与 **双层长短期记忆机制**。",
        status: "completed",
        timestamp: Date.now(),
      },
    ];
  });

  // 当活跃会话 ID 切换时，平滑切换并加载对应会话的历史记录 (绝不丢失之前回答)
  useEffect(() => {
    const sid = activeSessionId || "sess-1";
    const saved = projectMemoryService.getSessionMessages(sid);
    if (saved && saved.length > 0) {
      setMessages(
        (saved as StandardMessage[]).map((m, idx) => ({
          ...m,
          timestamp: m.timestamp || (Date.now() - (saved.length - idx) * 30000),
        }))
      );
    } else {
      setMessages([
        {
          role: "assistant",
          channelName: activeChannel?.name || "阿里百炼 (DashScope)",
          modelName: activeModel,
          content: `已为您就绪新会话【${sessionTitle || sid}】。已挂载 **【${projectName}】** 真实工程知识图谱与长期情景记忆！`,
          status: "completed",
          timestamp: Date.now(),
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

  // 行内格式化解析器 (支持加粗、斜体、行内代码)
  const renderInlineFormatted = (text: string) => {
    if (!text) return null;
    const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith("**") && tok.endsWith("**") && tok.length >= 4) {
        return (
          <strong key={i} className="font-bold text-[#1e1b18]">
            {tok.slice(2, -2)}
          </strong>
        );
      }
      if (tok.startsWith("*") && tok.endsWith("*") && tok.length >= 2 && !tok.startsWith("**")) {
        return (
          <em key={i} className="italic text-[#4b5563]">
            {tok.slice(1, -1)}
          </em>
        );
      }
      if (tok.startsWith("`") && tok.endsWith("`") && tok.length >= 2) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-[#f4efea] text-[#c2410c] font-mono text-[11px] border border-[#e5dfd8] mx-0.5 inline-block"
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{tok}</span>;
    });
  };

  // 表格渲染器 (支持 Markdown 标准表格语法 | col1 | col2 | 与分隔符)
  const renderTableBlock = (tableLines: string[], keyPrefix: string | number) => {
    if (tableLines.length < 2) return null;
    const headerLine = tableLines[0];
    const dataLines = tableLines.slice(2);

    const parseRow = (line: string) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());

    const headers = parseRow(headerLine);

    return (
      <div key={keyPrefix} className="my-2.5 overflow-x-auto rounded-xl border border-[#e5dfd8] bg-white shadow-2xs">
        <table className="min-w-full text-xs divide-y divide-[#e5dfd8]">
          <thead className="bg-[#fbf9f6] text-[#4b5563] font-semibold select-none">
            <tr>
              {headers.map((h, hIdx) => (
                <th key={hIdx} className="px-3 py-2 text-left font-bold text-[#1e1b18] border-r border-[#e5dfd8] last:border-r-0">
                  {renderInlineFormatted(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4efea] text-[#374151]">
            {dataLines.map((rowStr, rIdx) => {
              const cells = parseRow(rowStr);
              return (
                <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white hover:bg-[#fef9f5]" : "bg-[#faf8f5]/60 hover:bg-[#fef9f5]"}>
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 border-r border-[#f4efea] last:border-r-0 leading-relaxed">
                      {renderInlineFormatted(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // 文本段落语法树解析器 (处理标题、列表、引用框、水平分割线、普通段落与表格)
  const renderTextParagraph = (text: string, partIdx: number) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let currentTable: string[] = [];

    const flushTable = () => {
      if (currentTable.length > 0) {
        elements.push(renderTableBlock(currentTable, `tbl-${partIdx}-${elements.length}`));
        currentTable = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 表格行识别
      if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|")) {
        currentTable.push(trimmed);
        continue;
      } else {
        flushTable();
      }

      if (!trimmed) {
        elements.push(<div key={`empty-${i}`} className="h-1.5" />);
        continue;
      }

      // 水平分割线
      if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
        elements.push(<hr key={`hr-${i}`} className="my-2 border-[#e5dfd8]" />);
        continue;
      }

      // 标题级别 1~4
      if (trimmed.startsWith("#### ")) {
        elements.push(
          <h4 key={`h4-${i}`} className="text-[11px] font-bold text-[#1e1b18] mt-2 mb-0.5 flex items-center gap-1">
            {renderInlineFormatted(trimmed.slice(5))}
          </h4>
        );
        continue;
      }
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3 key={`h3-${i}`} className="text-xs font-bold text-[#1e1b18] mt-2.5 mb-1 flex items-center gap-1.5 text-[#b45309]">
            {renderInlineFormatted(trimmed.slice(4))}
          </h3>
        );
        continue;
      }
      if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${i}`} className="text-sm font-bold text-[#1e1b18] mt-3 mb-1.5 flex items-center gap-1.5 border-b border-[#f4efea] pb-1">
            {renderInlineFormatted(trimmed.slice(3))}
          </h2>
        );
        continue;
      }
      if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${i}`} className="text-base font-bold text-[#1e1b18] mt-3 mb-1.5 flex items-center gap-1.5 border-b border-[#e5dfd8] pb-1">
            {renderInlineFormatted(trimmed.slice(2))}
          </h1>
        );
        continue;
      }

      // 重点提醒 / 引用框 (> 或 ⚠️ 或 💡 或 📌)
      if (trimmed.startsWith("> ") || trimmed.startsWith("⚠️") || trimmed.startsWith("💡") || trimmed.startsWith("📌") || trimmed.startsWith("❌")) {
        const content = trimmed.startsWith("> ") ? trimmed.slice(2) : trimmed;
        elements.push(
          <div key={`callout-${i}`} className="my-1.5 p-2.5 rounded-xl bg-[#fffbeb] border-l-3 border-[#f59e0b] text-[#92400e] text-[11px] leading-relaxed">
            {renderInlineFormatted(content)}
          </div>
        );
        continue;
      }

      // 无序列表 (- 或 *)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        elements.push(
          <div key={`bullet-${i}`} className="flex items-start gap-2 my-0.5 pl-1.5">
            <span className="text-[#d96b27] font-bold select-none text-[10px] mt-0.5">•</span>
            <div className="flex-1 leading-relaxed text-[#374151]">
              {renderInlineFormatted(trimmed.slice(2))}
            </div>
          </div>
        );
        continue;
      }

      // 有序列表 (1. , 2. )
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={`num-${i}`} className="flex items-start gap-1.5 my-0.5 pl-1.5">
            <span className="text-[#d96b27] font-semibold text-[10px] select-none min-w-4 mt-0.5">
              {numMatch[1]}.
            </span>
            <div className="flex-1 leading-relaxed text-[#374151]">
              {renderInlineFormatted(numMatch[2])}
            </div>
          </div>
        );
        continue;
      }

      // 常规正文段落
      elements.push(
        <div key={`p-${i}`} className="leading-relaxed text-[#1e1b18] my-0.5">
          {renderInlineFormatted(trimmed)}
        </div>
      );
    }

    flushTable();
    return <div key={partIdx} className="flex flex-col gap-0.5">{elements}</div>;
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
            className="my-2.5 rounded-xl overflow-hidden border border-[#e5dfd8] bg-[#18181b] text-white font-mono text-[11px] shadow-sm select-text"
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

      return renderTextParagraph(part, partIdx);
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

  const [currentProjectName, setCurrentProjectName] = useState(projectName);
  const [currentProjectPath, setCurrentProjectPath] = useState<string | undefined>(
    projectName === "geek-boot-parent" ? "d:/weihu/geek-boot-parent" : undefined
  );
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);

  // 动态深度扫描当前工程磁盘真实文件
  const scanDiskFiles = async (targetPath?: string, pName?: string) => {
    const projName = pName || currentProjectName;
    const resolved =
      targetPath ||
      currentProjectPath ||
      (projName === "geek-boot-parent" ? "d:/weihu/geek-boot-parent" : "d:/weihu/agent-learning");

    try {
      const tree = await nativeService.listDirectoryTree(resolved, 4);
      const flatten = (entries: any[], prefix = ""): string[] => {
        let res: string[] = [];
        for (const e of entries) {
          const rel = prefix ? `${prefix}/${e.name}` : e.name;
          if (e.is_dir) {
            res.push(`${rel}/`);
            if (e.children) res = res.concat(flatten(e.children, rel));
          } else {
            res.push(rel);
          }
        }
        return res;
      };
      const files = flatten(tree);
      if (files.length > 0) {
        setAvailableFiles(files);
      }
    } catch (err) {
      console.warn("Failed to scan disk directory tree:", err);
    }
  };

  useEffect(() => {
    scanDiskFiles();
  }, [currentProjectName, currentProjectPath]);

  useEffect(() => {
    const handleProjectSwitched = async (e: any) => {
      const { projectName: pName, files, fullPath } = e.detail || {};
      if (pName) {
        setCurrentProjectName(pName);
        const resolvedPath = fullPath || (pName === "geek-boot-parent" ? "d:/weihu/geek-boot-parent" : undefined);
        setCurrentProjectPath(resolvedPath);

        if (Array.isArray(files) && files.length > 0) {
          setAvailableFiles(files);
        } else {
          await scanDiskFiles(resolvedPath, pName);
        }
        // 切换项目时不默认关联文件，由用户自主点击添加
        setAttachedFiles([]);

        // 探测新项目所在路径的 Git 分支
        const realBranch = await nativeService.getGitBranch(resolvedPath);
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
  const executeQuestionPayload = async (payload: {
    promptText: string;
    imagesToAttach: { id: string; name: string; dataUrl: string; size: number }[];
    filesToAttach: string[];
    thinking: boolean;
    webSearch: boolean;
  }) => {
    const { promptText, imagesToAttach, filesToAttach, thinking, webSearch } = payload;
    const targetChan = activeChannel || channels[0];
    const targetModel = activeModel;

    // 1. 追加用户消息 (含图片附件提示)
    let displayPrompt = promptText;
    if (imagesToAttach.length > 0) {
      displayPrompt =
        `[🖼️ 已挂载 ${imagesToAttach.length} 张图片附件: ${imagesToAttach.map((img) => img.name).join(", ")}]\n\n` +
        promptText;
    }

    if (displayPrompt.includes("@git:diff") || displayPrompt.includes("@git")) {
      displayPrompt += `\n\n### 🌿 【当前工作区 Git 状态与分支上下文】\n当前分支: ${detectedGitBranch || "main"}\n工作区变更已自动注入上下文，请重点针对当前变更进行分析或重构。\n`;
    }
    if (displayPrompt.includes("@tree")) {
      displayPrompt += `\n\n### 🌳 【当前工程文件结构概览】\n${availableFiles.slice(0, 40).join("\n")}\n`;
    }

    const userMsg: StandardMessage = {
      role: "user",
      content: displayPrompt,
      timestamp: Date.now(),
    };

    // 2. 预先创建 AI 回复占位卡片 (统一标准结构)
    const assistantPlaceholder: StandardMessage = {
      role: "assistant",
      channelName: targetChan.name,
      modelName: targetModel,
      content: "",
      reasoningContent: "",
      status: "streaming",
      timestamp: Date.now(),
    };

    // 生产级互联网实时搜索抓取 (若用户开启了联网模式)
    let webSearchPromptContext = "";
    if (webSearch) {
      try {
        const citations = await webSearchService.search(userMsg.content);
        if (citations && citations.length > 0) {
          assistantPlaceholder.webSearchCitations = citations;
          webSearchPromptContext = "\n\n" + webSearchService.formatSearchResultsForContext(citations);
        }
      } catch (searchErr) {
        console.warn("[ChatColumn] Web search error:", searchErr);
      }
    }

    const currentHistory = [...messages, userMsg];
    setMessages([...currentHistory, assistantPlaceholder]);
    setIsGenerating(true);
    // 派发运行中状态 (绿色旋转圆标)
    window.dispatchEvent(
      new CustomEvent("session-status-changed", {
        detail: { sessionId: activeSessionId, status: "running" },
      })
    );

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

    // 3. 检索动态严谨度约束 (根据用户此前对同类话题的 1~5 星打分自适应对齐)
    const strictnessConstraint = projectMemoryService.getDynamicStrictnessConstraint(
      currentProjectName,
      userMsg.content
    );

    // 4. 构建 ReAct 智能体系统上下文 (融合知识图谱、双层记忆、严谨度认知与实时联网搜索)
    const reactSystemPrompt = `You are CodeMind AI, an expert ReAct (Reasoning + Acting) software engineering assistant.
Current Workspace Project: "${currentProjectName}"
Git Branch: ${detectedGitBranch || "None (Not a git repository)"}
Project Files: ${availableFiles.slice(0, 15).join(", ")}
${filesToAttach.length > 0 ? `Attached Context Files: ${filesToAttach.join(", ")}` : "No explicit files attached."}

${graphContext}
${memoryContext}
${strictnessConstraint.constraintPrompt}
${webSearchPromptContext}
${
  workMode === "architect"
    ? `\n### 📐 【工作模式：架构设计与规划模式 (Architect Mode)】\n你当前处于架构规划模式。请严格遵循规范驱动开发 (SDD) 原则。专注于深入分析系统架构、依赖影响、契约定义与方案权衡，严禁在未获得用户确认前直接编写长篇细碎代码或发起文件修改。必须先产出清晰的高质量架构方案文档与风险预案。\n`
    : `\n### 💻 【工作模式：编码与实现模式 (Code Mode)】\n你当前处于编码实现模式。请专注于高质量、高精度且经过深度严谨自检的代码实现。遵循 SOLID 原则与极简主义，直接输出完整、可编译且能解决问题的规范代码或文件变更。\n`
}

Instructions:
1. Always ground your technical answers in the current project codebase, knowledge graph topology, real-time web search facts, and architectural memories.
2. Follow the ReAct paradigm: Analyze intent -> Plan -> Produce clean, production-grade solutions.
3. Respond in concise, professional Simplified Chinese (简体中文).
4. Clarification Protocol (Ask Options): When the user's request is ambiguous and multiple reasonable paths exist, ask the user to choose. At the VERY END of your reply output the marker line followed by a JSON object (do NOT wrap it in a code fence, do NOT add any text after the JSON):
[[ASK_OPTIONS]]
{"type":"ask_options","question":"<your question>","options":[{"id":"a","label":"<option A>"},{"id":"b","label":"<option B>"}],"single_select":true}
- single_select=true means single choice, false means multi-select; provide 2~5 options, keep each label short (<=20 chars), add description when helpful.
- The marker JSON is not shown to the user: the frontend renders it as clickable option cards, and after the user picks, you will receive their answer and continue.
5. Tool Invocation Protocol: When you call a tool (write file, skill, mcp, read file, execute command), at the VERY END of your reply output the marker line followed by a JSON object (do NOT wrap it in a code fence, do NOT add any text after the JSON):
[[TOOL_CALL]]
{"type":"tool_call","tool":"<write_file|skill|mcp|read_file|execute_command>","name":"<tool/skill name for skill/mcp>","path":"<file path if any>","args":{...},"content":"<COMPLETE new file content for write_file>","description":"<short summary>"}
- For write_file, content must be the ENTIRE new file content (not a diff or patch); the frontend shows the change diff and asks the user to approve BEFORE writing.
- For skill/mcp/read_file/execute_command, the frontend shows the invocation in a collapsed card for visibility; only write_file is actually executed.
- Output at most one marker per reply, and never combine it with the Ask Options block.
${planMode ? `6. Plan Mode Protocol (Enabled): You MUST first output a structured task plan before doing any work. At the VERY END of your first reply output the marker line followed by a JSON object (do NOT wrap it in a code fence, do NOT add any text after the JSON):
[[PLAN]]
{"type":"plan","title":"<plan title>","tasks":[{"id":"1","summary":"<task summary>","status":"pending","difficulty":"<low|medium|high>"}]}
- Provide 2~6 tasks covering the whole work; the frontend shows them in a task list popup.
- Output the plan block only in your first reply; afterwards execute the tasks step by step.
- Never combine the plan block with other markers in the same reply.` : ""}`;

    const requestMessages = [
      { role: "system", content: reactSystemPrompt },
      ...currentHistory.map((m) => ({ role: m.role, content: m.content })),
    ];

    // 5. 调度网关流式引擎 (assistantContent 累计本次流式正文，供 Ask Options 标记解析)
    let assistantContent = "";
    await llmGatewayEngine.dispatchStream({
      channel: targetChan,
      model: targetModel,
      messages: requestMessages,
      enableThinking: thinking,
      reasoningEffort,
      abortSignal: controller.signal,
      callbacks: {
        onToken: (contentChunk, reasoningChunk) => {
          if (contentChunk) assistantContent += contentChunk;
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
          window.dispatchEvent(
            new CustomEvent("session-status-changed", {
              detail: { sessionId: activeSessionId, status: "idle" },
            })
          );

          // 解析流式正文末尾的 Ask Options / 工具调用 / 计划任务标记（互斥，至多命中一个）
          const parsedAsk = parseAskOptionsBlock(assistantContent);
          const parsedTool = parsedAsk ? null : parseToolCallBlock(assistantContent);
          const parsedPlan = parsedAsk || parsedTool ? null : parsePlanBlock(assistantContent);

          // 智能体活动标签：文件变更 / 命令 / 工具（渲染在消息头部 tag 行）
          let activityTag: string | undefined;
          if (parsedTool) {
            if (parsedTool.toolCall.tool === "write_file") {
              activityTag = "📄 文件变更";
            } else if (parsedTool.toolCall.tool === "execute_command") {
              activityTag = `⌨️ 命令${parsedTool.toolCall.name ? `: ${parsedTool.toolCall.name}` : ""}`;
            } else {
              activityTag = `🛠️ 工具${parsedTool.toolCall.name ? `: ${parsedTool.toolCall.name}` : ""}`;
            }
          }

          setMessages((prev) => {
            const updated = [...prev];
            const target = updated[updated.length - 1];
            if (target && target.role === "assistant") {
              target.status = "completed";
              target.durationMs = meta.durationMs;
              target.tokensCount = meta.tokensCount;
              target.tokensPerSec = meta.tokensPerSec;
              if (activityTag) {
                target.activityTags = [...(target.activityTags || []), activityTag];
              }
              const cleanContent =
                parsedAsk?.cleanContent ?? parsedTool?.cleanContent ?? parsedPlan?.cleanContent;
              if (cleanContent !== undefined) {
                target.content = cleanContent;
              }

              // 自动提取长期情景记忆沉淀到项目存储库
              projectMemoryService.autoExtractMemoriesFromTurn(
                currentProjectName,
                userMsg.content,
                target.content
              );
            }
            return updated;
          });

          if (parsedAsk) {
            setPendingAsk(parsedAsk.payload);
          }
          if (parsedTool) {
            if (
              parsedTool.toolCall.tool === "write_file" &&
              parsedTool.toolCall.path &&
              parsedTool.toolCall.content !== undefined
            ) {
              void handleToolCall(
                {
                  type: "tool_call",
                  tool: "write_file",
                  path: parsedTool.toolCall.path,
                  content: parsedTool.toolCall.content,
                  ...(parsedTool.toolCall.description
                    ? { description: parsedTool.toolCall.description }
                    : {}),
                } as WriteFileToolCall,
                agentMode
              );
            } else {
              // 其他工具调用（skill/mcp/read_file/execute_command 等）仅展示，不执行
              const invocation: ToolInvocation = {
                id: `ti-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                toolCall: parsedTool.toolCall,
                status: "COMPLETED",
                timestamp: Date.now(),
              };
              setToolInvocations((prev) => [...prev, invocation]);
            }
          }
          if (parsedPlan) {
            setTaskPlan({
              id: `plan-${Date.now()}`,
              title: parsedPlan.plan.title,
              tasks: parsedPlan.plan.tasks,
              createdAt: Date.now(),
            });
          }
        },
        onError: (errMsg, statusCode) => {
          setIsGenerating(false);
          // 派发失败状态 (红色圆标)
          window.dispatchEvent(
            new CustomEvent("session-status-changed", {
              detail: { sessionId: activeSessionId, status: "error" },
            })
          );
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

  // 用户点击发送 / 回车发送统一入口 (支持生成中队列模式)
  const handleSend = async () => {
    if (!input.trim()) return;

    if (isGenerating) {
      // 正在生成中：将新问题推入待发送流水线队列 (Pipeline Queue)
      const queuedItem: QueuedQuestion = {
        id: `queue-${Date.now()}-${Math.random()}`,
        text: input.trim(),
        images: [...pastedImages],
        attachedFiles: [...attachedFiles],
        isThinkingEnabled,
        isWebSearchEnabled,
        createdAt: Date.now(),
      };
      setQuestionQueue((prev) => [...prev, queuedItem]);
      setInput("");
      setPastedImages([]);
      return;
    }

    const userPrompt = input.trim();
    const imagesToAttach = [...pastedImages];
    const filesToAttach = [...attachedFiles];
    const thinking = isThinkingEnabled && reasoningEffort !== "low";
    const webSearch = isWebSearchEnabled;

    setInput("");
    setPastedImages([]);

    await executeQuestionPayload({
      promptText: userPrompt,
      imagesToAttach,
      filesToAttach,
      thinking,
      webSearch,
    });
  };

  // 队列调度监听器：当前任务完成且队列中有待办问题时，自动弹出队首执行
  useEffect(() => {
    if (!isGenerating && questionQueue.length > 0) {
      const nextQ = questionQueue[0];
      setQuestionQueue((prev) => prev.slice(1));
      executeQuestionPayload({
        promptText: nextQ.text,
        imagesToAttach: nextQ.images,
        filesToAttach: nextQ.attachedFiles,
        thinking: nextQ.isThinkingEnabled,
        webSearch: nextQ.isWebSearchEnabled,
      });
    }
  }, [isGenerating, questionQueue]);

  // 队列项操作：修改
  const handleStartEditQueue = (id: string, currentText: string) => {
    setEditingQueueId(id);
    setEditingQueueText(currentText);
  };

  const handleSaveQueueEdit = (id: string) => {
    if (!editingQueueText.trim()) return;
    setQuestionQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, text: editingQueueText.trim() } : q))
    );
    setEditingQueueId(null);
  };

  // 队列项操作：删除
  const handleDeleteQueueItem = (id: string) => {
    setQuestionQueue((prev) => prev.filter((q) => q.id !== id));
  };

  // 队列项操作：上移
  const handleMoveQueueUp = (index: number) => {
    if (index <= 0) return;
    setQuestionQueue((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // 队列项操作：下移
  const handleMoveQueueDown = (index: number) => {
    setQuestionQueue((prev) => {
      if (index >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // 队列项操作：插队优先
  const handleMoveQueueToFront = (index: number) => {
    if (index === 0) return;
    setQuestionQueue((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      return [item, ...copy];
    });
  };

  // 停止生成
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    window.dispatchEvent(
      new CustomEvent("session-status-changed", {
        detail: { sessionId: activeSessionId, status: "idle" },
      })
    );
    setMessages((prev) => {
      const updated = [...prev];
      const target = updated[updated.length - 1];
      if (target && target.role === "assistant" && target.status === "streaming") {
        target.status = "aborted";
      }
      return updated;
    });
  };

  // 智能体提问选项卡片：用户确认选择后，把答案作为用户消息自动续问
  const handleAskOptionsSubmit = async (
    _selectedIds: string[],
    selectedLabels: string[]
  ) => {
    if (!pendingAsk) return;
    const payload = pendingAsk;
    setPendingAsk(null);
    const answerText = selectedLabels.length > 0 ? selectedLabels.join("、") : "";
    const answerPrompt = `【回答智能体的提问】\n问题：${payload.question}\n我的选择：${answerText}`;
    await executeQuestionPayload({
      promptText: answerPrompt,
      imagesToAttach: [],
      filesToAttach: attachedFiles,
      thinking: isThinkingEnabled,
      webSearch: isWebSearchEnabled,
    });
  };

  // 智能体提问选项卡片：跳过本次提问，不自动续问
  const handleAskOptionsSkip = () => {
    setPendingAsk(null);
  };

  // 将模型给出的相对路径解析为项目内绝对路径
  const resolveProjectPath = (p: string): string => {
    const root =
      currentProjectPath ||
      (currentProjectName === "geek-boot-parent"
        ? "d:/weihu/geek-boot-parent"
        : "d:/weihu/agent-learning");
    const cleaned = p.trim().replace(/^\.\//, "");
    if (/^[a-zA-Z]:[\\/]/.test(cleaned) || cleaned.startsWith("/") || cleaned.startsWith("\\")) {
      return cleaned.replace(/\\/g, "/");
    }
    return `${root.replace(/\\/g, "/")}/${cleaned}`;
  };

  // 智能体文件修改工具：解析 TOOL_CALL，读取原文件快照并生成待审批记录
  const handleToolCall = async (toolCall: WriteFileToolCall, mode: "approve" | "auto") => {
    const absolutePath = resolveProjectPath(toolCall.path);
    let originalContent = "";
    try {
      originalContent = await nativeService.readFile(absolutePath);
    } catch {
      // 文件不存在视为新文件创建，originalContent 保持空串
    }
    const record: FileChangeRecord = {
      id: `fc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      toolCall,
      absolutePath,
      originalContent,
      newContent: toolCall.content,
      status: mode === "auto" ? "APPLIED" : "PENDING_APPROVAL",
      timestamp: Date.now(),
    };
    setFileChanges((prev) => [...prev, record]);

    // 自动模式：不审批直接写入并打开右栏阅览（失败时置 FAILED 可见，不吞异常）
    if (mode === "auto") {
      try {
        const ok = await nativeService.writeFile(absolutePath, toolCall.content);
        if (!ok) throw new Error("文件写入返回失败");
        setFileChanges((prev) =>
          prev.map((r) =>
            r.id === record.id ? { ...r, status: "APPLIED", appliedAt: Date.now() } : r
          )
        );
        window.dispatchEvent(
          new CustomEvent("open-workspace-file", {
            detail: {
              path: absolutePath,
              name: toolCall.path.split("/").pop(),
              content: toolCall.content,
            },
          })
        );
      } catch (err: any) {
        setFileChanges((prev) =>
          prev.map((r) =>
            r.id === record.id
              ? { ...r, status: "FAILED", errorMessage: err?.message || String(err) }
              : r
          )
        );
      }
    }
  };

  // 审批通过：真实写入文件，成功后打开右栏阅览并保留撤回能力
  const handleApplyChange = async (id: string) => {
    const record = fileChanges.find((r) => r.id === id);
    if (!record) return;
    try {
      const ok = await nativeService.writeFile(record.absolutePath, record.newContent);
      if (!ok) throw new Error("文件写入返回失败");
      setFileChanges((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "APPLIED", appliedAt: Date.now() } : r))
      );
      window.dispatchEvent(
        new CustomEvent("open-workspace-file", {
          detail: {
            path: record.absolutePath,
            name: record.toolCall.path.split("/").pop(),
            content: record.newContent,
          },
        })
      );
    } catch (err: any) {
      setFileChanges((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "FAILED", errorMessage: err?.message || String(err) }
            : r
        )
      );
    }
  };

  // 放弃：不写入，移除待审批记录
  const handleDiscardChange = (id: string) => {
    setFileChanges((prev) => prev.filter((r) => r.id !== id));
  };

  // 右栏阅览文件：已应用显示新内容，待审批/已撤回显示原内容
  const handleViewFile = (record: FileChangeRecord) => {
    const content = record.status === "APPLIED" ? record.newContent : record.originalContent;
    window.dispatchEvent(
      new CustomEvent("open-workspace-file", {
        detail: {
          path: record.absolutePath,
          name: record.toolCall.path.split("/").pop(),
          content,
        },
      })
    );
  };

  // 处理对 AI 输出内容的 1~5 星打分并进行严谨度认知对齐
  const handleRateMessage = (idx: number, starVal: 1 | 2 | 3 | 4 | 5) => {
    const target = messages[idx];
    if (!target || target.role !== "assistant") return;

    let userQuery = "AI 编程协同任务";
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userQuery = messages[i].content;
        break;
      }
    }

    const res = projectMemoryService.recordRatingFeedback(
      currentProjectName,
      userQuery,
      target.content,
      starVal
    );

    setMessages((prev) => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = {
          ...updated[idx],
          rating: starVal,
          ratingToast: res.message,
        };
      }
      return updated;
    });

    setTimeout(() => {
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], ratingToast: undefined };
        }
        return updated;
      });
    }, 4500);
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
      {/* 顶部面包屑与状态指示栏 (完全对齐截图) */}
      <div className="px-4 py-2 border-b border-[#e5dfd8] flex justify-between items-center text-xs bg-[#faf8f5] shrink-0">
        <div className="flex items-center gap-1.5 text-[#645e57] text-[11px]">
          <span className="font-semibold text-[#1e1b18]">{currentProjectName}</span>
          <span className="text-[#9ca3af]">&gt;</span>
          <span className="text-[#645e57] truncate max-w-[360px] font-medium">{sessionTitle || "会话详情"}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white border border-[#e5dfd8] px-2.5 py-0.5 rounded-full text-[10px] text-[#645e57] flex items-center gap-1.5 shadow-2xs font-mono">
            <span>CodeMind-Studio-Setup.exe</span>
            <span className="text-[#059669] font-bold">✔</span>
            <span className="text-[#9ca3af] font-mono">就绪</span>
          </div>
        </div>
      </div>

      {/* 消息滚动区 */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 text-xs leading-relaxed select-text">
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          const isThinkingOpen = !!expandedThinking[idx];

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
                  <span
                    className="text-[10px] text-[#9c948a] font-mono font-normal tracking-tight"
                    title={formatFullDateTime(m.timestamp)}
                  >
                    {formatMessageTime(m.timestamp)}
                  </span>
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
                  {m.timestamp ? (
                    <span className="text-[#a8a29e] font-mono" title={formatFullDateTime(m.timestamp)}>
                      {formatMessageTime(m.timestamp)}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Layer 1.5: 智能体活动标签（思考 / 命令 / 工具 / 文件变更） */}
              {(m.reasoningContent || (m.activityTags && m.activityTags.length > 0)) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {m.reasoningContent && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
                      <Brain size={10} /> 思考
                    </span>
                  )}
                  {(m.activityTags || []).map((tag, ti) => (
                    <span
                      key={ti}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Layer 2: 深度推理思考过程卡片 (Deep Thinking Process) */}
              {m.reasoningContent && (
                <div className="bg-[#fffbeb] border border-[#fde68a] rounded-lg p-2.5 flex flex-col gap-1.5 text-xs">
                  <div
                    onClick={() =>
                      setExpandedThinking((prev) => ({ ...prev, [idx]: !prev[idx] }))
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

              {/* Layer 2.5: 实时互联网搜索检索引用卡片 (Web Search Citations) */}
              {m.webSearchCitations && m.webSearchCitations.length > 0 && (
                <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg p-2.5 flex flex-col gap-1.5 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between text-[#166534] font-semibold text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Globe size={12} className="text-[#16a34a]" />
                      <span>🌐 实时互联网搜索检索已融合 ({m.webSearchCitations.length} 篇权威参考源)</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 pl-2 border-l-2 border-[#86efac] text-[11px] text-[#14532d]">
                    {m.webSearchCitations.map((c, cIdx) => (
                      <a
                        key={cIdx}
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline flex items-center justify-between group/link py-0.5"
                        title={c.snippet}
                      >
                        <span className="truncate flex-1 font-medium">[{cIdx + 1}] {c.title}</span>
                        <ExternalLink size={10} className="shrink-0 ml-1 opacity-70 group-hover/link:opacity-100 text-[#16a34a]" />
                      </a>
                    ))}
                  </div>
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
                  <div className="flex items-center gap-2 pt-1 border-t border-[#fee2e2] flex-wrap">
                    {(m.errorDetail?.includes("OpenCode") || m.errorDetail?.includes("4096")) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsOpenCodeInstallModalOpen(true)}
                          className="px-3 py-1 bg-[#059669] hover:bg-[#047857] text-white rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Bot size={11} /> 🚀 安装 / 启动 OpenCode
                        </button>
                        <button
                          type="button"
                          onClick={onOpenSettings}
                          className="px-3 py-1 bg-white hover:bg-[#f1f5f9] text-[#1e293b] border border-[#cbd5e1] rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Settings size={11} /> 前往网关设置
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="px-3 py-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Settings size={11} /> 前往配置渠道凭据
                      </button>
                    )}
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

              {/* Layer 4: 统一标准化快捷操作栏与 5 星严谨度打分 */}
              {m.content && m.status !== "streaming" && (
                <div className="pt-2 border-t border-[#f4efea] flex justify-between items-center text-[10px] text-[#78716c] flex-wrap gap-2">
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
                    <button
                      onClick={handleSend}
                      className="hover:text-[#1e1b18] flex items-center gap-1 cursor-pointer ml-1"
                      title="重新生成本次回答"
                    >
                      <RotateCcw size={10} />
                      <span>重新生成</span>
                    </button>
                  </div>

                  {/* 5 星严谨度评价与认知对齐组件 */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[10px] text-[#78716c] select-none">严谨度评价:</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRateMessage(idx, star as any)}
                          title={
                            star <= 2
                              ? `${star}星: 质量欠佳/存在缺陷 (下次关联话题将触发最高严谨度自检与防守)`
                              : star === 3
                              ? "3星: 基本可用"
                              : `${star}星: 高品质交付 (沉淀为黄金范本规范)`
                          }
                          className="p-0.5 hover:scale-125 transition-transform cursor-pointer"
                        >
                          <Star
                            size={12}
                            className={
                              m.rating && m.rating >= star
                                ? "fill-[#f59e0b] text-[#f59e0b]"
                                : "text-[#d1d5db] hover:text-[#f59e0b]"
                            }
                          />
                        </button>
                      ))}
                    </div>
                    {m.ratingToast && (
                      <span className="text-[10px] text-[#d96b27] font-semibold animate-in fade-in ml-1 max-w-[220px] truncate" title={m.ratingToast}>
                        {m.ratingToast}
                      </span>
                    )}
                  </div>
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

        {/* ⏳ 待执行问题流水线队列面板 (Question Queue Pipeline Panel) */}
        {questionQueue.length > 0 && (
          <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl p-2.5 flex flex-col gap-2 shadow-xs animate-in fade-in slide-in-from-bottom-2 text-xs">
            <div className="flex justify-between items-center text-[#b45309] font-semibold border-b border-[#fef3c7] pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="font-bold flex items-center gap-1">
                  <ListOrdered size={12} className="text-[#d97706]" /> 待执行问题队列 ({questionQueue.length})
                </span>
                <span className="text-[10px] text-[#d97706] font-normal hidden sm:inline">
                  · 当前回答完成后将按序自动执行
                </span>
              </div>
              <button
                type="button"
                onClick={() => setQuestionQueue([])}
                className="text-[10px] text-[#d97706] hover:text-[#b45309] hover:underline cursor-pointer"
              >
                清空队列
              </button>
            </div>

            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
              {questionQueue.map((item, idx) => {
                const isEditing = editingQueueId === item.id;

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#fef08a] rounded-lg p-2 flex items-center justify-between gap-2 shadow-2xs group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="bg-[#fef3eb] text-[#d96b27] font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0">
                        #{idx + 1}
                      </span>

                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            autoFocus
                            value={editingQueueText}
                            onChange={(e) => setEditingQueueText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveQueueEdit(item.id);
                              else if (e.key === "Escape") setEditingQueueId(null);
                            }}
                            className="flex-1 px-2 py-1 border border-[#d96b27] rounded text-xs outline-none font-medium bg-[#faf8f5]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveQueueEdit(item.id)}
                            className="px-2 py-1 bg-[#d96b27] text-white rounded text-[10px] font-semibold cursor-pointer"
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingQueueId(null)}
                            className="px-1.5 py-1 text-[#64748b] hover:bg-[#f1f5f9] rounded text-[10px] cursor-pointer"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#1e1b18] truncate text-xs font-medium">
                          {item.text}
                        </span>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        {/* 上移 */}
                        <button
                          type="button"
                          onClick={() => handleMoveQueueUp(idx)}
                          disabled={idx === 0}
                          className="w-5 h-5 rounded hover:bg-[#fef3eb] disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center text-[#78716c] hover:text-[#d96b27] cursor-pointer disabled:cursor-default"
                          title="向上移动"
                        >
                          <ArrowUp size={11} />
                        </button>

                        {/* 下移 */}
                        <button
                          type="button"
                          onClick={() => handleMoveQueueDown(idx)}
                          disabled={idx === questionQueue.length - 1}
                          className="w-5 h-5 rounded hover:bg-[#fef3eb] disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center text-[#78716c] hover:text-[#d96b27] cursor-pointer disabled:cursor-default"
                          title="向下移动"
                        >
                          <ArrowDown size={11} />
                        </button>

                        {/* 插队优先 */}
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveQueueToFront(idx)}
                            className="px-1.5 py-0.5 rounded bg-[#fef3eb] hover:bg-[#fed7aa] text-[#c2410c] text-[10px] font-semibold cursor-pointer"
                            title="插队至最前优先执行"
                          >
                            ⚡ 插队
                          </button>
                        )}

                        {/* 编辑 */}
                        <button
                          type="button"
                          onClick={() => handleStartEditQueue(item.id, item.text)}
                          className="w-5 h-5 rounded hover:bg-[#eff6ff] flex items-center justify-center text-[#2563eb] cursor-pointer"
                          title="编辑该问题"
                        >
                          <Edit3 size={11} />
                        </button>

                        {/* 删除 */}
                        <button
                          type="button"
                          onClick={() => handleDeleteQueueItem(item.id)}
                          className="w-5 h-5 rounded hover:bg-[#fee2e2] flex items-center justify-center text-[#ef4444] cursor-pointer"
                          title="从队列中移除"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
                  <Compass size={12} /> 快捷技能 (Skills)、MCP & @ 上下文智能引用
                </span>
                <span className="font-normal lowercase">
                  ↑↓ 切换 · Enter / Tab 插入 · Esc 关闭
                </span>
              </div>

              {filteredSlashItems.length === 0 ? (
                <div className="p-3 text-center text-[#9ca3af] text-xs">
                  未找到匹配的 Skill、MCP 或 @ 上下文
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
                                  : item.category === "context"
                                  ? "bg-[#ccfbf1] text-[#0f766e]"
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

          {/* 智能体文件修改工具卡片 (File Modification Tool Protocol)：渲染在输入框上方 */}
          {fileChanges.length > 0 && (
            <div className="flex flex-col gap-2">
              {fileChanges.map((fc) => (
                <FileChangeCard
                  key={fc.id}
                  record={fc}
                  onApply={handleApplyChange}
                  onDiscard={handleDiscardChange}
                  onViewFile={handleViewFile}
                />
              ))}
            </div>
          )}

          {/* 智能体通用工具调用卡片 (skill/mcp 等)：默认折叠展示 */}
          {toolInvocations.length > 0 && (
            <div className="flex flex-col gap-2">
              {toolInvocations.map((ti) => (
                <ToolCallCard key={ti.id} invocation={ti} />
              ))}
            </div>
          )}

          {/* 计划任务面板 (Plan Mode)：对话栏内可展开/折叠 */}
          {taskPlan && <TaskPlanPanel plan={taskPlan} />}

          {/* 智能体提问选项卡片 (Ask Options Protocol)：渲染在输入框上方 */}
          {pendingAsk && (
            <OptionsCard
              payload={pendingAsk}
              onSubmit={handleAskOptionsSubmit}
              onSkip={handleAskOptionsSkip}
            />
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

              {/* 2.5 Roo Code 风格：架构模式 (Architect) / 编码模式 (Code) 双模式热切胶囊 */}
              <div className="flex items-center bg-[#f4efea] p-0.5 rounded-lg border border-[#e5dfd8]">
                <button
                  type="button"
                  onClick={() => setWorkMode("code")}
                  className={`h-5.5 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    workMode === "code"
                      ? "bg-white text-[#d96b27] shadow-2xs border border-[#fed7aa]"
                      : "text-[#78716c] hover:text-[#1e1b18]"
                  }`}
                  title="编码模式：高保真代码实现，直接输出完整可运行的工程 Diff"
                >
                  <span>💻 编码</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkMode("architect")}
                  className={`h-5.5 px-2 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    workMode === "architect"
                      ? "bg-white text-[#0284c7] shadow-2xs border border-[#bae6fd]"
                      : "text-[#78716c] hover:text-[#1e1b18]"
                  }`}
                  title="架构模式：专注系统分析、方案权衡与规范设计，严禁盲目直接输出零碎代码"
                >
                  <span>📐 架构</span>
                </button>
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

              {/* 4. 真实 Git 分支交互中枢 (IntelliJ IDEA 风格浮层菜单) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsGitModalOpen((prev) => !prev)}
                  className={`h-6.5 px-2 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs border ${
                    isGitModalOpen
                      ? "bg-[#e0f2fe] text-[#0369a1] border-[#7dd3fc]"
                      : "bg-[#f0f9ff] hover:bg-[#e0f2fe] text-[#0284c7] border-[#bae6fd] hover:border-[#7dd3fc]"
                  }`}
                  title="点击打开 Git 分支操作浮层 (切换分支/新建分支/Pull/Push/Status)"
                >
                  <GitBranch size={11} className="text-[#0284c7]" />
                  <span className="max-w-[90px] truncate">{detectedGitBranch || "main"}</span>
                </button>

                {/* ⑂ IntelliJ IDEA 风格 Git 分支管理与快捷操作浮层 */}
                <GitBranchModal
                  isOpen={isGitModalOpen}
                  onClose={() => setIsGitModalOpen(false)}
                  projectName={currentProjectName}
                  projectPath={currentProjectPath}
                  onBranchSwitched={(newB) => setDetectedGitBranch(newB)}
                />
              </div>

              {/* 4.6 OpenCode 引擎与安装快捷按钮 */}
              {(activeChannel?.id === "chan-opencode" || activeChannel?.type === "opencode" || (activeChannel?.baseUrl && isOpenCodeBaseUrl(activeChannel.baseUrl))) && (
                <button
                  type="button"
                  onClick={() => setIsOpenCodeInstallModalOpen(true)}
                  className="h-6.5 px-2 bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#059669] rounded-md text-[11px] font-semibold flex items-center gap-1 border border-[#a7f3d0] cursor-pointer transition-colors shadow-2xs"
                  title="查看 OpenCode 本地 4096 端口状态或打开安装向导"
                >
                  <Bot size={11} className="text-[#10b981]" />
                  <span>OpenCode 引擎</span>
                </button>
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

              {/* Agent 模式切换：审批（默认）/ 自动 */}
              <button
                type="button"
                onClick={() => setAgentMode((prev) => (prev === "approve" ? "auto" : "approve"))}
                title={
                  agentMode === "approve"
                    ? "审批模式：文件修改需人工确认后写入"
                    : "自动模式：文件修改直接应用（可在右侧撤回）"
                }
                className={`h-6.5 px-2 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer border transition-colors ${
                  agentMode === "approve"
                    ? "bg-[#fef3eb] text-[#c2410c] border-[#fed7aa]"
                    : "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]"
                }`}
              >
                {agentMode === "approve" ? (
                  <ShieldCheck size={11} className="text-[#ea580c]" />
                ) : (
                  <Zap size={11} className="text-[#16a34a]" />
                )}
                <span>{agentMode === "approve" ? "审批" : "自动"}</span>
              </button>

              {/* 推理强度切换：低 / 中 / 高 */}
              <button
                type="button"
                onClick={() =>
                  setReasoningEffort((prev) =>
                    prev === "low" ? "medium" : prev === "medium" ? "high" : "low"
                  )
                }
                title="推理强度：低/中/高（高会向兼容模型透传 reasoning_effort=high）"
                className={`h-6.5 px-2 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
                  reasoningEffort === "high"
                    ? "bg-[#fdf4ff] text-[#a21caf] border-[#f5d0fe]"
                    : reasoningEffort === "medium"
                    ? "bg-[#fffbeb] text-[#b45309] border-[#fde68a]"
                    : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]"
                }`}
              >
                <Gauge size={11} className={reasoningEffort === "high" ? "text-[#c026d3]" : reasoningEffort === "medium" ? "text-[#d97706]" : "text-[#94a3b8]"} />
                <span>{reasoningEffort === "low" ? "低" : reasoningEffort === "medium" ? "中" : "高"}</span>
              </button>

              {/* Plan 模式开关：开启后智能体先输出任务计划 */}
              <button
                type="button"
                onClick={() => setPlanMode((prev) => !prev)}
                title={
                  planMode
                    ? "Plan 模式已开启：智能体先输出任务计划再执行"
                    : "Plan 模式已关闭"
                }
                className={`h-6.5 px-2 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer border transition-colors ${
                  planMode
                    ? "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]"
                    : "bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]"
                }`}
              >
                <ListChecks size={11} className={planMode ? "text-[#2563eb]" : "text-[#94a3b8]"} />
                <span>Plan</span>
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
                <div className="flex items-center gap-1.5">
                  {input.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={handleSend}
                      className="bg-[#f59e0b] hover:bg-[#d97706] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 animate-in fade-in"
                      title="将新问题加入执行队列，当前回答完成后自动执行"
                    >
                      <ListOrdered size={11} />
                      <span>加入队列 (#{questionQueue.length + 1})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleStopGenerating}
                    className="bg-[#ef4444] hover:bg-[#dc2626] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 animate-pulse"
                    title="立即中断当前流式生成"
                  >
                    <Square size={11} />
                    <span>停止生成</span>
                  </button>
                </div>
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

        {/* 输入框下方状态条 (项目 ⌵ | 分支 ⌵ | 压缩保护水位，完全对齐截图) */}
        <div className="flex justify-between items-center text-[11px] text-[#78716c] px-1 pt-1 font-mono shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 cursor-pointer hover:text-[#1e1b18]">
              <Folder size={12} className="text-[#d96b27]" />
              <span>{currentProjectName}</span>
              <ChevronDown size={10} />
            </span>
            <span className="text-[#cbd5e1]">|</span>
            <span
              onClick={() => setIsGitModalOpen(true)}
              className="flex items-center gap-1 cursor-pointer hover:text-[#1e1b18]"
            >
              <GitBranch size={12} className="text-[#0284c7]" />
              <span>{detectedGitBranch || "main"}</span>
              <ChevronDown size={10} />
            </span>
          </div>

          <div className="flex items-center gap-1 text-[#059669]">
            <Zap size={11} className="text-[#10b981]" />
            <span>25.2%</span>
            <ShieldCheck size={11} className="text-[#10b981]" />
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

      {/* 🚀 OpenCode 引擎安装与进度弹窗 */}
      <OpenCodeInstallModal
        isOpen={isOpenCodeInstallModalOpen}
        onClose={() => setIsOpenCodeInstallModalOpen(false)}
        onInstalledSuccess={() => {
          const chans = llmConfigService.getChannels();
          setChannels(chans);
          const activeChan = chans.find((c) => c.id === "chan-opencode") || chans[0];
          setActiveChannel(activeChan);
          if (activeChan?.models?.[0]) setActiveModel(activeChan.models[0]);
        }}
      />
    </section>
  );
};
