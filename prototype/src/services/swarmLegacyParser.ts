/**
 * Task B1/C2: Swarm 旧消息正则回退解析（无结构化 swarm 字段时的兼容渲染）。
 * 注: emoji 用字面量交替而非字符类——无 u 标志时字符类按 UTF-16 码元匹配，代理对 emoji（如 📐）无法整体命中。
 */
export interface SubagentSection {
  id: string;
  name: string;
  icon: string;
  role: string;
  duty?: string;
  content: string;
  status: 'passed' | 'running' | 'pending';
  error?: string;
}

export interface SwarmParsedData {
  masterPlanning: string;
  subagents: SubagentSection[];
  masterSummary: string;
  isSwarmFormatted: boolean;
}

export function parseSwarmContent(rawText: string, isStreaming?: boolean): SwarmParsedData {
  if (!rawText) {
    return { masterPlanning: '', subagents: [], masterSummary: '', isSwarmFormatted: false };
  }

  const subagentHeaderRegex = /(?:###|##)\s*(?:(?:🐝|🤖|📐|💻|🧪|💾|📋|🛡\uFE0F?|📝|⚡)\s*)?\[?(?:Subagent\s*[·:：\-_ ]|子智能体\s*[·:：\-_ ])?\s*([A-Za-z0-9\u4e00-\u9fa5\-_ ]*?(?:Architect|Coder|Developer|Engineer|Tester|QA|DBA|Security|Designer|Docs|Writer|架构|编码|开发|测试|审计|审查|数据库|文档)[^\]\n]*)\]?/gi;

  const matches: { index: number; fullMatch: string; name: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = subagentHeaderRegex.exec(rawText)) !== null) {
    matches.push({ index: m.index, fullMatch: m[0], name: m[1].trim() });
  }

  if (matches.length === 0) {
    return { masterPlanning: rawText, subagents: [], masterSummary: '', isSwarmFormatted: false };
  }

  const masterPlanning = rawText.slice(0, matches[0].index).trim();
  const subagents: SubagentSection[] = [];
  const summaryMarkerRegex = /(?:###|##)\s*(?:👑|⚖️|🎯)?\s*\[?(?:Master\s*(?:终审|总结|汇报|交付)|终审裁决|验收交付|总结与交付)[^\]\n]*\]?/gi;

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const startIndex = cur.index + cur.fullMatch.length;
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
    let subagentRaw = rawText.slice(startIndex, nextIndex);

    if (i === matches.length - 1) {
      const summaryMatch = summaryMarkerRegex.exec(subagentRaw);
      if (summaryMatch) {
        subagentRaw = subagentRaw.slice(0, summaryMatch.index);
      }
    }

    let duty: string | undefined = undefined;
    const dutyMatch = subagentRaw.match(/>\s*\*\*(?:分工职责|角色定位|职责目标)\*\*[:：]?\s*([^\n]+)/i);
    if (dutyMatch) duty = dutyMatch[1].trim();

    let icon = '🤖';
    const lowerName = cur.name.toLowerCase();
    if (lowerName.includes('architect') || lowerName.includes('架构')) icon = '📐';
    else if (lowerName.includes('coder') || lowerName.includes('编码') || lowerName.includes('开发') || lowerName.includes('前端') || lowerName.includes('后端')) icon = '💻';
    else if (lowerName.includes('test') || lowerName.includes('qa') || lowerName.includes('测试')) icon = '🧪';
    else if (lowerName.includes('dba') || lowerName.includes('数据库') || lowerName.includes('表结构')) icon = '💾';
    else if (lowerName.includes('pm') || lowerName.includes('产品') || lowerName.includes('需求')) icon = '📋';
    else if (lowerName.includes('sec') || lowerName.includes('安全') || lowerName.includes('审计')) icon = '🛡️';
    else if (lowerName.includes('review') || lowerName.includes('终审') || lowerName.includes('评审')) icon = '⚖️';
    else if (lowerName.includes('doc') || lowerName.includes('文档') || lowerName.includes('writer')) icon = '📝';

    const isLast = i === matches.length - 1;
    subagents.push({
      id: `subagent-${i}-${cur.name.replace(/\s+/g, '_')}`,
      name: cur.name,
      icon,
      role: cur.name,
      duty,
      content: subagentRaw.trim(),
      status: (isLast && isStreaming) ? 'running' : 'passed'
    });
  }

  let masterSummary = '';
  const lastSubagentRaw = rawText.slice(matches[matches.length - 1].index);
  const sumMatch = lastSubagentRaw.match(/(?:###|##)\s*(?:👑|⚖️|🎯)?\s*\[?(?:Master\s*(?:终审|总结|汇报|交付)|终审裁决|验收交付|总结与交付)[^\]\n]*\]?[\s\S]*/i);
  if (sumMatch) masterSummary = sumMatch[0].trim();

  return { masterPlanning, subagents, masterSummary, isSwarmFormatted: true };
}
