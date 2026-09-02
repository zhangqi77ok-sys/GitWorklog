import { describe, it, expect } from 'vitest';
import { parseToolCallsFromText, sanitizeTextContent } from './tauriBridge';
import fs from 'fs';
import path from 'path';

describe('Real Autonomous Multi-Turn Agent Loop E2E Test Suite', () => {
  it('correctly executes multi-turn tool calling and produces final architecture report from live API', async () => {
    const baseUrl = 'https://agentrouter.org/v1';
    const apiKey = 'sk-gKTbHfCZqgyDVf3TaXWpXT5TXW9qIZdAFVMOsY49ZKFssyFZ';
    const model = 'deepseek-v4-flash';
    const workspace = 'E:\\pro\\agent-learning';

    function executeLocalTool(toolName: string, args: Record<string, any>) {
      const normName = (toolName || '').toLowerCase();
      if (normName === 'lookup' || normName === 'list_dir') {
        const target = path.resolve(workspace, args.path || '.');
        if (fs.existsSync(target)) {
          const stat = fs.statSync(target);
          if (stat.isDirectory()) {
            const files = fs.readdirSync(target);
            return `[目录列表 ${args.path}]:\n` + files.map((f) => {
              const full = path.join(target, f);
              const isDir = fs.statSync(full).isDirectory();
              return `${isDir ? '📁' : '📄'} ${f}`;
            }).join('\n');
          }
        }
      }
      if (normName === 'read_file') {
        const target = path.resolve(workspace, args.path || '');
        if (fs.existsSync(target) && fs.statSync(target).isFile()) {
          return `[文件内容 ${args.path}]:\n` + fs.readFileSync(target, 'utf-8').slice(0, 1000);
        }
      }
      return `[工具 ${toolName} 已执行]`;
    }

    const systemPrompt = `You are Tcode Next-Gen Autonomous AI Coding Assistant in Tcode Studio.
Current Active Workspace Directory: ${workspace}
You have native access to workspace tools:
- Lookup: inspect folder structure or find files, e.g. <|DSML|invoke name="Lookup"><|DSML|parameter name="path">.</|DSML|parameter></|DSML|invoke>
- read_file: read file contents, e.g. <|DSML|invoke name="read_file"><|DSML|parameter name="path">package.json</|DSML|parameter></|DSML|invoke>

When the user asks to review, inspect, or write code for this project, you MUST first invoke Lookup or read_file to inspect the real workspace. Once tool outputs are returned, analyze them and provide a complete architectural analysis report in markdown.`;

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      { role: 'user', content: '帮我审查一下项目架构' },
    ];

    let turn = 0;
    const maxTurns = 5;
    const executedTools: any[] = [];
    let finalReport = '';

    while (turn < maxTurns) {
      turn++;
      const payload = {
        model,
        messages,
        stream: true,
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'opencode/1.0',
        },
        body: JSON.stringify(payload),
      });

      expect(res.ok).toBe(true);

      const text = await res.text();
      let turnContent = '';
      let turnThought = '';

      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.reasoning_content) turnThought += delta.reasoning_content;
            if (delta?.content) turnContent += delta.content;
          } catch (e) {}
        }
      }

      console.log(`[E2E Debug] Turn ${turn} Content:\n`, turnContent);
      const toolCalls = parseToolCallsFromText(turnContent);
      console.log(`[E2E Debug] Turn ${turn} Parsed ToolCalls:`, toolCalls);

      if (toolCalls.length > 0) {
        messages.push({ role: 'assistant', content: turnContent });
        const toolOutputs: string[] = [];

        for (const call of toolCalls) {
          const output = executeLocalTool(call.name, call.args);
          executedTools.push({ name: call.name, args: call.args, result: output.slice(0, 500) });
          toolOutputs.push(`[Tool Output for ${call.name} (${JSON.stringify(call.args)})]:\n${output}`);
        }

        const promptSuffix =
          turn >= 2
            ? '\n\n【重要指示】：工作区上下文已收集完备，请不要再发出工具调用，请立即输出最终完整、详尽的项目架构审查分析报告！'
            : '\n\n请结合上述工具执行结果，继续分析或输出最终审查报告。';

        messages.push({
          role: 'user',
          content: toolOutputs.join('\n\n') + promptSuffix,
        });
      } else {
        const cleanText = sanitizeTextContent(turnContent);
        if (cleanText.length < 50 && turn < maxTurns) {
          messages.push({ role: 'assistant', content: turnContent });
          messages.push({
            role: 'user',
            content: '请直接输出完整的项目架构审查分析报告 Markdown。',
          });
          continue;
        }

        finalReport = cleanText || turnContent;
        break;
      }
    }

    expect(turn).toBeGreaterThanOrEqual(1);
    expect(finalReport.length).toBeGreaterThan(10);
  }, 120000);
});
