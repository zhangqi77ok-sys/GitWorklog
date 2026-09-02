import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Clean DSML and internal tool invocation tags
  const cleanContent = content
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*tool_calls[\s\/\u007C\uFF5C\u2502\u00A6>|]*>[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*tool_calls[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*invoke[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*invoke[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*parameter[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\/\u007C\uFF5C\u2502\u00A6]*parameter[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*tool_call[\s\/\u007C\uFF5C\u2502\u00A6]*>[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*tool_call[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*\/?[\s\/\u007C\uFF5C\u2502\u00A6]*DSML[\s\S]*?>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*\/?[\s\/\u007C\uFF5C\u2502\u00A6]*tool_call[\s\S]*?>/gi, '');

  const elements = parseMarkdownBlocks(cleanContent);

  return (
    <div className={`space-y-2.5 text-xs text-[#1E1C1A] leading-relaxed font-sans ${className}`}>
      {elements}
    </div>
  );
};

function parseMarkdownBlocks(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Fenced Code Block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      nodes.push(
        <CodeBlock key={`code-${nodes.length}`} language={lang} code={codeLines.join('\n')} />
      );
      continue;
    }

    // 2. Table Block
    if (line.includes('|') && lines[i + 1] && lines[i + 1].includes('|') && lines[i + 1].includes('---')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      nodes.push(<TableBlock key={`table-${nodes.length}`} rawLines={tableLines} />);
      continue;
    }

    // 3. Headings
    if (line.startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const textContent = match[2];
        nodes.push(<HeadingBlock key={`heading-${nodes.length}`} level={level} text={textContent} />);
        i++;
        continue;
      }
    }

    // 4. Blockquotes
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      nodes.push(
        <blockquote
          key={`quote-${nodes.length}`}
          className="my-2 pl-3 border-l-3 border-[#D96B27] bg-[#FAF8F5] py-1.5 px-2 rounded-r text-[#6B665F] italic"
        >
          {quoteLines.map((ql, qIdx) => (
            <div key={qIdx}>{renderInlineMarkdown(ql)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // 5. Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      nodes.push(
        <ul key={`ul-${nodes.length}`} className="my-1.5 pl-4 list-disc space-y-1 text-[#1E1C1A]">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      nodes.push(
        <ol key={`ol-${nodes.length}`} className="my-1.5 pl-4 list-decimal space-y-1 text-[#1E1C1A]">
          {listItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Empty line / Paragraph
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    nodes.push(
      <p key={`p-${nodes.length}`} className="leading-relaxed my-1">
        {renderInlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  // Split on bold, italic, code
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={`inline-code-${keyIdx++}`}
          className="px-1.5 py-0.5 mx-0.5 bg-[#F4EFEA] border border-[#E6DFD5] text-[#D96B27] rounded text-[11px] font-mono font-medium"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch) {
      parts.push(
        <strong key={`bold-${keyIdx++}`} className="font-bold text-[#1E1C1A]">
          {boldMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
    if (italicMatch && !boldMatch) {
      parts.push(
        <em key={`italic-${keyIdx++}`} className="italic text-[#3D3A36]">
          {italicMatch[2]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Plain text character or slice until next special token
    const nextSpecial = remaining.search(/[`*_]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return <>{parts}</>;
}

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#E6DFD5] bg-[#1E1C1A] text-white shadow-xs">
      <div className="px-3 py-1.5 bg-[#2D2A26] border-b border-[#3D3A36] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-[#D5CCC0] font-mono font-semibold">
          <Terminal className="w-3.5 h-3.5 text-[#D96B27]" />
          <span>{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E1C1A] hover:bg-[#3D3A36] text-[#D5CCC0] hover:text-white transition-colors cursor-pointer text-[10px]"
          title="复制全部代码"
        >
          {copied ? <Check className="w-3 h-3 text-[#4CAF50]" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? '已复制' : '复制代码'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[11px] font-mono text-[#E6DFD5] leading-relaxed select-text">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const TableBlock: React.FC<{ rawLines: string[] }> = ({ rawLines }) => {
  if (rawLines.length < 2) return null;

  const headerCells = rawLines[0]
    .split('|')
    .map((c) => c.trim())
    .filter((c, idx, arr) => (idx === 0 && c === '' ? false : idx === arr.length - 1 && c === '' ? false : true));

  const bodyRows = rawLines.slice(2).map((row) =>
    row
      .split('|')
      .map((c) => c.trim())
      .filter((c, idx, arr) => (idx === 0 && c === '' ? false : idx === arr.length - 1 && c === '' ? false : true))
  );

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-[#E6DFD5] shadow-xs">
      <table className="w-full text-left border-collapse text-[11px]">
        <thead>
          <tr className="bg-[#F4EFEA] border-b border-[#E6DFD5]">
            {headerCells.map((h, i) => (
              <th key={i} className="p-2.5 font-bold text-[#1E1C1A] border-r border-[#E6DFD5] last:border-r-0">
                {renderInlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className={`border-b border-[#E6DFD5]/70 last:border-b-0 hover:bg-[#FAF8F5] transition-colors ${
                rIdx % 2 === 1 ? 'bg-[#FDFCFA]' : 'bg-white'
              }`}
            >
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="p-2.5 text-[#3D3A36] border-r border-[#E6DFD5]/70 last:border-r-0">
                  {renderInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const HeadingBlock: React.FC<{ level: number; text: string }> = ({ level, text }) => {
  const content = renderInlineMarkdown(text);
  switch (level) {
    case 1:
      return <h1 className="text-base font-bold text-[#1E1C1A] mt-3 mb-1 border-b border-[#E6DFD5] pb-1">{content}</h1>;
    case 2:
      return <h2 className="text-sm font-bold text-[#1E1C1A] mt-2.5 mb-1">{content}</h2>;
    case 3:
      return <h3 className="text-xs font-bold text-[#D96B27] mt-2 mb-0.5">{content}</h3>;
    case 4:
    default:
      return <h4 className="text-xs font-semibold text-[#1E1C1A] mt-1.5 mb-0.5">{content}</h4>;
  }
};
