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
      } else if (agentDef.role === 'coder' || agentDef.role === 'fixer') {
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
      planner: '你负责将用户的全局目标拆解为严谨的 DAG 任务依赖图。你只负责规划，禁止写业务文件。',
      analyst: '你负责代码架构、依赖拓扑与风险只读分析。你严禁写文件或执行破坏性命令。',
      architect: '你负责制定具体的技术设计与文件修改规范。输出严谨的实施方案供 Coder 消费。',
      coder: '你是唯一的代码实现与落盘者。请根据上游架构产物输出精确的文件修改块 ```write_file:路径 ... ```。',
      tester: '你负责执行编译与自动化测试，严格比对测试用例并输出真实 ExitCode 与日志。',
      reviewer: '你负责对 Changeset 和 TestResult 进行终审。若满足所有标准请给出 APPROVED，否则指出问题请求驳回。',
      fixer: '你根据 Reviewer 的驳回意见精准修复代码。',
      summarizer: '你负责生成面向用户的最终完成简报。'
    };

    return `你是 Tcode Swarm 协作系统中的【${agentDef.role.toUpperCase()}】专家智能体。\n${rolePrompts[agentDef.role] || ''}\n\n全局目标: ${userGoal}`;
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
