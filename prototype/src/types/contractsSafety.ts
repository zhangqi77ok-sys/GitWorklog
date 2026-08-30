// Tcode Safety ???? (extracted from contracts.ts)
import type { CommandSafetyResult, RedactionResult, SandboxSafetyCheckResult } from './contractsTypes';

export function maskSensitiveText(text: string): { maskedText: string; mapping: Record<string, string> } {
  const mapping: Record<string, string> = {};
  let counter = 1;

  // Mask API Keys (e.g. sk-xxxx, gsk_xxxx)
  let masked = text.replace(/(sk-[a-zA-Z0-9_-]{16,}|gsk_[a-zA-Z0-9_-]{16,})/g, (match) => {
    const placeholder = `[SEC_API_KEY_${counter++}]`;
    mapping[placeholder] = match;
    return placeholder;
  });

  // Mask Database Passwords (e.g. postgres://user:password@)
  masked = masked.replace(/(:\/\/[a-zA-Z0-9_-]+:)([^@]+)(@)/g, (match, prefix, pass, suffix) => {
    const placeholder = `[SEC_DB_PASS_${counter++}]`;
    mapping[placeholder] = pass;
    return `${prefix}${placeholder}${suffix}`;
  });

  return { maskedText: masked, mapping };
}

export function unmaskSensitiveText(maskedText: string, mapping: Record<string, string>): string {
  let restored = maskedText;
  for (const [placeholder, original] of Object.entries(mapping)) {
    restored = restored.replace(placeholder, original);
  }
  return restored;
}


// ============================================================================
// 13. RESIZABLE LAYOUT CONTRACTS (Split-Pane Widths & Boundaries)
// ============================================================================


export function redactSensitivePii(rawText: string): RedactionResult {
  const secretMap: Record<string, string> = {};
  let count = 0;

  let result = rawText.replace(/(sk-[a-zA-Z0-9_-]{20,})/g, match => {
    count++;
    const key = `<REDACTED_APIKEY_${count}>`;
    secretMap[key] = match;
    return key;
  });

  result = result.replace(/(ghp_[a-zA-Z0-9]{30,})/g, match => {
    count++;
    const key = `<REDACTED_GHTOKEN_${count}>`;
    secretMap[key] = match;
    return key;
  });

  result = result.replace(/(postgres:\/\/[^:]+:)([^@]+)(@)/g, (_match, prefix, pass, suffix) => {
    count++;
    const key = `<REDACTED_DBPASS_${count}>`;
    secretMap[key] = pass;
    return `${prefix}${key}${suffix}`;
  });

  return {
    redactedText: result,
    redactedSecretsCount: count,
    secretMap
  };
}

export function unredactSensitivePii(redactedText: string, secretMap: Record<string, string>): string {
  let restored = redactedText;
  for (const [placeholder, original] of Object.entries(secretMap)) {
    restored = restored.split(placeholder).join(original);
  }
  return restored;
}


// ============================================================================
// 22. STAGE 4: SANDBOX GUARD, SHADOW SNAPSHOT & MENTION ENGINE CONTRACTS
// ============================================================================


export function evaluateCommandSafety(command: string): CommandSafetyResult {
  const cmd = command.trim().toLowerCase();

  const blockedPatterns = [
    { pattern: /rm\s+-rf\s+[/*]/, reason: '危险的根路径全量递归删除' },
    { pattern: /drop\s+(database|table|schema)/i, reason: '不可逆的数据库或表结构销毁' },
    { pattern: /format\s+[a-z]:/i, reason: '磁盘驱动器格式化指令' },
    { pattern: /git\s+push\s+.*--force.*main/, reason: '强推覆盖生产主分支' }
  ];

  const warningPatterns = [
    { pattern: /npm\s+install\s+-g/, reason: '全局系统级依赖安装' },
    { pattern: /docker\s+run\s+.*--privileged/, reason: '特权容器执行' },
    { pattern: /chmod\s+(-r\s+)?777/, reason: '开放全部文件执行与读写权限' }
  ];

  for (const b of blockedPatterns) {
    if (b.pattern.test(cmd)) {
      return { level: 'blocked', reason: b.reason, command };
    }
  }

  for (const w of warningPatterns) {
    if (w.pattern.test(cmd)) {
      return { level: 'warning', reason: w.reason, command };
    }
  }

  return { level: 'safe', command };
}

// 3. Multi-Agent Swarm Mode

export function evaluateSandboxCommandSafety(command: string): SandboxSafetyCheckResult {
  const lower = command.toLowerCase().trim();
  const dangerousPatterns = [
    { pattern: 'rm -rf /', reason: '检测到根目录递归删除指令' },
    { pattern: 'rm -rf *', reason: '检测到通配符无差别删除指令' },
    { pattern: 'drop database', reason: '检测到数据库销毁指令' },
    { pattern: 'drop table', reason: '检测到数据表删除指令' },
    { pattern: 'format c:', reason: '检测到磁盘格式化指令' },
    { pattern: 'mkfs', reason: '检测到文件系统重置指令' }
  ];

  for (const { pattern, reason } of dangerousPatterns) {
    if (lower.includes(pattern)) {
      return {
        isSafe: false,
        command,
        hazardReason: reason,
        requiresSudo: true
      };
    }
  }

  return {
    isSafe: true,
    command,
    requiresSudo: false
  };
}

