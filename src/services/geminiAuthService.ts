import { GeminiAuthCredentials } from "../types";

// Cockpit Tools 与开源生态兼容的 Google OAuth 默认凭据客户端
export const COCKPIT_GOOGLE_CLIENT_ID =
  "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com";
export const COCKPIT_GOOGLE_CLIENT_SECRET = "d-FL95Q19q7MQmFpd7hHD0Ty";

export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export interface RefreshResult {
  ok: boolean;
  accessToken?: string;
  expiresAt?: number;
  email?: string;
  error?: string;
  latencyMs?: number;
}

class GeminiAuthService {
  /**
   * 使用 Refresh Token (RT) 向 Google OAuth 端点换取最新的 Access Token
   */
  public async refreshAccessToken(credentials: GeminiAuthCredentials): Promise<RefreshResult> {
    const startTime = performance.now();
    if (!credentials.refreshToken?.trim()) {
      return { ok: false, error: "Refresh Token (RT) 不能为空！" };
    }

    const clientId = credentials.clientId?.trim() || COCKPIT_GOOGLE_CLIENT_ID;
    const clientSecret = credentials.clientSecret?.trim() || COCKPIT_GOOGLE_CLIENT_SECRET;
    const rt = credentials.refreshToken.trim();

    try {
      const params = new URLSearchParams();
      params.append("client_id", clientId);
      params.append("client_secret", clientSecret);
      params.append("refresh_token", rt);
      params.append("grant_type", "refresh_token");

      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg =
          errJson.error_description ||
          errJson.error ||
          `Google OAuth 刷新失败 (HTTP ${response.status})`;
        return { ok: false, error: errMsg, latencyMs };
      }

      const data = await response.json();
      const accessToken = data.access_token;
      const expiresIn = data.expires_in || 3600; // 默认 1 小时
      const expiresAt = Date.now() + expiresIn * 1000;

      // 尝试获取绑定的 Google 账号信息
      let email = credentials.accountEmail;
      try {
        const userRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.email) email = userData.email;
        }
      } catch (e) {
        console.warn("Could not fetch userinfo, using cached email:", e);
      }

      return {
        ok: true,
        accessToken,
        expiresAt,
        email: email || "google_account@authorized",
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        ok: false,
        error: err.message || "连接 Google OAuth 服务器超时或网络异常",
        latencyMs,
      };
    }
  }

  /**
   * 解析 Google 凭据 JSON 文件 (支持 application_default_credentials / client_secret / Cockpit 格式)
   */
  public parseCredentialsJson(jsonStr: string): Partial<GeminiAuthCredentials> | null {
    try {
      const data = JSON.parse(jsonStr);

      // 1. gcloud 授权格式 (authorized_user)
      if (data.type === "authorized_user" && data.refresh_token) {
        return {
          mode: "oauth_rt",
          refreshToken: data.refresh_token,
          clientId: data.client_id || COCKPIT_GOOGLE_CLIENT_ID,
          clientSecret: data.client_secret || COCKPIT_GOOGLE_CLIENT_SECRET,
          projectId: data.quota_project_id || data.project_id,
        };
      }

      // 2. Google OAuth 客户端凭据 (installed / web)
      const installed = data.installed || data.web;
      if (installed && installed.client_id) {
        return {
          mode: "oauth_rt",
          clientId: installed.client_id,
          clientSecret: installed.client_secret,
          projectId: installed.project_id,
          refreshToken: data.refresh_token || "",
        };
      }

      // 3. 直接包含 refreshToken 或 apiKey 的扁平对象
      if (data.refresh_token || data.refreshToken) {
        return {
          mode: "oauth_rt",
          refreshToken: data.refresh_token || data.refreshToken,
          clientId: data.client_id || data.clientId || COCKPIT_GOOGLE_CLIENT_ID,
          clientSecret: data.client_secret || data.clientSecret || COCKPIT_GOOGLE_CLIENT_SECRET,
          accountEmail: data.email || data.accountEmail,
        };
      }

      if (data.apiKey || data.api_key) {
        return {
          mode: "apikey",
          apiKey: data.apiKey || data.api_key,
        };
      }
    } catch (e) {
      console.error("Failed to parse Google credentials JSON:", e);
    }
    return null;
  }

  /**
   * 生成 Google OAuth 2.0 授权 URL
   */
  public buildGoogleOAuthUrl(customClientId?: string): string {
    const clientId = customClientId?.trim() || COCKPIT_GOOGLE_CLIENT_ID;
    const redirectUri = "http://localhost:8085/oauth/callback";
    const scopes = [
      "https://www.googleapis.com/auth/generative-language",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ].join(" ");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    return url.toString();
  }
}

export const geminiAuthService = new GeminiAuthService();
