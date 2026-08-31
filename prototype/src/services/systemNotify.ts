/**
 * Task A2: 系统级通知前端触发助手。
 *
 * 双通道策略：
 * - 窗口聚焦（visibilityState != hidden）：应用内 280x120 Toast（既有实现，不走宿主）；
 * - 窗口后台/最小化（visibilityState === hidden）且运行于桌面宿主：
 *   POST /api/notify/system 由宿主弹出 Windows 原生右下角通知。
 * 失败策略：显式 console.error 记录并返回 false，禁止静默吞错。
 */

export interface SystemNotifyPayload {
  status: 'success' | 'error';
  projectName?: string;
  sessionTitle?: string;
  sessionId: string;
  summary?: string;
}

/** 是否运行于桌面宿主（PyWebView 启动时注入 __TCODE_HOST_TOKEN__）。 */
export const isDesktopHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { __TCODE_HOST_TOKEN__?: string }).__TCODE_HOST_TOKEN__);
};

/** 窗口是否处于后台（最小化/切走/被遮挡）。 */
export const isWindowHidden = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'hidden';
};

/**
 * 请求宿主弹出系统级通知；仅当满足「桌面宿主 + 窗口后台」时真正发起请求。
 * 返回是否成功触发（浏览器 dev 环境、窗口聚焦、宿主失败均返回 false）。
 */
export async function requestSystemNotification(payload: SystemNotifyPayload): Promise<boolean> {
  if (!isDesktopHost()) return false;
  if (!isWindowHidden()) return false;
  try {
    const res = await fetch('/api/notify/system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[SystemNotify] 宿主通知失败: HTTP ${res.status}`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SystemNotify] 宿主通知请求异常', err);
    return false;
  }
}
