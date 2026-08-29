import { IProviderSubline, SublineHealthResult, SublineModelSyncResult, BusStreamRequest, BusStreamCallbacks } from './types';
import { OpenCodeSubline } from './sublines/OpenCodeSubline';
import { CodexSubline } from './sublines/CodexSubline';
import { ClaudeSubline } from './sublines/ClaudeSubline';
import { DashScopeSubline } from './sublines/DashScopeSubline';
import { McpSubline } from './sublines/McpSubline';
import { SkillSubline } from './sublines/SkillSubline';
import { AuditLogSubline } from './sublines/AuditLogSubline';

export class GatewayBus {
  private static instance: GatewayBus | null = null;
  private sublines: Map<string, IProviderSubline> = new Map();
  private activeSublineId: string = 'subline-opencode';

  private mcpSubline: McpSubline;
  private skillSubline: SkillSubline;
  private auditSubline: AuditLogSubline;

  private constructor() {
    // 注册 4 大核心独立引擎子线 (彻底移除 Antigravity)
    this.registerSubline(new OpenCodeSubline());
    this.registerSubline(new CodexSubline());
    this.registerSubline(new ClaudeSubline());
    this.registerSubline(new DashScopeSubline());

    // 注册能力扩展子线与系统日志审计
    this.mcpSubline = new McpSubline();
    this.skillSubline = new SkillSubline();
    this.auditSubline = new AuditLogSubline();
  }

  static getInstance(): GatewayBus {
    if (!GatewayBus.instance) {
      GatewayBus.instance = new GatewayBus();
    }
    return GatewayBus.instance;
  }

  registerSubline(subline: IProviderSubline): void {
    this.sublines.set(subline.id, subline);
  }

  getSubline(id: string): IProviderSubline | undefined {
    return this.sublines.get(id);
  }

  getAllSublines(): IProviderSubline[] {
    return Array.from(this.sublines.values());
  }

  getActiveSubline(): IProviderSubline {
    const subline = this.sublines.get(this.activeSublineId);
    if (!subline) {
      const fallback = this.sublines.get('subline-opencode') || Array.from(this.sublines.values())[0];
      return fallback;
    }
    return subline;
  }

  setActiveSubline(id: string): boolean {
    if (this.sublines.has(id)) {
      this.activeSublineId = id;
      return true;
    }
    return false;
  }

  getActiveSublineId(): string {
    return this.activeSublineId;
  }

  getMcpSubline(): McpSubline {
    return this.mcpSubline;
  }

  getSkillSubline(): SkillSubline {
    return this.skillSubline;
  }

  getAuditSubline(): AuditLogSubline {
    return this.auditSubline;
  }

  async probeSublineHealth(sublineId?: string): Promise<SublineHealthResult> {
    const target = sublineId ? this.sublines.get(sublineId) : this.getActiveSubline();
    if (!target) {
      return {
        ok: false,
        latencyMs: 0,
        endpointUrl: '',
        message: `未知子线 ID: ${sublineId}`,
      };
    }
    return target.probeHealth();
  }

  async syncSublineModels(sublineId?: string): Promise<SublineModelSyncResult> {
    const target = sublineId ? this.sublines.get(sublineId) : this.getActiveSubline();
    if (!target) {
      return {
        ok: false,
        models: [],
        modelMetas: [],
        count: 0,
        source: 'official_api',
        error: `未知子线 ID: ${sublineId}`,
      };
    }
    return target.fetchOfficialModels();
  }

  async dispatchStream(
    request: BusStreamRequest,
    callbacks: BusStreamCallbacks
  ): Promise<void> {
    const subline = this.getActiveSubline();
    const startTime = performance.now();

    const wrappedCallbacks: BusStreamCallbacks = {
      onChunk: callbacks.onChunk,
      onThinkingChunk: callbacks.onThinkingChunk,
      onComplete: (meta) => {
        // 记录系统审计日志
        this.auditSubline.recordLog({
          engineId: subline.id,
          relayType: (subline.getConfig() as any)?.relay?.type || 'direct',
          model: request.model,
          durationMs: meta.durationMs,
          tokensCount: meta.tokensCount,
          tokensPerSec: meta.tokensPerSec,
          statusCode: 200,
          status: 'success',
          promptSnippet: request.messages[request.messages.length - 1]?.content.slice(0, 80),
        });
        callbacks.onComplete(meta);
      },
      onError: (err, statusCode) => {
        const durationMs = Math.round(performance.now() - startTime);
        this.auditSubline.recordLog({
          engineId: subline.id,
          relayType: (subline.getConfig() as any)?.relay?.type || 'direct',
          model: request.model,
          durationMs,
          tokensCount: 0,
          tokensPerSec: 0,
          statusCode: statusCode || 500,
          status: 'error',
          errorMessage: err,
          promptSnippet: request.messages[request.messages.length - 1]?.content.slice(0, 80),
        });
        callbacks.onError(err, statusCode);
      },
    };

    return subline.executeStream(request, wrappedCallbacks);
  }
}

export const gatewayBus = GatewayBus.getInstance();
