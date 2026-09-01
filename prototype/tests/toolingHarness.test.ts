import { describe, it, expect } from 'vitest';
import {
  truncateToolOutputForContext,
  formatReadFileCommand,
  formatListDirCommand,
  formatGrepSearchCommand
} from '../src/services/toolingHarness';
import { parseAgentActions } from '../src/services/agentLoop';

describe('Tooling Harness Primitives (WP-S)', () => {
  it('should truncate excessively long tool output to protect context tokens', () => {
    const longOutput = Array.from({ length: 300 }, (_, i) => `Line ${i + 1}: Some long diagnostic log data`).join('\n');
    const truncated = truncateToolOutputForContext(longOutput, 50, 2000);

    expect(truncated).toContain('Line 1:');
    expect(truncated).toContain('Line 300:');
    expect(truncated).toContain('⚠️ 输出过长已自动折叠');
    expect(truncated.length).toBeLessThan(3000);
  });

  it('should format read_file command with UTF-8 encoding and line slicing', () => {
    const cmd = formatReadFileCommand('D:/weihu/new-api/relay/channel/adapter.go', 21, 50);
    expect(cmd).toContain('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8');
    expect(cmd).toContain('D:/weihu/new-api/relay/channel/adapter.go');
    expect(cmd).toContain('$start = 21');
    expect(cmd).toContain('$take = 30');
  });

  it('should parse native read_file tool call with slice parameters', () => {
    const content = `\`\`\`read_file:src/services/agentLoop.ts
\`\`\``;
    const actions = parseAgentActions(content);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('read_file');
    expect(actions[0].target).toBe('src/services/agentLoop.ts');
    expect(actions[0].code).toBe('src/services/agentLoop.ts');
  });

  it('should parse XML DSML tool calls for read_file', () => {
    const xmlContent = `<tool_call>
<read_file>D:/weihu/new-api/relay/channel/adapter.go</read_file>
</tool_call>`;
    const actions = parseAgentActions(xmlContent);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('run_command');
    expect(actions[0].target).toContain('adapter.go');
    expect(actions[0].code).toContain('adapter.go');
  });

  it('should format list_dir and grep_search commands properly', () => {
    const listCmd = formatListDirCommand('src/components');
    expect(listCmd).toContain('Get-ChildItem');
    expect(listCmd).toContain('src/components');

    const grepCmd = formatGrepSearchCommand('StageGateDecision', 'src');
    expect(grepCmd).toContain('Select-String');
    expect(grepCmd).toContain('StageGateDecision');
  });
});
