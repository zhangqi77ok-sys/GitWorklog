import { describe, it, expect } from 'vitest';
import { parseAgentMessage } from '../src/types/contracts';
import {
  parseAgentActions,
  extractThinkingFallbackActions
} from '../src/services/agentLoop';

describe('DSML & Custom Tool Call Parsing Protocol', () => {
  it('should parse DeepSeek DSML tool_name tag variant and sanitize cleanContent completely', () => {
    const rawOutput = `我来审查 new-api 项目，先看整体结构。
< | | DSML | | tool_name="run_command">
< | | DSML | | cmd>Get-ChildItem -Path D:\\weihu\\new-api -Depth 2 -Force | Select-Object FullName, PSIsContainer | Format-Table -AutoSize</ | | DSML | | cmd>
</ | | DSML | | tool>
< | | DSML | | toolitude name="description">查看 new-api 项目目录结构</ | | DSML | | tool>`;

    const parsedMsg = parseAgentMessage(rawOutput);
    expect(parsedMsg.cleanContent).toBe('我来审查 new-api 项目，先看整体结构。');
    expect(parsedMsg.toolCalls.length).toBe(1);
    expect(parsedMsg.toolCalls[0].name).toBe('run_command');
    expect(parsedMsg.toolCalls[0].parameters.command || parsedMsg.toolCalls[0].parameters.cmd).toContain('Get-ChildItem');

    const actions = parseAgentActions(rawOutput);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('run_command');
    expect(actions[0].code).toContain('Get-ChildItem');
  });

  it('should parse write_file DSML variant', () => {
    const rawOutput = `准备写入配置文件。
<|DSML|tool_name="write_file">
<|DSML|path>src/config.json</|DSML|path>
<|DSML|content>{"port": 8080}</|DSML|content>
</|DSML|tool>`;

    const parsedMsg = parseAgentMessage(rawOutput);
    expect(parsedMsg.cleanContent).toBe('准备写入配置文件。');
    expect(parsedMsg.toolCalls.length).toBe(1);
    expect(parsedMsg.toolCalls[0].name).toBe('write_file');

    const actions = parseAgentActions(rawOutput);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('write_file');
    expect(actions[0].target).toBe('src/config.json');
    expect(actions[0].code).toBe('{"port": 8080}');
  });

  it('should parse JSON tool_call tag variant', () => {
    const rawOutput = `执行测试命令。
<tool_call>
{"name": "run_command", "arguments": {"command": "npm test"}}
</tool_call>`;

    const parsedMsg = parseAgentMessage(rawOutput);
    expect(parsedMsg.cleanContent).toBe('执行测试命令。');
    expect(parsedMsg.toolCalls.length).toBe(1);
    expect(parsedMsg.toolCalls[0].name).toBe('run_command');

    const actions = parseAgentActions(rawOutput);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('run_command');
    expect(actions[0].code).toBe('npm test');
  });

  it('should parse run_command and exec_command fence blocks as run_command actions', () => {
    const rawPowershell = `我来实际执行审查，先看项目根目录结构。
\`\`\`run_command
Get-ChildItem -Path D:\\weihu\\new-api -Force | Select-Object Mode, Name | Format-Table -AutoSize
\`\`\``;
    const psActions = parseAgentActions(rawPowershell);
    expect(psActions.length).toBe(1);
    expect(psActions[0].type).toBe('run_command');
    expect(psActions[0].code).toContain('Get-ChildItem');

    const rawBash = `运行测试套件
\`\`\`exec_command
npm run test
\`\`\``;
    const bashActions = parseAgentActions(rawBash);
    expect(bashActions.length).toBe(1);
    expect(bashActions[0].type).toBe('run_command');
    expect(bashActions[0].code).toBe('npm run test');
  });

  it('should recognize bare terminal command as fallback run_command action when no fences present', () => {
    const rawBare = `我来实际执行审查，先看项目根目录结构。
Get-ChildItem -Path D:\\weihu\\new-api -Force | Select-Object Mode, Name | Format-Table -AutoSize`;

    const actions = parseAgentActions(rawBare);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('run_command');
    expect(actions[0].code).toContain('Get-ChildItem');
  });

  it('should recognize bare directory path as fallback directory exploration command', () => {
    const rawPathOnly = `我先列出项目根目录和关键结构。
D:\\weihu\\new-api`;

    const actions = parseAgentActions(rawPathOnly);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('run_command');
    expect(actions[0].code).toContain('Get-ChildItem');
    expect(actions[0].code).toContain('D:\\weihu\\new-api');
  });

  it('should extract safe exploration command from thinkingText when content omits code fences', () => {
    const thinkingText = `Let me explore the directory structure.
Let me do:
\`\`\`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ChildItem "D:/weihu/agent-learning/docs/technical_reviews" -Force | Format-Table Mode, Name, Length -AutoSize
\`\`\`
Let me proceed.`;

    const actions = extractThinkingFallbackActions(thinkingText);
    expect(actions.length).toBe(1);
    expect(actions[0].type).toBe('run_command');
    expect(actions[0].code).toContain('Get-ChildItem');
  });

  it('should not parse natural language prose as commands without explicit tool call or code fence', () => {
    const naturalSentence = '继续探索。我需要读取 docs/technical_reviews 目录下的内容，特别是 model-gateway-v2-contract.md，同时查看 src-desktop 目录结构。让我用一条命令完成多个探索。';

    const actions = parseAgentActions(naturalSentence);
    // 纯粹原则：自然语言陈述不伪造命令，actions 为 0
    expect(actions.length).toBe(0);
  });
});

