/**
 * OpenCode 引擎集成服务
 * 提供 OpenCode 本地/远程服务探测、默认端口配置、模型列表与安装向导
 */

export const OPENCODE_DEFAULT_PORT = 4096;
export const OPENCODE_DEFAULT_BASE_URL = "http://127.0.0.1:4096/v1";
export const OPENCODE_DOWNLOAD_URL = "https://opencode.ai";
export const OPENCODE_GITHUB_URL = "https://github.com/anomalyco/opencode";
export const OPENCODE_INSTALL_COMMAND = "npm install -g opencode-ai";

export interface OpenCodeDetectionResult {
  running: boolean;
  port: number;
  latencyMs?: number;
  message: string;
  models?: string[];
}

/**
 * 探测本地 OpenCode 服务是否启动 (默认端口 4096)
 */
export async function detectOpenCodeLocalServer(port: number = OPENCODE_DEFAULT_PORT): Promise<OpenCodeDetectionResult> {
  const start = Date.now();
  const endpoints = [
    `http://127.0.0.1:${port}/v1/models`,
    `http://localhost:${port}/v1/models`,
    `http://127.0.0.1:${port}/health`,
    `http://127.0.0.1:${port}/`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const resp = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;
      if (resp.ok || resp.status === 200 || resp.status === 401 || resp.status === 404) {
        let models: string[] = [];
        try {
          const json = await resp.json();
          if (json?.data && Array.isArray(json.data)) {
            models = json.data.map((m: any) => m.id || m.name).filter(Boolean);
          }
        } catch {}

        return {
          running: true,
          port,
          latencyMs,
          models: models.length > 0 ? models : undefined,
          message: `OpenCode 本地引擎运行中 (端口 ${port}, 延迟 ${latencyMs}ms)`,
        };
      }
    } catch {
      // 尝试下一个端点
    }
  }

  return {
    running: false,
    port,
    message: `未在本地端口 ${port} 检测到运行中的 OpenCode 服务`,
  };
}

/**
 * 判断是否属于 OpenCode 端点
 */
export function isOpenCodeBaseUrl(url: string): boolean {
  if (!url) return false;
  return url.includes(':4096') || url.includes('opencode.ai') || url.toLowerCase().includes('opencode');
}
