import { describe, it, expect } from 'vitest';
import {
  parseAgentActions,
  hasIncompleteActionBlock,
  checkActionSyntaxComplete,
  autoRepairIncompleteFences
} from '../src/services/agentLoop';

describe('Agent Loop Truncation and Incomplete Block Interception', () => {
  it('should detect unclosed action blocks and recover action via dangling fence recovery', () => {
    const unclosedContent = `我将列出 docs 目录下的所有文件：
\`\`\`run_command
Get-ChildItem -Path "D:/weihu/agent-learning/docs" -Recurse`;

    // Flags incomplete block
    expect(hasIncompleteActionBlock(unclosedContent)).toBe(true);
    // Auto-repairs fence
    const repaired = autoRepairIncompleteFences(unclosedContent);
    expect(repaired.endsWith('```\n')).toBe(true);
    // Recovers action without crashing
    const actions = parseAgentActions(repaired);
    expect(actions.length).toBe(1);
    expect(actions[0].code).toContain('Get-ChildItem');
  });

  it('should detect incomplete truncated action block when quote is unclosed', () => {
    const truncatedContent = `docs 下有几个子目录但未显示文件。我继续深入查看这些子目录和根目录结构。
\`\`\`run_command
Get-ChildItem -Path "D:/weih`;

    const isComplete = checkActionSyntaxComplete('Get-ChildItem -Path "D:/weih');
    expect(isComplete).toBe(false);
    expect(hasIncompleteActionBlock(truncatedContent)).toBe(true);
  });

  it('should detect unclosed write_file block and recover action', () => {
    const content = `\`\`\`write_file:src/utils/test.ts
export const add = (a: number, b: number) => a + b;`;

    expect(hasIncompleteActionBlock(content)).toBe(true);
    const repaired = autoRepairIncompleteFences(content);
    const actions = parseAgentActions(repaired);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('write_file');
    expect(actions[0].target).toBe('src/utils/test.ts');
  });

  it('should correctly parse completely closed action blocks', () => {
    const closedContent = `\`\`\`run_command
Get-ChildItem -Path "D:/weihu/agent-learning/docs"
\`\`\``;

    const actions = parseAgentActions(closedContent);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('run_command');
    expect(hasIncompleteActionBlock(closedContent)).toBe(false);
  });
});
