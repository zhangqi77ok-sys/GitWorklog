import { describe, it, expect } from 'vitest';
import { parseAgentActions, hasIncompleteActionBlock, checkActionSyntaxComplete } from '../src/services/agentLoop';

describe('Agent Loop Truncation and Incomplete Block Interception', () => {
  it('should detect unclosed action blocks and prevent silent execution', () => {
    const unclosedContent = `我将列出 docs 目录下的所有文件：
\`\`\`run_command
Get-ChildItem -Path "D:/weihu/agent-learning/docs" -Recurse`;

    const actions = parseAgentActions(unclosedContent);
    // Strict closed contract: actions is empty when fence is unclosed
    expect(actions.length).toBe(0);
    // But hasIncompleteActionBlock flags it so App.tsx does NOT silently exit
    expect(hasIncompleteActionBlock(unclosedContent)).toBe(true);
  });

  it('should detect incomplete truncated action block when quote is unclosed', () => {
    const truncatedContent = `docs 下有几个子目录但未显示文件。我继续深入查看这些子目录和根目录结构。
\`\`\`run_command
Get-ChildItem -Path "D:/weih`;

    const isComplete = checkActionSyntaxComplete('Get-ChildItem -Path "D:/weih');
    expect(isComplete).toBe(false);
    expect(hasIncompleteActionBlock(truncatedContent)).toBe(true);
  });

  it('should detect unclosed write_file block', () => {
    const content = `\`\`\`write_file:src/utils/test.ts
export const add = (a: number, b: number) => a + b;`;

    expect(parseAgentActions(content).length).toBe(0);
    expect(hasIncompleteActionBlock(content)).toBe(true);
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
