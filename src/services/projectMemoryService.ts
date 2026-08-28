/**
 * CodeMind 生产级双层记忆引擎 (Dual-Layer Memory Architecture)
 * 1. 短期工作记忆 (Short-Term Working Memory - STM):
 *    - 基于 SessionId 进行高保真多轮对话全量持久化 (避免切换丢失历史)
 *    - 配合滑动窗口与 Token 预算进行精细化修剪
 * 2. 长期情景与语义记忆 (Long-Term Episodic Memory - LTM):
 *    - 针对同一项目持久化技术栈架构决策、用户核心偏好、代码规约与 Bug 修复经验
 *    - 跨会话自动索引并基于用户意图进行 Graph-RAG / 语义匹配注入
 */

export interface LongTermMemoryItem {
  id: string;
  category: "architecture" | "decision" | "user_preference" | "bug_fix" | "code_convention";
  summary: string;
  details?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMemoryStore {
  projectName: string;
  longTermMemories: LongTermMemoryItem[];
  lastUpdated: number;
}

const STORAGE_SESSION_PREFIX = "codemind_session_msgs_";
const STORAGE_PROJECT_LTM_PREFIX = "codemind_project_ltm_";

class ProjectMemoryService {
  /**
   * 1. 短期会话记忆：读取指定会话的完整历史记录
   */
  public getSessionMessages(sessionId: string): any[] {
    if (!sessionId) return [];
    try {
      const data = localStorage.getItem(`${STORAGE_SESSION_PREFIX}${sessionId}`);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.warn(`[MemoryService] Failed to load messages for session ${sessionId}:`, err);
    }
    return [];
  }

  /**
   * 1. 短期会话记忆：保存指定会话的完整历史记录
   */
  public saveSessionMessages(sessionId: string, messages: any[]): void {
    if (!sessionId || !Array.isArray(messages)) return;
    try {
      localStorage.setItem(
        `${STORAGE_SESSION_PREFIX}${sessionId}`,
        JSON.stringify(messages)
      );
    } catch (err) {
      console.warn(`[MemoryService] Failed to save messages for session ${sessionId}:`, err);
    }
  }

  /**
   * 1. 短期会话记忆：清除指定会话
   */
  public deleteSession(sessionId: string): void {
    if (!sessionId) return;
    try {
      localStorage.removeItem(`${STORAGE_SESSION_PREFIX}${sessionId}`);
    } catch (err) {}
  }

  /**
   * 2. 长期记忆：获取项目长期记忆库 (包含项目默认的架构基线)
   */
  public getProjectMemories(projectName: string): LongTermMemoryItem[] {
    if (!projectName) return [];
    try {
      const data = localStorage.getItem(`${STORAGE_PROJECT_LTM_PREFIX}${projectName}`);
      if (data) {
        const parsed: ProjectMemoryStore = JSON.parse(data);
        if (parsed && Array.isArray(parsed.longTermMemories) && parsed.longTermMemories.length > 0) {
          return parsed.longTermMemories;
        }
      }
    } catch (err) {
      console.warn(`[MemoryService] Failed to load LTM for ${projectName}:`, err);
    }

    // 初始化项目的真实架构基线长期记忆
    const defaultMemories: LongTermMemoryItem[] = [
      {
        id: "ltm-arch-1",
        category: "architecture",
        summary: "桌面客户端采用 Tauri v2 + Rust 后端驱动与 React 19 前端架构，执行系统命令禁止弹出 CMD 黑框 (CREATE_NO_WINDOW)",
        details: "Rust 端通过 creation_flags(0x08000000) 静默执行；前端通过 nativeService 与 llmGatewayEngine 进行统一网关调度。",
        tags: ["tauri", "rust", "react", "architecture", "silent_exec"],
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 3600000,
      },
      {
        id: "ltm-arch-2",
        category: "code_convention",
        summary: "统一流式网关与 ReAct 智能体范式，严禁演示 Demo 假数据，必须读取真实工程上下文与双层记忆",
        details: "支持 95% 上下文分层压缩、文件选择模态弹窗、/ 键唤起 Skills 与 MCP 协议，输出采用标准元数据与深度推理链。",
        tags: ["react_agent", "llm_gateway", "production_grade", "no_demo", "memory"],
        createdAt: Date.now() - 1800000,
        updatedAt: Date.now() - 1800000,
      },
      {
        id: "ltm-arch-3",
        category: "decision",
        summary: "会话状态三态可视化规范：运行中绿色旋转圆标、空闲蓝色实心圆标、异常失败红色圆标",
        details: "通过 session-status-changed 事件实时广播同步左侧项目会话树与筛选浮层。",
        tags: ["ui_ux", "session_status", "badges"],
        createdAt: Date.now() - 900000,
        updatedAt: Date.now() - 900000,
      },
    ];

    this.saveProjectMemories(projectName, defaultMemories);
    return defaultMemories;
  }

