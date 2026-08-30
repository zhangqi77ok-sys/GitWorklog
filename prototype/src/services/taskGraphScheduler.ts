import {
  SwarmRun,
  SwarmTask,
  TaskGraph,
  AgentDefinition,
  AgentRole
} from '../types/agentRuntimeTypes';
import { TaskGraphValidator } from './swarmScheduler';
import { persistentArtifactStore } from './artifactStore';
import { agentEventStore } from './agentEventStore';
import { multiRoleAgentRunner } from './multiRoleAgentRunner';
import { BUILTIN_AGENT_ROLES, getBuiltinAgentByRole } from './builtinAgents';
import { RuntimeConfigSnapshot } from './runtimeConfigResolver';

export class TaskGraphScheduler {
  private activeRuns: Map<string, { run: SwarmRun; tasks: SwarmTask[]; abortController: AbortController }> = new Map();

  /**
   * Initializes and executes a full Swarm TaskGraph run.
   * Master Planner dynamically analyzes the goal to dispatch required specialized agents.
   */
  public async startSwarmRun(params: {
    sessionId: string;
    userMessageId: string;
    goal: string;
    configSnapshot: RuntimeConfigSnapshot;
    customTasks?: SwarmTask[];
  }): Promise<SwarmRun> {
    const runId = `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const abortController = new AbortController();

    // 1. Master Agent dynamically determines which specialized roles are required
    const initialTasks: SwarmTask[] = params.customTasks || this.planDynamicTaskGraph(runId, params.goal);

    const swarmRun: SwarmRun = {
      id: runId,
      sessionId: params.sessionId,
      userMessageId: params.userMessageId,
      mode: 'swarm',
      status: 'planning',
      taskIds: initialTasks.map(t => t.id),
      agentIds: Array.from(new Set(initialTasks.map(t => `agent-${t.role}`))),
      configSnapshotId: params.configSnapshot.id,
      startedAt: Date.now(),
      updatedAt: Date.now()
    };

    // Validate DAG
    const validation = TaskGraphValidator.validateAcyclic(initialTasks);
    if (!validation.isValid) {
      swarmRun.status = 'failed';
      throw new Error(`Invalid TaskGraph: ${validation.error}`);
    }

    this.activeRuns.set(runId, { run: swarmRun, tasks: initialTasks, abortController });

    agentEventStore.emit({
      sessionId: params.sessionId,
      runId,
      type: 'run.created',
      source: 'system',
      payload: swarmRun
    });

    // Start background execution loop
    this.executeLoop(runId, params.goal, params.configSnapshot).catch(err => {
      console.error('Swarm execution error:', err);
    });

    return swarmRun;
  }

  /**
   * Master Planner Evaluation: Dynamically selects specialized agents based on user goal semantics.
   */
  private planDynamicTaskGraph(runId: string, goal: string): SwarmTask[] {
    const isUIRequired = /界面|UI|交互|样式|CSS|前端|组件|动效|页面|弹窗|导航/i.test(goal);
    const isDBRequired = /数据库|表|SQL|存储|Schema|Migration|字段|模型/i.test(goal);
    const isSecRequired = /安全|权限|防泄露|脱敏|越权|审计|SQL注入|漏洞/i.test(goal);
    const isDocsRequired = /文档|说明|指南|Changelog|手册|README/i.test(goal);
    const isProductHeavy = /产品|需求|PRD|规划|业务用例|旅程|功能定义/i.test(goal);

    const tasks: SwarmTask[] = [];
    const now = Date.now();

    // 1. Planner Step (Master)
    const planTaskId = `task-plan-${now}`;
    tasks.push({
      id: planTaskId,
      runId,
      title: 'Master 需求拆解与 DAG 任务图规划',
      description: `基于目标 "${goal}" 进行全局依赖调度与角色分工`,
      role: 'planner',
      status: 'pending',
      dependsOn: [],
      inputArtifactIds: [],
      outputArtifactIds: [],
      acceptanceIds: ['acc-plan'],
      attempt: 1,
      createdAt: now
    });

    let prevDependencies = [planTaskId];

    // 2. Product Manager (if product/requirement heavy)
    if (isProductHeavy || !isUIRequired) {
      const pmTaskId = `task-pm-${now}`;
      tasks.push({
        id: pmTaskId,
        runId,
        title: '产品需求规格书与业务用例定义 (PM)',
        description: '梳理用户旅程、功能边界与验收清单',
        role: 'product_manager',
        status: 'pending',
        dependsOn: [planTaskId],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-pm'],
        attempt: 1,
        createdAt: now
      });
      prevDependencies = [pmTaskId];
    }

    // 3. UI/UX Designer (if UI involved)
    if (isUIRequired) {
      const uiTaskId = `task-ui-${now}`;
      tasks.push({
        id: uiTaskId,
        runId,
        title: 'UI/UX 交互层级与视觉设计规范 (Designer)',
        description: '设计视觉排版、组件状态机与色彩层级',
        role: 'ui_designer',
        status: 'pending',
        dependsOn: prevDependencies,
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-ui'],
        attempt: 1,
        createdAt: now
      });
      prevDependencies = [uiTaskId];
    }

    // 4. System Architect
    const archTaskId = `task-arch-${now}`;
    tasks.push({
      id: archTaskId,
      runId,
      title: '系统分层架构与模块接口契约 (Architect)',
      description: '定义领域模型、接口契约与具体落地设计',
      role: 'architect',
      status: 'pending',
      dependsOn: prevDependencies,
      inputArtifactIds: [],
      outputArtifactIds: [],
      acceptanceIds: ['acc-arch'],
      attempt: 1,
      createdAt: now
    });

    // 5. DBA Expert (if database involved)
    let devDependencies = [archTaskId];
    if (isDBRequired) {
      const dbaTaskId = `task-dba-${now}`;
      tasks.push({
        id: dbaTaskId,
        runId,
        title: '数据库表结构与持久化模型 (DBA)',
        description: '设计表结构、索引与迁移 Migration 脚本',
        role: 'dba_expert',
        status: 'pending',
        dependsOn: [archTaskId],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-dba'],
        attempt: 1,
        createdAt: now
      });
      devDependencies = [archTaskId, dbaTaskId];
    }

    // 6. Development (Frontend / Backend / Fullstack Coder)
    const codeTaskId = `task-code-${now}`;
    const coderRole: AgentRole = isUIRequired ? 'frontend_dev' : 'backend_dev';
    tasks.push({
      id: codeTaskId,
      runId,
      title: isUIRequired ? '前端组件封装与界面落地 (Frontend)' : '后端服务逻辑与 API 实现 (Backend)',
      description: '获取独占写锁 (WriteLock)，生成真实 Changeset',
      role: coderRole,
      status: 'pending',
      dependsOn: devDependencies,
      inputArtifactIds: [],
      outputArtifactIds: [],
      acceptanceIds: ['acc-code'],
      attempt: 1,
      createdAt: now
    });

    // 7. Security Guard (if security involved)
    let testDependencies = [codeTaskId];
    if (isSecRequired) {
      const secTaskId = `task-sec-${now}`;
      tasks.push({
        id: secTaskId,
        runId,
        title: '安全合规与敏感凭据审计 (Security)',
        description: '审查代码安全性、SQL 注入风险与权限越权',
        role: 'security_guard',
        status: 'pending',
        dependsOn: [codeTaskId],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-sec'],
        attempt: 1,
        createdAt: now
      });
      testDependencies = [codeTaskId, secTaskId];
    }

    // 8. QA Tester
    const testTaskId = `task-test-${now}`;
    tasks.push({
      id: testTaskId,
      runId,
      title: '自动化测试与静态验证 (QA)',
      description: '执行编译与测试用例，捕获真实 ExitCode',
      role: 'tester',
      status: 'pending',
      dependsOn: testDependencies,
      inputArtifactIds: [],
      outputArtifactIds: [],
      acceptanceIds: ['acc-test'],
      attempt: 1,
      createdAt: now
    });

    // 9. Documentation (if docs requested)
    let reviewDependencies = [testTaskId];
    if (isDocsRequired) {
      const docTaskId = `task-doc-${now}`;
      tasks.push({
        id: docTaskId,
        runId,
        title: '技术文档与用户指南编写 (Docs)',
        description: '产出使用手册与变更日志',
        role: 'tech_writer',
        status: 'pending',
        dependsOn: [testTaskId],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-doc'],
        attempt: 1,
        createdAt: now
      });
      reviewDependencies = [testTaskId, docTaskId];
    }

    // 10. Reviewer Arbitration
    const reviewTaskId = `task-review-${now}`;
    tasks.push({
      id: reviewTaskId,
      runId,
      title: '验收与 Review 终审裁决 (Reviewer)',
      description: '综合各专业角色产物做出 APPROVED 或驳回决策',
      role: 'reviewer',
      status: 'pending',
      dependsOn: reviewDependencies,
      inputArtifactIds: [],
      outputArtifactIds: [],
      acceptanceIds: ['acc-review'],
      attempt: 1,
      createdAt: now
    });

    return tasks;
  }

  private async executeLoop(runId: string, goal: string, configSnapshot: RuntimeConfigSnapshot): Promise<void> {
    const runData = this.activeRuns.get(runId);
    if (!runData) return;

    const { run, tasks, abortController } = runData;
    run.status = 'running';

    agentEventStore.emit({
      sessionId: run.sessionId,
      runId,
      type: 'run.started',
      source: 'system',
      payload: run
    });

    while (!abortController.signal.aborted) {
      // Find ready tasks whose dependencies are passed
      const readyTasks = TaskGraphValidator.getReadyTasks(tasks);

      if (readyTasks.length === 0) {
        // Check if all tasks passed
        const allPassed = tasks.every(t => t.status === 'passed');
        const anyFailed = tasks.some(t => t.status === 'failed');

        if (allPassed) {
          run.status = 'completed';
          run.finishedAt = Date.now();
          agentEventStore.emit({
            sessionId: run.sessionId,
            runId,
            type: 'run.completed',
            source: 'system',
            payload: run
          });
          break;
        }

        if (anyFailed) {
          run.status = 'failed';
          run.finishedAt = Date.now();
          agentEventStore.emit({
            sessionId: run.sessionId,
            runId,
            type: 'run.failed',
            source: 'system',
            payload: run
          });
          break;
        }

        // Waiting on asynchronous execution
        await new Promise(r => setTimeout(r, 100));
        continue;
      }

      // Execute all ready tasks concurrently in parallel
      await Promise.all(readyTasks.map(async task => {
        if (abortController.signal.aborted) return;

        task.status = 'running';
        task.startedAt = Date.now();

        agentEventStore.emit({
          sessionId: run.sessionId,
          runId,
          roundId: `round-${task.id}`,
          type: 'task.started',
          source: 'system',
          payload: task
        });

        // Collect input artifacts from dependencies
        const inputArtifacts = task.dependsOn.flatMap(depId =>
          persistentArtifactStore.getArtifactsForTask(depId)
        );

        // Fetch specialized agent definition from builtin roles registry
        const builtinDef = getBuiltinAgentByRole(task.role);
        const agentDef: AgentDefinition = builtinDef || {
          id: `agent-${task.role}`,
          role: task.role,
          name: task.role,
          avatar: '🤖',
          description: task.description,
          category: 'engineering',
          modelId: configSnapshot.modelId || 'opencode/mimo-v2-omni',
          providerId: configSnapshot.providerId || 'provider-opencode',
          systemPrompt: '',
          allowedTools: ['read_file'],
          readScopes: ['*'],
          writeScopes: [],
          maxConcurrency: 2,
          canDelegate: false
        };

        const result = await multiRoleAgentRunner.executeTask({
          runId,
          task,
          agentDef,
          inputArtifacts,
          userGoal: goal,
          contextSnapshotMarkdown: configSnapshot.contextSnapshot.systemPromptText,
          signal: abortController.signal
        });

        if (result.success) {
          task.status = 'passed';
          task.finishedAt = Date.now();
          task.outputArtifactIds = result.outputArtifacts.map(a => a.id);

          agentEventStore.emit({
            sessionId: run.sessionId,
            runId,
            roundId: `round-${task.id}`,
            type: 'task.completed',
            source: 'system',
            payload: task
          });
        } else {
          task.status = 'failed';
          task.finishedAt = Date.now();
          task.error = result.error;

          agentEventStore.emit({
            sessionId: run.sessionId,
            runId,
            roundId: `round-${task.id}`,
            type: 'task.failed',
            source: 'system',
            payload: task
          });
        }
      }));
    }
  }

  public cancelRun(runId: string): void {
    const runData = this.activeRuns.get(runId);
    if (runData) {
      runData.abortController.abort();
      runData.run.status = 'cancelled';
      runData.run.finishedAt = Date.now();
      agentEventStore.emit({
        sessionId: runData.run.sessionId,
        runId,
        type: 'run.cancelled',
        source: 'user',
        payload: runData.run
      });
    }
  }
}

export const taskGraphScheduler = new TaskGraphScheduler();
