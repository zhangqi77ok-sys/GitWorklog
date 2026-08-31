/**
 * LSP & Compiler Diagnostics Engine (Self-Healing Loop)
 * Captures immediate compilation, typecheck, and syntax errors right after write_file,
 * and serializes them into high-priority feedback for the Agent's self-healing loop.
 */

export interface DiagnosticError {
  filePath: string;
  line: number;
  column: number;
  code: string;
  message: string;
  source: 'tsc' | 'py_compile' | 'ruff' | 'cargo' | 'go' | 'custom';
}

export interface DiagnosticReport {
  success: boolean;
  hasErrors: boolean;
  errors: DiagnosticError[];
}

/**
 * Calls desktop backend to run immediate file/project diagnostics
 */
export async function runFileDiagnostics(
  filePath: string,
  workspacePath: string = '.'
): Promise<DiagnosticReport> {
  try {
    const res = await fetch('/api/diagnostics/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, workspacePath })
    });

    if (!res.ok) {
      return { success: false, hasErrors: false, errors: [] };
    }

    const data = await res.json();
    return {
      success: !!data.success,
      hasErrors: !!data.hasErrors,
      errors: Array.isArray(data.errors) ? data.errors : []
    };
  } catch {
    return { success: false, hasErrors: false, errors: [] };
  }
}

/**
 * Serializes compiler diagnostic errors into high-priority prompt feedback
 */
export function formatDiagnosticFeedback(errors: DiagnosticError[]): string {
  if (!errors || errors.length === 0) return '';

  const lines = [
    '【⚡ 编译器实时诊断反馈 (LSP Compiler Diagnostics)】',
    `检测到 ${errors.length} 处语法或类型错误，请在运行测试前立即优先修复：`
  ];

  errors.forEach((err, idx) => {
    lines.push(
      `${idx + 1}. 文件: ${err.filePath} (行 ${err.line}, 列 ${err.column})\n` +
      `   [${err.source.toUpperCase()} ${err.code}] ${err.message}`
    );
  });

  lines.push('', '🚨 铁律约束：严禁忽视上述编译器报错，请生成修复补丁 (write_file) 消除全部红线。');
  return lines.join('\n');
}