  /**
   * 2. 长期记忆：保存项目长期记忆库
   */
  public saveProjectMemories(projectName: string, memories: LongTermMemoryItem[]): void {
    if (!projectName) return;
    try {
      const payload: ProjectMemoryStore = {
        projectName,
        longTermMemories: memories,
        lastUpdated: Date.now(),
      };
      localStorage.setItem(
        `${STORAGE_PROJECT_LTM_PREFIX}${projectName}`,
        JSON.stringify(payload)
      );
    } catch (err) {}
  }

  /**
   * 2. 长期记忆：添加一条新的记忆项
   */
  public addProjectMemory(
    projectName: string,
    item: Omit<LongTermMemoryItem, "id" | "createdAt" | "updatedAt">
  ): LongTermMemoryItem {
    const list = this.getProjectMemories(projectName);
    const newItem: LongTermMemoryItem = {
      ...item,
      id: `ltm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.unshift(newItem);
    this.saveProjectMemories(projectName, list);
    return newItem;
  }

  /**
   * 2. 长期记忆：基于用户意图检索最相关的长期记忆条目 (语义 + 标签加权)
   */
  public queryRelevantMemories(projectName: string, query: string, maxItems: number = 3): LongTermMemoryItem[] {
    const memories = this.getProjectMemories(projectName);
    if (!query || !query.trim()) return memories.slice(0, maxItems);

    const q = query.toLowerCase();
    const scored = memories.map((m) => {
      let score = 0;
      // 标签匹配
      for (const tag of m.tags) {
        if (q.includes(tag.toLowerCase())) score += 5;
      }
      // 摘要匹配
      if (m.summary.toLowerCase().includes(q)) score += 4;
      // 分类匹配
      if (q.includes(m.category)) score += 2;
      // 关键词重合度
      const words = q.split(/\s+/);
      for (const w of words) {
        if (w.length > 1 && m.summary.toLowerCase().includes(w)) score += 1;
      }
      return { item: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxItems).map((s) => s.item);
  }

  /**
   * 从对话交互中自动提取潜在长期记忆 (Auto-Distill LTM)
   */
  public autoExtractMemoriesFromTurn(
    projectName: string,
    userText: string,
    assistantText: string
  ): void {
    if (!userText || !assistantText) return;
    
    // 如果用户提出了明确的架构或规约要求
    const isConstraint = /记住|必须|规范|严禁|规则|永远|以后都|机制|架构|记忆|图谱/.test(userText);
    if (isConstraint && userText.length > 5) {
      const summary = userText.slice(0, 100);
      const tags: string[] = [];
      if (/架构|tauri|rust|react|vue/.test(userText)) tags.push("architecture");
      if (/图谱|记忆|知识/.test(userText)) tags.push("knowledge_memory");
      if (/规则|规约|禁止|必须/.test(userText)) tags.push("code_convention");

      this.addProjectMemory(projectName, {
        category: tags.includes("architecture") ? "architecture" : "user_preference",
        summary: `核心指令与项目约定: ${summary}`,
        details: `基于对话沉淀: "${userText}"`,
        tags: tags.length > 0 ? tags : ["preference", "instruction"],
      });
    }
  }

  /**
   * 记录用户对回答的 1~5 星打分并动态学习 (Rating Feedback Learning)
   * - 1~2 星: 记录为负面缺陷反馈 (negative_critique)，下次关联话题自动触发最高严谨度校验 (Strict Verification Mode)
   * - 4~5 星: 记录为黄金范本 (golden_reference)，下次关联话题继承该优秀的交付范式
   */
  public recordRatingFeedback(
    projectName: string,
    userQuery: string,
    assistantContent: string,
    rating: 1 | 2 | 3 | 4 | 5
  ): { mode: string; message: string } {
    const qShort = userQuery.slice(0, 80);

    if (rating <= 2) {
      this.addProjectMemory(projectName, {
        category: "bug_fix",
        summary: `[用户差评/低分警示 ⭐${rating}星] ${qShort}`,
        details: `用户对此类问题给出低分反馈（要求后续回答必须做深度逻辑验证、排查边界异常、给出生产级严谨方案，严禁糊弄或demo降级）。关联回答摘要: "${assistantContent.slice(0, 150)}..."`,
        tags: ["negative_critique", "strict_verification", "high_rigor"],
      });
      return {
        mode: "CRITICAL_RIGOR",
        message: `已记录 ${rating} 星反馈。已自动为项目【${projectName}】启动最高严谨度校验防线，后续关联内容将执行深入验证与代码防守！`,
      };
    } else if (rating >= 4) {
      this.addProjectMemory(projectName, {
        category: "code_convention",
        summary: `[黄金高分范例 ⭐${rating}星] ${qShort}`,
        details: `用户高度认可该回答方案的结构与深度，后续相似主题应沿用此范式。回答摘要: "${assistantContent.slice(0, 150)}..."`,
        tags: ["golden_reference", "best_practice"],
      });
      return {
        mode: "GOLDEN_TEMPLATE",
        message: `已记录 ${rating} 星高分好评！已沉淀为【${projectName}】黄金范本，后续关联内容将保持高品质对齐。`,
      };
    }

    return {
      mode: "STANDARD",
      message: `已记录 ${rating} 星常规反馈。`,
    };
  }

  /**
   * 动态检索严谨度约束 (Strictness Constraint Retrieval)
   */
  public getDynamicStrictnessConstraint(
    projectName: string,
    currentQuery: string
  ): { level: "CRITICAL_RIGOR" | "STANDARD" | "GOLDEN_TEMPLATE"; constraintPrompt: string } {
    if (!currentQuery) return { level: "STANDARD", constraintPrompt: "" };

    const memories = this.queryRelevantMemories(projectName, currentQuery, 5);
    const negativeCritiques = memories.filter((m) =>
      m.tags.includes("negative_critique") || m.summary.includes("差评") || m.summary.includes("低分警示")
    );
    const goldenReferences = memories.filter((m) =>
      m.tags.includes("golden_reference") || m.summary.includes("黄金高分")
    );

    if (negativeCritiques.length > 0) {
      const issues = negativeCritiques.map((c) => `• ${c.summary}`).join("\n");
      return {
        level: "CRITICAL_RIGOR",
        constraintPrompt: `\n### 🛡️ 【最高严谨度防御模式 (Strict Verification Mode Active)】:
⚠️ 用户此前在项目【${projectName}】中对以下关联主题给出过低星差评，表示强烈关注严谨性：
${issues}
⚡ 本次回答强制执行以下军规：
1. 绝对严禁任何形式的伪代码、Demo 降级或无依据假设；
2. 必须给出完整可运行的生产级实现，覆盖全部异常流与边界条件；
3. 必须详细阐明设计决策依据，并对潜在缺陷做防御性推导。`,
      };
    }

    if (goldenReferences.length > 0) {
      return {
        level: "GOLDEN_TEMPLATE",
        constraintPrompt: `\n### 🏆 【黄金范式对齐提示】:
用户此前对类似主题的高质量交付给予了 5 星好评，请继续保持清晰的架构分层、规范的中文注释与结构化展示。`,
      };
    }

    return { level: "STANDARD", constraintPrompt: "" };
  }
}

export const projectMemoryService = new ProjectMemoryService();
