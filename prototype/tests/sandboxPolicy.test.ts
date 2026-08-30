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
