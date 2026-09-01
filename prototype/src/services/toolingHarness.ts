/**
 * Tooling Harness Primitives (WP-S)
 * 原生治具与上下文体积守护引擎：
 * 1. 提供精确、透明、原生对齐的文件读取、写入、遍历与搜索命令生成器；
 * 2. 提供严格的上下文体积裁剪守护 (Context Hygiene Harness)，杜绝输出爆炸至 500k+ tokens。
 */

/**
 * 上下文体积裁剪治具：限制单次工具输出的最大行数与字符数
 * 超出时保留头部与尾部，并在中间插入明确的折叠提示与切片读取指引。
 */
export function truncateToolOutputForContext(
  output: string,
  maxLines: number = 100,
  maxChars: number = 6000
): string {
  if (!output) return '(无输出)';

  const lines = output.split('\n');
  if (lines.length <= maxLines && output.length <= maxChars) {
    return output;
  }

  const headCount = Math.floor(maxLines * 0.6);
  const tailCount = Math.floor(maxLines * 0.4);

  const headLines = lines.slice(0, headCount);
  const tailLines = lines.slice(lines.length - tailCount);
  const omittedCount = lines.length - headCount - tailCount;

  return [
    ...headLines,
    `\n--- [⚠️ 输出过长已自动折叠: 中间省略 ${omittedCount} 行，如需查看特定段落请使用 read_file 并指定 start_line/end_line] ---\n`,
    ...tailLines
  ].join('\n').slice(0, maxChars + 300);
}

/**
 * 原生文件读取治具命令构造器 (UTF-8 纯净、支持切片与绝对/相对路径、附带精准行号)
 */
export function formatReadFileCommand(filePath: string, startLine?: number, endLine?: number): string {
  const cleanPath = filePath.trim().replace(/^["']|["']$/g, '');
  const start = startLine && startLine > 0 ? startLine : 1;
  const count = endLine && endLine >= start ? (endLine - start + 1) : 200;

  // 使用跨平台自愈 PowerShell 脚本执行文件切片读取
  return `powershell -NoProfile -Command "
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$p = '${cleanPath}';
if (-not [System.IO.Path]::IsPathRooted($p)) {
  if (-not (Test-Path $p)) {
    $found = Get-ChildItem -Filter ([System.IO.Path]::GetFileName($p)) -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1;
    if ($found) { $p = $found.FullName; }
  }
}
if (-not (Test-Path $p)) {
  Write-Error ('[错误: 未找到文件 ' + $p + '，请检查路径是否正确]');
  exit 1;
}
$lines = Get-Content -LiteralPath $p -Encoding UTF8 -ErrorAction Stop;
$total = $lines.Count;
$start = ${start};
$take = ${count};
$slice = $lines | Select-Object -Skip ($start - 1) -First $take;
$idx = $start;
foreach ($line in $slice) {
  Write-Output ('{0,5}: {1}' -f $idx, $line);
  $idx++;
}
if ($start + $take - 1 -lt $total) {
  Write-Output ('--- [共 ' + $total + ' 行，当前已显示至第 ' + ($start + $take - 1) + ' 行] ---');
}
"`.trim();
}

/**
 * 原生目录遍历治具命令构造器
 */
export function formatListDirCommand(dirPath: string, maxDepth: number = 2): string {
  const cleanPath = dirPath.trim().replace(/^["']|["']$/g, '') || '.';
  return `powershell -NoProfile -Command "
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
$p = '${cleanPath}';
if (Test-Path $p) {
  Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Select-Object Mode, Name, Length, LastWriteTime | Format-Table -AutoSize;
} else {
  Write-Error ('[错误: 目录不存在 ' + $p + ']');
  exit 1;
}
"`.trim();
}

/**
 * 原生文本搜索治具命令构造器
 */
export function formatGrepSearchCommand(query: string, searchPath: string = '.'): string {
  const cleanPath = searchPath.trim().replace(/^["']|["']$/g, '') || '.';
  const cleanQuery = query.replace(/'/g, "''");
  return `powershell -NoProfile -Command "
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
Select-String -Path '${cleanPath}\\*' -Pattern '${cleanQuery}' -SimpleMatch -ErrorAction SilentlyContinue | Select-Object -First 50 | ForEach-Object { '{0}:{1}: {2}' -f $_.Path, $_.LineNumber, $_.Line.Trim() }
"`.trim();
}
