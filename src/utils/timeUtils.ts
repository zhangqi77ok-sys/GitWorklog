/**
 * CodeMind 统一高精度时间格式化工具库
 */

/**
 * 格式化会话时间（左侧栏）：今天显示 HH:mm，昨天显示 昨天 HH:mm，今年显示 MM-DD HH:mm，跨年显示 YYYY-MM-DD
 */
export function formatSessionTime(ts?: number | string | null, fallbackTime?: string): string {
  const numTs = parseTimestamp(ts);
  if (!numTs) {
    // 若无法解析时间戳，尝试解析 fallback 字符串，若仍是旧的'刚刚'则回退为当前时间或空
    if (fallbackTime && fallbackTime !== "刚刚") return fallbackTime;
    return "";
  }

  const d = new Date(numTs);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isToday) {
    return hm;
  }
  if (isYesterday) {
    return `昨天 ${hm}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 格式化消息产生时间（右侧聊天卡片）：今天显示 HH:mm:ss，跨天显示 MM-DD HH:mm:ss
 */
export function formatMessageTime(ts?: number | string | null): string {
  const numTs = parseTimestamp(ts);
  if (!numTs) return "";

  const d = new Date(numTs);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return hms;
  }
  if (d.getFullYear() === now.getFullYear()) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hms}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hms}`;
}

/**
 * 格式化完整年月日时分秒（用于 Tooltip 悬停显示）
 */
export function formatFullDateTime(ts?: number | string | null): string {
  const numTs = parseTimestamp(ts);
  if (!numTs) return "";
  const d = new Date(numTs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseTimestamp(ts?: number | string | null): number | null {
  if (!ts) return null;
  if (typeof ts === "number") {
    if (isNaN(ts) || ts <= 0) return null;
    return ts;
  }
  if (typeof ts === "string") {
    const num = Number(ts);
    if (!isNaN(num) && num > 0) return num;
    const parsed = Date.parse(ts);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return null;
}
