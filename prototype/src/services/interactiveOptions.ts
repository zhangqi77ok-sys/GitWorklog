/**
 * Interactive Options Resolver (WP-Q)
 * 智能识别大模型在正文末尾提出的候选决策步骤（如“需要我继续做以下哪一步？1. ... 2. ... 3. ...”），
 * 转化为结构化的人机决策卡片，提供给用户直接点击一键派发。
 */

export interface InteractiveOptionItem {
  id: string;
  index: number;
  label: string;
  promptText: string;
}

/**
 * 从模型正文中提取出交互式候选步骤列表
 */
export function extractInteractiveOptions(content: string): InteractiveOptionItem[] {
  if (!content || !content.trim()) return [];

  // 1. 检测是否包含决策提问前导句
  const triggerRegex = /(?:需要我(?:继续)?(?:做|执行|进行)?(?:以下)?哪一步[？?:]?|请(?:选择|决定|指定)(?:以下)?(?:哪一步|方案|步骤)[：:?？]?|(?:后续|下一步)(?:可选|候选)?(?:方案|步骤|行动)[：:?？]?|你可以选择[：:?？]?)/i;
  const match = triggerRegex.exec(content);
  if (!match) return [];

  const triggerIndex = match.index;
  const trailingContent = content.slice(triggerIndex);

  // 2. 匹配编号选项列表（1. xxx, 2. xxx, 3. xxx 或 ① xxx, ② xxx）
  const options: InteractiveOptionItem[] = [];
  const lines = trailingContent.split('\n');
  let optionIndex = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 匹配如 "1. 读完 model-gateway-v2-contract.md 全文..." 或 "1、..." 或 "[1] ..."
    const optionMatch = /^(?:(\d+)[.、\s\-)\]]|(?:\[(\d+)\])|[①②③④⑤⑥⑦⑧⑨⑩])\s*(.+)$/.exec(trimmed);
    if (optionMatch) {
      const rawNum = optionMatch[1] || optionMatch[2] || `${optionIndex}`;
      const num = parseInt(rawNum, 10) || optionIndex;
      const text = (optionMatch[3] || '').trim();

      if (text.length >= 3) {
        // 清洗掉可能的 markdown 符号
        const cleanText = text.replace(/^[*_`~]+|[*_`~]+$/g, '').trim();
        options.push({
          id: `opt-${num}-${Date.now()}`,
          index: num,
          label: `${num}. ${cleanText}`,
          promptText: `执行第 ${num} 步：${cleanText}`
        });
        optionIndex++;
      }
    }
  }

  // 至少有 2 个选项才构成多选决策卡片
  return options.length >= 2 ? options : [];
}
