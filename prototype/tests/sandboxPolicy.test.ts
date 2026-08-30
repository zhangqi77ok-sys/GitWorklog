import { describe, it, expect } from 'vitest';
import { resolveAllowedTools, filterToolDefs } from '../src/services/agentLoop';

describe('hard tool sandbox - protocol layer', () => {
  it('resolveAllowedTools prefers workflow block whitelist', () => {
    expect(resolveAllowedTools({ allowedTools: ['read_file'] }, 'act')).toEqual(['read_file']);
    expect(resolveAllowedTools(undefined, 'plan')).toEqual(['read_file', 'grep_search', 'find_by_name']);
    expect(resolveAllowedTools(undefined, 'act')).toContain('write_file');
  });

  it('filterToolDefs trims tools array to whitelist', () => {
    const tools = [
      { name: 'read_file' },
      { name: 'write_file' },
      { name: 'run_command' }
    ];
    const kept = filterToolDefs(tools, ['read_file', 'run_command']);
    expect(kept.map(t => t.name)).toEqual(['read_file', 'run_command']);
  });
});

import { executeSandboxAction } from '../src/services/agentLoop';
import type { ActionResult } from '../src/types/contracts';
import type { AgentAction } from '../src/services/agentLoop';

describe('hard tool sandbox - runtime enforcement', () => {
  const host = async (): Promise<ActionResult> => ({ status: 'success' } as ActionResult);

  it('rejects out-of-scope tool with structured 403 without throwing', async () => {
    const action = { id: 'a1', type: 'write_file', target: 'x.ts' } as unknown as AgentAction;
    const res = await executeSandboxAction(action, ['read_file'], host);
    expect(res.status).toBe('rejected');
    expect(res.error).toBe('PERMISSION_RESTRICTED');
    expect(String(res.output)).toContain('403');
    expect(String(res.output)).toContain('write_file');
  });

  it('passes allowed tool through to host executor', async () => {
    const action = { id: 'a1', type: 'read_file', target: 'x.ts' } as unknown as AgentAction;
    const res = await executeSandboxAction(action, ['read_file'], host);
    expect(res.status).toBe('success');
  });
});
