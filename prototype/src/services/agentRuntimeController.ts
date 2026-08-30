import {
  AgentRun,
  AgentRound,
  ToolCall,
  ToolResult,
  Changeset,
  ChangedFile,
  ContextSnapshot,
  PermissionRule,
  AcceptanceItem
} from '../types/agentRuntimeTypes';
import { agentEventStore } from './agentEventStore';
import { hostGateway } from './hostGateway';
import { matchesGlob } from './agentLoop';

export interface ExecutionIntent {
  runId: string;
  roundId: string;
  source: 'builtin' | 'mcp' | 'hook';
  toolName: 'write_file' | 'run_command' | string;
  serverName?: string;
  input: Record<string, unknown>;
}

export class AgentRuntimeController {
  /**
   * Request tool execution through permission evaluation
   */
  public async requestToolExecution(
    intent: ExecutionIntent,
    permissionPolicy: 'allow_all' | 'ask_destructive' | 'strict_approval' = 'ask_destructive'
  ): Promise<{ toolCall: ToolCall; requiresApproval: boolean }> {
    const toolCall: ToolCall = {
      id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      runId: intent.runId,
      roundId: intent.roundId,
      source: intent.source,
      toolName: intent.toolName,
      serverName: intent.serverName,
      input: intent.input,
      status: 'requested',
      createdAt: Date.now()
    };

    agentEventStore.emit({
      sessionId: 'default',
      runId: intent.runId,
      roundId: intent.roundId,
      type: 'tool.requested',
      source: intent.source,
      payload: toolCall
    });

    // Check permission rules and policies
    const requiresApproval = this.evaluatePermission(toolCall, permissionPolicy);

    if (requiresApproval) {
      toolCall.status = 'awaiting_approval';
      agentEventStore.emit({
        sessionId: 'default',
        runId: intent.runId,
        roundId: intent.roundId,
        type: 'tool.approval_required',
        source: 'system',
        payload: toolCall
      });
      return { toolCall, requiresApproval: true };
    }

    return { toolCall, requiresApproval: false };
  }

  private evaluatePermission(toolCall: ToolCall, policy: string): boolean {
    const target = (toolCall.input.path || toolCall.input.target || toolCall.input.command || '') as string;
    
    // Check persistent rules
    const rules = agentEventStore.getPermissionRules();
    const matchingRule = rules.find(r => {
      if (r.actionType !== toolCall.toolName && r.actionType !== 'mcp_tool') return false;
      return matchesGlob(target, r.scope);
    });

    if (matchingRule) {
      return matchingRule.decision === 'deny';
    }

    // Strict policy requires approval on all writes and commands
    if (policy === 'strict_approval') return true;

    // Destructive check
    if (toolCall.toolName === 'write_file') {
      return /package\.json|\.env|\.git/i.test(target);
    }
    if (toolCall.toolName === 'run_command') {
      return /git\s+push|git\s+reset|rm\s+-rf|del\s+\/f|format\b/i.test(target);
    }

    return false;
  }

  /**
   * Single unified host execution entry point
   */
  public async executeApprovedTool(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    toolCall.status = 'running';
    agentEventStore.emit({
      sessionId: 'default',
      runId: toolCall.runId,
      roundId: toolCall.roundId,
      type: 'tool.started',
      source: 'system',
      payload: toolCall
    });

    const result: ToolResult = {
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      toolCallId: toolCall.id,
      status: 'succeeded',
      durationMs: 0,
      createdAt: Date.now()
    };

    try {
      if (toolCall.toolName === 'write_file') {
        const filePath = toolCall.input.path as string;
        const content = toolCall.input.content as string;

        // 1. Read existing before content for real diff computation
        const beforeRes = await hostGateway.readFile(filePath);
        const beforeContent = beforeRes.success ? (beforeRes.content || '') : '';
        const isCreated = !beforeRes.success;

        // 2. Perform real write
        const writeRes = await hostGateway.writeFile(filePath, content);
        if (!writeRes.success) {
          throw new Error(writeRes.error || 'Write file failed on host');
        }

        // 3. Form real Changeset
        const additions = content.split('\n').length;
        const deletions = beforeContent ? beforeContent.split('\n').length : 0;
        const changedFile: ChangedFile = {
          path: filePath,
          operation: isCreated ? 'created' : 'modified',
          additions,
          deletions,
          diff: `--- a/${filePath}\n+++ b/${filePath}\n@@ -1,${deletions} +1,${additions} @@\n+${content.slice(0, 100)}...`,
          toolCallId: toolCall.id
        };

        const changeset: Changeset = {
          id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          runId: toolCall.runId,
          roundId: toolCall.roundId,
          status: 'applied',
          files: [changedFile],
          additions,
          deletions,
          createdAt: Date.now()
        };

        agentEventStore.emit({
          sessionId: 'default',
          runId: toolCall.runId,
          roundId: toolCall.roundId,
          type: 'changeset.applied',
          source: 'builtin',
          payload: changeset
        });

        result.affectedFiles = [filePath];
        result.stdout = `Successfully wrote ${content.length} bytes to ${filePath}`;
      } else if (toolCall.toolName === 'run_command') {
        const cmd = (toolCall.input.command || toolCall.input.cmd || '') as string;
        const execRes = await hostGateway.executeCommand(cmd);
        
        result.exitCode = execRes.exitCode ?? (execRes.success ? 0 : 1);
        result.stdout = execRes.stdout || '';
        result.stderr = execRes.stderr || '';
        result.cwd = (execRes as any).cwd || 'prototype';
        
        if (result.exitCode !== 0) {
          result.status = 'failed';
          result.error = result.stderr || `Command exited with code ${result.exitCode}`;
        }
      }

      result.durationMs = Date.now() - startTime;
      agentEventStore.emit({
        sessionId: 'default',
        runId: toolCall.runId,
        roundId: toolCall.roundId,
        type: result.status === 'succeeded' ? 'tool.completed' : 'tool.failed',
        source: 'system',
        payload: result
      });

      return result;
    } catch (err: any) {
      result.status = 'failed';
      result.error = err.message || 'Execution error';
      result.durationMs = Date.now() - startTime;
      agentEventStore.emit({
        sessionId: 'default',
        runId: toolCall.runId,
        roundId: toolCall.roundId,
        type: 'tool.failed',
        source: 'system',
        payload: result
      });
      return result;
    }
  }
}

export const agentRuntimeController = new AgentRuntimeController();
