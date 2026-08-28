import { astExtractor } from "./astExtractor";
import { ASTCompressedItem, ASTCompressionResult, CodeAnchorRef } from "../types/contracts";

export interface ChatMessage {
  role: string;
  content: string;
  isCompressedSummary?: boolean;
  codeDensity?: number;
  priorityScore?: number;
  astAnchors?: CodeAnchorRef[];
}

export interface CompressionResult extends ASTCompressionResult {}

class ContextCompressor {
  /**
   * 高效估算文本 Token 占用 (综合汉字 1.5 token/字与代码/英文 3.8 字符/token)
   */
  public estimateTokens(text: string): number {
    if (!text) return 0;
    let cjkCount = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0x4e00 && code <= 0x9fff) {
        cjkCount++;
      }
    }
    const nonCjkChars = text.length - cjkCount;
    return Math.ceil(cjkCount * 1.5 + nonCjkChars / 3.8);
  }

  /**
   * 估算整个消息历史的 Token 总量
   */
  public estimateMessagesTokens(messages: ChatMessage[]): number {
    return messages.reduce((acc, m) => acc + this.estimateTokens(m.content) + 4, 0);
  }

  /**
   * 计算单条消息的语义优先级得分 (基于代码密度、架构决策词与引用频次)
   */
  public scoreMessagePriority(msg: ChatMessage): number {
    let score = 1.0;
    const text = msg.content || "";

    // 1. 代码块与 Diff 变更密度 (最高优先级保护，防止代码被误截断)
    const codeBlockMatches = text.match(/```[\s\S]*?```/g);
    if (codeBlockMatches) {
      score += codeBlockMatches.length * 3.0;
    }

    // 2. 架构决策与工程规约标记
    if (/架构|规约|必须|禁止|NPE|TDD|守卫|CREATE_NO_WINDOW|Graph-RAG|AST/.test(text)) {
      score += 2.5;
    }

    // 3. 角色权重 (系统指令与关键助手代码输出优先保留)
    if (msg.role === "system") score += 5.0;
    if (msg.role === "assistant" && text.length > 200) score += 1.5;

    return score;
  }

  /**
   * 检查是否触达动态压缩阈值
   */
  public isThresholdReached(
    currentTokens: number,
    contextWindow: number,
    threshold: number = 0.85
  ): boolean {
    if (contextWindow <= 0) return false;
    return currentTokens >= contextWindow * threshold;
  }

  /**
   * “AST 结构感知 + 引用锚点 + 滑动窗口”动态上下文蒸馏算法
   * 1. 绝对保护系统提示词 (System Anchor Protection)
   * 2. 滑动窗口保护最新 4 轮活跃交互 (Critical Recency Window - 100% 全保真)
   * 3. 对中远期历史中的代码块进行轻量 AST 骨架提取，保留接口/类/函数契约，折叠实现体
   * 4. 为压缩片段附带精准文件与行号锚点 (CodeAnchorRef)，支持一键跳转编辑器
   */
  public compressContext(
    messages: ChatMessage[],
    contextWindow: number = 128000,
    threshold: number = 0.85
  ): CompressionResult {
    const originalTokens = this.estimateMessagesTokens(messages);
    const targetBudget = Math.floor(contextWindow * threshold);

    // 若未超预算且消息条数少于 6 条，无需压缩
    if (originalTokens <= targetBudget || messages.length <= 6) {
      return {
        wasCompressed: false,
        compressedMessages: messages,
        astItems: [],
        originalTokens,
        newTokens: originalTokens,
        savedTokens: 0,
        ratioPercent: 0,
      };
    }

    // 1. 分离系统锚点
    const systemAnchor = messages.find((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    // 2. 滑动窗口：保护最新 4 轮 (至少 4 条消息)
    const recencyWindowSize = Math.min(4, nonSystem.length);
    const middleHistory = nonSystem.slice(0, nonSystem.length - recencyWindowSize);
    const recentHistory = nonSystem.slice(nonSystem.length - recencyWindowSize);

    // 3. 对 middleHistory 进行 AST 结构提取与代码密度评分
    const astItems: ASTCompressedItem[] = [];
    const highPriorityMessages: ChatMessage[] = [];
    const distilledPoints: string[] = [];

    for (const msg of middleHistory) {
      const score = this.scoreMessagePriority(msg);

      // 提取代码块中的 AST 骨架
      const codeBlockMatch = msg.content.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].length > 150) {
        const rawCode = codeBlockMatch[1];
        const astItem = astExtractor.generateASTDistillation(rawCode, "src/snippet.ts");
        astItems.push(astItem);
      }

      if (score >= 3.5) {
        highPriorityMessages.push(msg);
      } else {
        const snippet = msg.content.slice(0, 80).replace(/\n/g, " ");
        distilledPoints.push(`[${msg.role.toUpperCase()}] ${snippet}...`);
      }
    }

    // 构建结构化摘要消息 (含 AST 骨架与锚点引用)
    const astSnippets = astItems.map((item) => item.summary).join("\n\n");
    const allAnchors = astItems.map((item) => item.anchor);

    const summaryMsg: ChatMessage = {
      role: "system",
      content:
        `### 📦 AST 感知历史上下文分层摘要 (AST-Preserved Context Summary):\n` +
        `- **已蒸馏轮数**: ${middleHistory.length} 轮中远期对话\n` +
        `- **关键交互脉络**:\n` +
        distilledPoints.slice(0, 5).map((p) => `  • ${p}`).join("\n") +
        (astSnippets ? `\n\n- **保留的代码 AST 类型与接口骨架契约**:\n\`\`\`typescript\n${astSnippets}\n\`\`\`` : "") +
        `\n- **最新活跃窗口**: 保持 100% 完整对话保真。`,
      isCompressedSummary: true,
      astAnchors: allAnchors,
    };

    // 4. 组合最终压缩上下文
    const compressedList: ChatMessage[] = [];
    if (systemAnchor) compressedList.push(systemAnchor);
    compressedList.push(summaryMsg);
    compressedList.push(...highPriorityMessages);
    compressedList.push(...recentHistory);

    const newTokens = this.estimateMessagesTokens(compressedList);
    const savedTokens = Math.max(0, originalTokens - newTokens);
    const ratioPercent = Math.round((savedTokens / originalTokens) * 100);

    return {
      wasCompressed: true,
      compressedMessages: compressedList,
      astItems,
      originalTokens,
      newTokens,
      savedTokens,
      ratioPercent,
    };
  }
}

export const contextCompressor = new ContextCompressor();
