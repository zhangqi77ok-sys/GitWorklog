/**
 * Task G1: Agent Loop 与 Swarm 统一「可分享/可复制」文本。
 *
 * 目标：两种模式输出风格一致——只保留干净的分析/对话文本，
 * 剥离工具动作块（write_file/run_command 等）与思考过程，保证分享与复制对称可用。
 */
import type { ChatMessage } from '../types/contracts';

/** 剥离思考/推演过程标记。 */
export function stripThinkingProcess(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleaned = cleaned.replace(/^\s*\*正在深入推演与分析代码架构\.\.\.\*\s*/gm, '');
  cleaned = cleaned.replace(/^\s*\*Thinking Process\*\s*/gm, '');
  return cleaned.trim();
}

/** 剥离 Agent 动作围栏块（write_file/file/create_file/run_command/bash/sh/powershell/cmd）。 */
export function stripAgentActionBlocks(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/```(?:write_file|file|create_file):[^\n]*\n[\s\S]*?```/gi, '')
    .replace(/```(?:run_command|bash|sh|powershell|cmd)\b[^\n]*\n[\s\S]*?```/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Swarm 结构化消息 → 可分享文本（Master 拆解 + 各角色产出 + 终审）。 */
function buildSwarmText(message: ChatMessage): string {
  if (!message.swarm) return '';
  const parts: string[] = [];
  if (message.swarm.masterPlanning && message.swarm.masterPlanning.trim()) {
    parts.push(`【Master 拆解】\n${message.swarm.masterPlanning}`);
  }
  for (const role of message.swarm.roles) {
    const failTag = role.status === 'error' ? '（失败）' : '';
    parts.push(`### ${role.icon} [${role.name}]${failTag}\n${role.content || ''}`);
  }
  if (message.swarm.masterSummary && message.swarm.masterSummary.trim()) {
    parts.push(`【Master 终审】\n${message.swarm.masterSummary}`);
  }
  return parts.join('\n\n');
}

/**
 * 统一「可分享/可复制」对话文本：
 * - Swarm 消息：拼接拆解 + 角色产出 + 终审；
 * - Agent Loop 消息：剥离工具动作块与思考过程，仅保留分析/对话文本。
 */
export function buildCleanConversationText(message: ChatMessage): string {
  // content 优先（兼容旧消息）；Swarm 消息 content 为空时拼接结构化内容
  if (message.content && message.content.trim()) {
    return stripThinkingProcess(stripAgentActionBlocks(message.content));
  }
  if (message.swarm) return buildSwarmText(message);
  return '';
}

/** 复制「全部轮次」文本：每轮用动态标题 + 净化后的内容。 */
export function buildCleanRoundsText(message: ChatMessage): string {
  if (!message.rounds || message.rounds.length === 0) return buildCleanConversationText(message);
  return message.rounds
    .map(r => `[第 ${r.roundId} 轮] ${r.title}\n${stripThinkingProcess(stripAgentActionBlocks(r.content || ''))}`)
    .join('\n\n---\n\n');
}
