import { describe, it, expect } from 'vitest';
import { sanitizeTextContent, parseToolCallsFromText } from './tauriBridge';

describe('TDD: Agent Multi-Turn Tool Calling & Sanitization Suite', () => {
  it('sanitizes standard and spaced DSML XML blocks completely', () => {
    const rawWithSpaces = `
我来继续扫描项目的关键目录和配置文件。

< | | DSML | | tool_calls>
< | | DSML | | invoke name="Lookup">
< | | DSML | | parameter name="path" string="true">src</ | | DSML | | parameter>
</ | | DSML | | invoke>
< | | DSML | | invoke name="Lookup">
< | | DSML | | parameter name="path" string="true">package.json</ | | DSML | | parameter>
</ | | DSML | | invoke>
</ | | DSML | | tool_calls>
`;
    const clean = sanitizeTextContent(rawWithSpaces);
    expect(clean).toBe('我来继续扫描项目的关键目录和配置文件。');
  });

  it('sanitizes trailing pipe variant <|DSML|tool_calls|', () => {
    const rawWithPipe = `
让我进一步查看关键目录和配置文件，以便进行更深入的分析。

<|DSML|tool_calls|
<|DSML|invoke name="Lookup">
<|DSML|parameter name="path" string="true">src/components</|DSML|parameter>
</|DSML|invoke>
</|DSML|tool_calls>
`;
    const clean = sanitizeTextContent(rawWithPipe);
    expect(clean).toBe('让我进一步查看关键目录和配置文件，以便进行更深入的分析。');
  });

  it('parses multiple tool calls from spaced and pipe variants correctly', () => {
    const rawMulti = `
< | | DSML | | tool_calls>
< | | DSML | | invoke name="Lookup">
< | | DSML | | parameter name="path" string="true">src</ | | DSML | | parameter>
</ | | DSML | | invoke>
< | | DSML | | invoke name="Lookup">
< | | DSML | | parameter name="path" string="true">package.json</ | | DSML | | parameter>
</ | | DSML | | invoke>
</ | | DSML | | tool_calls>
`;
    const calls = parseToolCallsFromText(rawMulti);
    expect(calls.length).toBe(2);
    expect(calls[0].name).toBe('Lookup');
    expect(calls[0].args.path).toBe('src');
    expect(calls[1].name).toBe('Lookup');
    expect(calls[1].args.path).toBe('package.json');
  });

  it('returns empty string if content only consists of DSML tags', () => {
    const rawOnlyXml = `
<|DSML|tool_calls>
<|DSML|invoke name="Lookup">
<|DSML|parameter name="path" string="true">.</|DSML|parameter>
</|DSML|invoke>
</|DSML|tool_calls>
`;
    const clean = sanitizeTextContent(rawOnlyXml);
    expect(clean).toBe('');
  });

  it('aggregates multiple tool calls across turns into a single toolCalls array', () => {
    const turn1Calls = parseToolCallsFromText(`
      <|DSML|invoke name="Lookup"><|DSML|parameter name="path">.</|DSML|parameter></|DSML|invoke>
    `);
    const turn2Calls = parseToolCallsFromText(`
      <|DSML|invoke name="read_file"><|DSML|parameter name="path">package.json</|DSML|parameter></|DSML|invoke>
    `);
    const allCalls = [...turn1Calls, ...turn2Calls];
    expect(allCalls.length).toBe(2);
    expect(allCalls[0].name).toBe('Lookup');
    expect(allCalls[1].name).toBe('read_file');
  });
});
