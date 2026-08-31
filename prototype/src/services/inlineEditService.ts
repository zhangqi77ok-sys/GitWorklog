/**
 * Inline Edit Engine (Cmd+K / Ctrl+K)
 * Provides selection-level prompt construction, fast stream merging, and LCS line-by-line diffing.
 */

export interface InlineDiffLine {
  type: 'added' | 'deleted' | 'unchanged';
  text: string;
  originalIndex?: number;
  newIndex?: number;
}

/**
 * Builds the ultra-compact system and user prompt for inline code editing.
 */
export function buildInlineEditPrompt(options: {
  filePath: string;
  language?: string;
  selectedText: string;
  startLine: number;
  endLine: number;
  prefixContext: string;
  suffixContext: string;
  userInstruction: string;
}): { systemPrompt: string; userPrompt: string } {
  const { filePath, language = 'typescript', selectedText, startLine, endLine, prefixContext, suffixContext, userInstruction } = options;

  const systemPrompt = `你是一个高精度的代码内联编辑与重构引擎 (Inline Code Editor)。
【任务定义】:
用户在文件 "${filePath}" (行 ${startLine} 到 ${endLine}) 中选中了一段代码，并给出了具体修改指令。

【核心铁律】:
1. 严格只输出替换该选区的纯代码！
2. 严禁输出任何 Markdown 格式外框 (严禁输出 \`\`\`${language} 或 \`\`\` 标记)！
3. 严禁输出任何解释、注释说明、前后问候语或总结！
4. 保持与上下文完全一致的缩进、风格与变量命名规范。`.trim();

  const userPrompt = `
【上文代码参考 (前 30 行)】:
${prefixContext || '(文件开头)'}

【待替换的选中代码 (第 ${startLine} - ${endLine} 行)】:
${selectedText}

【下文代码参考 (后 30 行)】:
${suffixContext || '(文件结尾)'}

【用户的修改指令】:
${userInstruction}

请严格按上述铁律，直接输出用于替换该选区的代码：
`.trim();

  return { systemPrompt, userPrompt };
}

/**
 * Computes line-by-line diff between original text and replacement text using LCS algorithm.
 */
export function computeLineDiff(originalText: string, newText: string): InlineDiffLine[] {
  const origLines = originalText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  const m = origLines.length;
  const n = newLines.length;

  // LCS DP Matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to generate diff
  const result: InlineDiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'unchanged',
        text: origLines[i - 1],
        originalIndex: i,
        newIndex: j
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        text: newLines[j - 1],
        newIndex: j
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({
        type: 'deleted',
        text: origLines[i - 1],
        originalIndex: i
      });
      i--;
    }
  }

  return result;
}

/**
 * Cleans potential markdown wrapping if the model accidentally outputs markdown fences
 */
export function cleanInlineEditOutput(rawOutput: string): string {
  let cleaned = rawOutput.trim();
  // Strip leading code fence
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) {
      cleaned = cleaned.slice(firstNewline + 1);
    }
  }
  // Strip trailing code fence
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3).trimEnd();
  }
  return cleaned;
}
