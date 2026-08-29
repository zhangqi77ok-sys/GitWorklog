import { DiffLine } from "../types/contracts";

/**
 * 轻量逐行 diff 服务：展示文件修改前后的变化。
 * 中小文件走 LCS 精确 diff；超大文件退化为前后缀匹配，避免 O(n*m) 内存爆炸。
 */

const LCS_CELL_LIMIT = 4_000_000; // 2000 x 2000 行以内的矩阵可接受

/**
 * 计算逐行 diff，返回按展示顺序排列的行集合。
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  if (oldLines.length * newLines.length > LCS_CELL_LIMIT) {
    return prefixSuffixDiff(oldLines, newLines);
  }
  return lcsDiff(oldLines, newLines);
}

/**
 * LCS 精确逐行 diff（仅用于中小文件）。
 */
function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift({ type: "same", text: a[i - 1], oldLineNumber: i, newLineNumber: j });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      result.unshift({ type: "remove", text: a[i - 1], oldLineNumber: i });
      i--;
    } else {
      result.unshift({ type: "add", text: b[j - 1], newLineNumber: j });
      j--;
    }
  }
  while (i > 0) {
    result.unshift({ type: "remove", text: a[i - 1], oldLineNumber: i });
    i--;
  }
  while (j > 0) {
    result.unshift({ type: "add", text: b[j - 1], newLineNumber: j });
    j--;
  }
  return result;
}

/**
 * 前后缀匹配的简化 diff（仅用于超大文件退化场景）。
 */
function prefixSuffixDiff(a: string[], b: string[]): DiffLine[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const result: DiffLine[] = [];
  for (let k = 0; k < start; k++) {
    result.push({ type: "same", text: a[k], oldLineNumber: k + 1, newLineNumber: k + 1 });
  }
  for (let k = start; k < endA; k++) {
    result.push({ type: "remove", text: a[k], oldLineNumber: k + 1 });
  }
  for (let k = start; k < endB; k++) {
    result.push({ type: "add", text: b[k], newLineNumber: k + 1 });
  }
  for (let k = endA; k < a.length; k++) {
    result.push({
      type: "same",
      text: a[k],
      oldLineNumber: k + 1,
      newLineNumber: k + 1 + (endB - endA),
    });
  }
  return result;
}
