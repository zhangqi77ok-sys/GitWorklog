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
import { RuntimeConfigSnapshot } from './runtimeConfigResolver';

export class TaskGraphScheduler {
  private activeRuns: Map<string, { run: SwarmRun; tasks: SwarmTask[]; abortController: AbortController }> = new Map();

  /**
   * Initializes and executes a full Swarm TaskGraph run
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

    const swarmRun: SwarmRun = {
      id: runId,
      sessionId: params.sessionId,
      userMessageId: params.userMessageId,
      mode: 'swarm',
      status: 'planning',
      taskIds: [],
      agentIds: ['agent-planner', 'agent-analyst', 'agent-architect', 'agent-coder', 'agent-tester', 'agent-reviewer'],
      configSnapshotId: params.configSnapshot.id,
      startedAt: Date.now(),
      updatedAt: Date.now()
    };

    // 1. Define standard DAG tasks if not provided
    const initialTasks: SwarmTask[] = params.customTasks || [
      {
        id: `task-plan-${Date.now()}`,
        runId,
        title: '需求拆解与 DAG 任务图规划',
        description: `基于目标 "${params.goal}" 规划任务依赖图`,
        role: 'planner',
        status: 'pending',
        dependsOn: [],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-plan'],
        attempt: 1,
        createdAt: Date.now()
      },
      {
        id: `task-analyze-${Date.now()}`,
        runId,
        title: '依赖拓扑与风险只读分析',
        description: '扫描代码工程依赖与风险点',
        role: 'analyst',
        status: 'pending',
        dependsOn: [`task-plan-${Date.now()}`],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-analyze'],
        attempt: 1,
        createdAt: Date.now()
      },
      {
        id: `task-architect-${Date.now()}`,
        runId,
        title: '架构设计与实施规范',
        description: '生成具体文件修改方案与顺序',
        role: 'architect',
        status: 'pending',
        dependsOn: [`task-analyze-${Date.now()}`],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-arch'],
        attempt: 1,
        createdAt: Date.now()
      },
      {
        id: `task-code-${Date.now()}`,
        runId,
        title: '核心代码实现与落盘',
        description: '执行文件写入并生成真实 Changeset',
        role: 'coder',
        status: 'pending',
        dependsOn: [`task-architect-${Date.now()}`],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-code'],
        attempt: 1,
        createdAt: Date.now()
      },
      {
        id: `task-test-${Date.now()}`,
        runId,
        title: '自动化测试与静态验证',
        description: '运行单测并捕获真实 exitCode',
        role: 'tester',
        status: 'pending',
        dependsOn: [`task-code-${Date.now()}`],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-test'],
        attempt: 1,
        createdAt: Date.now()
      },
      {
        id: `task-review-${Date.now()}`,
        runId,
        title: '验收与 Review 终审裁决',
        description: '比对验收标准与测试报告做出批准或驳回',
        role: 'reviewer',
        status: 'pending',
        dependsOn: [`task-test-${Date.now()}`],
        inputArtifactIds: [],
        outputArtifactIds: [],
        acceptanceIds: ['acc-review'],
        attempt: 1,
        createdAt: Date.now()
      }
    ];

    swarmRun.taskIds = initialTasks.map(t => t.id);

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

      // Execute ready tasks (read-only tasks execute concurrently, write tasks synchronously)
      for (const task of readyTasks) {
        if (abortController.signal.aborted) break;

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

        const agentDef: AgentDefinition = {
          id: `agent-${task.role}`,
          role: task.role,
          modelId: configSnapshot.modelId || 'opencode/mimo-v2-omni',
          providerId: configSnapshot.providerId || 'provider-opencode',
          systemPrompt: '',
          allowedTools: task.role === 'coder' ? ['write_file'] : task.role === 'tester' ? ['run_command'] : ['read_file'],
          readScopes: ['*'],
          writeScopes: task.role === 'coder' ? ['src/**'] : [],
          maxConcurrency: 3,
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
      }
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
