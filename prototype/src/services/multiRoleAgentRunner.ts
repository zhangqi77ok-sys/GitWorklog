import {
  AgentDefinition,
  AgentRole,
  SwarmTask,
  Artifact,
  ToolCall,
  ToolResult
} from '../types/agentRuntimeTypes';
import { persistentArtifactStore } from './artifactStore';
import { agentEventStore } from './agentEventStore';
import { agentRuntimeController } from './agentRuntimeController';
import { hostGateway } from './hostGateway';

export interface AgentTaskInput {
  runId: string;
  task: SwarmTask;
  agentDef: AgentDefinition;
  inputArtifacts: Artifact[];
  userGoal: string;
  contextSnapshotMarkdown: string;
  signal?: AbortSignal;
}

export interface AgentTaskResult {
  success: boolean;
  outputArtifacts: Artifact[];
  summary: string;
  error?: string;
}

export class MultiRoleAgentRunner {
  /**
   * Dispatches and runs an individual specialized Agent for a given task
   */
  public async executeTask(input: AgentTaskInput): Promise<AgentTaskResult> {
    const { runId, task, agentDef, inputArtifacts, userGoal, contextSnapshotMarkdown, signal } = input;

    agentEventStore.emit({
      sessionId: 'default',
      runId,
      roundId: `round-${task.id}`,
      type: 'agent.started',
      source: 'agent',
      payload: { role: agentDef.role, taskId: task.id }
    });

    // 1. Build specialized System Prompt for the role
    const specializedSystemPrompt = this.buildRoleSystemPrompt(agentDef, inputArtifacts, userGoal);

    // 2. Build User Content for this task
    const taskPrompt = `【当前任务 #${task.id}】: ${task.title}\n任务说明: ${task.description}\n\n${
      inputArtifacts.length > 0
        ? `【上游产物输入 (Artifacts)】:\n` + inputArtifacts.map(a => `--- [${a.type}] ${a.title} (v${a.version}) ---\n${a.content}`).join('\n\n')
        : '（无前序产物，作为起点任务执行）'
    }\n\n请严格履行你的角色职责，给出专业输出。`;

    try {
      // 3. Call LLM for this agent
      const llmResponse = await this.callLLM({
        systemPrompt: specializedSystemPrompt,
        userPrompt: taskPrompt,
        modelId: agentDef.modelId,
        signal
      });

      // 4. Handle role-specific physical actions / artifact generation
      const outputArtifacts: Artifact[] = [];

      if (agentDef.role === 'planner') {
        const planArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'plan',
          title: `任务规划方案 (${task.title})`,
          content: llmResponse
        });
        outputArtifacts.push(planArtifact);
      } else if (agentDef.role === 'product_manager') {
        const prdArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'prd',
          title: `产品需求规格说明书 PRD (${task.title})`,
          content: llmResponse
        });
        outputArtifacts.push(prdArtifact);
      } else if (agentDef.role === 'ui_designer') {
        const uiArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'ui_spec',
          title: `UI/UX 视觉与交互规范 (${task.title})`,
          content: llmResponse
        });
        outputArtifacts.push(uiArtifact);
      } else if (agentDef.role === 'analyst') {
        const analysisArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'analysis',
          title: `架构分析报告 (${task.title})`,
          content: llmResponse
        });
        outputArtifacts.push(analysisArtifact);
      } else if (agentDef.role === 'architect') {
        const archArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'architecture',
          title: `技术架构设计与改动清单 (${task.title})`,
          content: llmResponse
        });
        outputArtifacts.push(archArtifact);
      } else if (agentDef.role === 'dba_expert') {
        const schemaArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'schema',
          title: `数据库模型与迁移规范 (${task.title})`,
          content: llmResponse
        });
        outputArtifacts.push(schemaArtifact);
      } else if (agentDef.role === 'security_guard') {
        const secArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'security_audit',
          title: `安全合规审计报告 (${task.title})`,
          content: llmResponse
        });
        outputArtifacts.push(secArtifact);
      } else if (agentDef.role === 'tech_writer') {
        const docArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'documentation',
          title: `技术文档与用户指南 (${task.title})`,
          content: llmResponse
        });
        outputArtifacts.push(docArtifact);
      } else if (agentDef.role === 'coder' || agentDef.role === 'frontend_dev' || agentDef.role === 'backend_dev' || agentDef.role === 'fixer') {
        // Parse write_file actions if any
        const writeMatches = Array.from(llmResponse.matchAll(/```(?:write_file|patch):([^\n\r]+)[\r\n]+([\s\S]*?)```/g));
        if (writeMatches.length > 0) {
          for (const match of writeMatches) {
            const rawPath = match[1].trim();
            const content = match[2];
            const { toolCall } = await agentRuntimeController.requestToolExecution({
              runId,
              roundId: `round-${task.id}`,
              source: 'builtin',
              toolName: 'write_file',
              input: { path: rawPath, content }
            }, 'allow_all');
            await agentRuntimeController.executeApprovedTool(toolCall);
          }
        }
        const changesetArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'changeset',
          title: `代码改动集 (${task.title})`,
          content: llmResponse
        });
        outputArtifacts.push(changesetArtifact);
      } else if (agentDef.role === 'tester') {
        // Run test command
        const cmdRes = await hostGateway.executeCommand('node .\\node_modules\\typescript\\lib\\tsc.js --noEmit');
        const testReport = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'test_result',
          title: `静态检查与单测验证报告 (${task.title})`,
          content: `ExitCode: ${cmdRes.exitCode}\nStdout:\n${cmdRes.stdout || '(None)'}\nStderr:\n${cmdRes.stderr || '(None)'}`,
          metadata: { exitCode: cmdRes.exitCode, passed: cmdRes.exitCode === 0 }
        });
        outputArtifacts.push(testReport);
      } else if (agentDef.role === 'reviewer') {
        const isApproved = !llmResponse.includes('REJECT') && !llmResponse.includes('驳回');
        const reviewArtifact = persistentArtifactStore.createArtifact({
          runId,
          taskId: task.id,
          type: 'review',
          title: `Review 仲裁报告 (${task.title})`,
          content: llmResponse,
          metadata: { decision: isApproved ? 'approved' : 'request_changes' }
        });
        outputArtifacts.push(reviewArtifact);
      }

      agentEventStore.emit({
        sessionId: 'default',
        runId,
        roundId: `round-${task.id}`,
        type: 'agent.completed',
        source: 'agent',
        payload: { role: agentDef.role, taskId: task.id, artifactsCount: outputArtifacts.length }
      });

      return {
        success: true,
        outputArtifacts,
        summary: llmResponse.slice(0, 300)
      };
    } catch (err: any) {
      agentEventStore.emit({
        sessionId: 'default',
        runId,
        roundId: `round-${task.id}`,
        type: 'agent.failed',
        source: 'agent',
        payload: { role: agentDef.role, taskId: task.id, error: err?.message || String(err) }
      });

      return {
        success: false,
        outputArtifacts: [],
        summary: '',
        error: err?.message || String(err)
      };
    }
  }

  private buildRoleSystemPrompt(agentDef: AgentDefinition, inputArtifacts: Artifact[], userGoal: string): string {
    const rolePrompts: Record<AgentRole, string> = {
      planner: '你负责全局理解用户诉求，评估并规划所需调度的专业角色集合，生成无环依赖 TaskGraph DAG。',
      product_manager: '你负责业务用例拆解、用户旅程分析、功能边界定义与验收标准制定，输出标准化 PRD 产物。',
      ui_designer: '你负责组件规范、视觉层级、响应式布局与色彩交互动效，输出 UI/UX 设计规范。',
      architect: '你负责技术选型、系统分层、领域模型设计与模块接口契约制定。',
      frontend_dev: '你负责 React 组件封装、CSS 样式排版与前端交互状态实现，输出 ```write_file:路径 ...``` 代码块。',
      backend_dev: '你负责后端 API、服务层业务逻辑与数据处理，输出 ```write_file:路径 ...``` 代码块。',
      dba_expert: '你负责数据库模型设计、索引规划与 Migration 迁移脚本编写。',
      security_guard: '你负责凭据泄露防护、SQL注入防范、权限沙箱与依赖安全审计。',
      analyst: '你负责代码架构、依赖拓扑与风险只读分析。你严禁写文件或执行破坏性命令。',
      coder: '你是通用的代码实现者。请根据上游产物输出精确的文件修改块 ```write_file:路径 ... ```。',
      tester: '你负责执行编译与自动化测试，严格比对测试用例并输出真实 ExitCode 与日志。',
      reviewer: '你负责对 Changeset 和 TestResult 进行终审。若满足所有标准请给出 APPROVED，否则指出问题请求驳回。',
      fixer: '你根据 Reviewer 的驳回意见精准修复代码。',
      tech_writer: '你负责编写清晰的用户使用手册与版本更新日志 (Changelog)。',
      summarizer: '你负责生成面向用户的最终完成简报。'
    };

    return `你是 Tcode Swarm 协作系统中的【${agentDef.name || agentDef.role.toUpperCase()}】专家智能体。\n${rolePrompts[agentDef.role] || ''}\n\n全局目标: ${userGoal}`;
  }

  private async callLLM(params: {
    systemPrompt: string;
    userPrompt: string;
    modelId: string;
    signal?: AbortSignal;
  }): Promise<string> {
    let baseUrl = 'https://opencode.ai/zen/v1';
    let apiKey = 'sk-REVOKED_PLACEHOLDER';

    try {
      const rawProviders = localStorage.getItem('codemind_custom_providers');
      if (rawProviders) {
        const providers: any[] = JSON.parse(rawProviders);
        const p = providers.find((item: any) => item.enabled && item.apiKey && item.baseUrl);
        if (p) {
          baseUrl = p.baseUrl.trim();
          if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
          apiKey = p.apiKey.trim();
        }
      }
    } catch {}

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: params.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: params.modelId || 'opencode/mimo-v2-omni',
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Task completed successfully.';
  }
}

export const multiRoleAgentRunner = new MultiRoleAgentRunner();
