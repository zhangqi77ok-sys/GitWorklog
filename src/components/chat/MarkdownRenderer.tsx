import React, { useState } from 'react';
import { Copy, Check, Terminal, Code2 } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Clean all DSML, standard XML <invoke>, <parameter>, <tool_call>, <function_call> and dangling tags
  const cleanContent = content
    // 1. Paired tool blocks
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*(?:DSM[A-Z0-9]*[\s\/\u007C\uFF5C\u2502\u00A6]*)?tool_calls[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*(?:DSM[A-Z0-9]*[\s\/\u007C\uFF5C\u2502\u00A6]*)?tool_calls[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*(?:DSM[A-Z0-9]*[\s\/\u007C\uFF5C\u2502\u00A6]*)?invoke[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*(?:DSM[A-Z0-9]*[\s\/\u007C\uFF5C\u2502\u00A6]*)?invoke[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*(?:DSM[A-Z0-9]*[\s\/\u007C\uFF5C\u2502\u00A6]*)?parameter[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*(?:DSM[A-Z0-9]*[\s\/\u007C\uFF5C\u2502\u00A6]*)?parameter[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*(?:DSM[A-Z0-9]*[\s\/\u007C\uFF5C\u2502\u00A6]*)?function_call[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*(?:DSM[A-Z0-9]*[\s\/\u007C\uFF5C\u2502\u00A6]*)?function_call[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*tool_call[\s\/\u007C\uFF5C\u2502\u00A6]*>[\s\S]*?<\/[\s\/\u007C\uFF5C\u2502\u00A6]*tool_call[\s\/\u007C\uFF5C\u2502\u00A6>|]*>/gi, '')
    // 2. Isolated / dangling opening & closing tags
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*\/?[\s\/\u007C\uFF5C\u2502\u00A6]*(?:DSM[A-Z0-9]*[\s\/\u007C\uFF5C\u2502\u00A6]*)?(?:invoke|parameter|tool_calls?|function_call)[\s\S]*?>/gi, '')
    .replace(/<[\s\/\u007C\uFF5C\u2502\u00A6]*\/?[\s\/\u007C\uFF5C\u2502\u00A6]*DSM[A-Z0-9]*[\s\S]*?>/gi, '');

  const elements = parseMarkdownBlocks(cleanContent);

  return (
    <div className={`space-y-4 text-[14px] text-[#1E1C1A] leading-[1.75] font-sans select-text ${className}`}>
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
          className="my-2.5 pl-3.5 border-l-2 border-[#D96B27] bg-[#FAF8F5] py-2 px-3 rounded-r-xl text-[#5C564E] text-xs leading-relaxed"
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
        <ul key={`ul-${nodes.length}`} className="my-2 pl-4 list-disc space-y-1.5 text-[#2C2420]">
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
        <ol key={`ol-${nodes.length}`} className="my-2 pl-4 list-decimal space-y-1.5 text-[#2C2420]">
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
      <p key={`p-${nodes.length}`} className="leading-[1.75] my-1.5 text-[#2C2420]">
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
          className="px-1.5 py-0.5 mx-0.5 bg-[#F4EFEA] border border-[#E6DFD5] text-[#D96B27] rounded-md text-[11px] font-mono font-semibold"
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
        <em key={`italic-${keyIdx++}`} className="italic text-[#4A4540]">
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
  const lineCount = code.split('\n').length;
  const isLong = lineCount > 10;
  const [blockHeight, setBlockHeight] = useState<number>(isLong ? 260 : 0);
  const [isExpandedFull, setIsExpandedFull] = useState(!isLong);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = React.useRef(0);
  const startHeightRef = React.useRef(260);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = blockHeight || 260;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      const newH = Math.max(100, Math.min(800, startHeightRef.current + deltaY));
      setBlockHeight(newH);
      setIsExpandedFull(false);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-[#2E2B27] bg-[#181716] text-white shadow-md select-none">
      {/* Header bar with Mac dots */}
      <div className="px-4 py-2 bg-[#22201E] border-b border-[#2E2B27] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[#D5CCC0] font-mono font-medium">
          <div className="flex items-center gap-1.5 mr-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E06C75]/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#E5C07B]/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#98C379]/60" />
          </div>
          <span className="text-[#E6DFD5] text-[11px] font-semibold">{language || 'code'}</span>
          <span className="text-[10px] text-[#7A746C]">({lineCount} 行)</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLong && (
            <button
              type="button"
              onClick={() => setIsExpandedFull(!isExpandedFull)}
              className="px-2 py-0.5 rounded-md bg-[#2D2A26] hover:bg-[#3D3A36] text-[#D5CCC0] hover:text-white transition-colors cursor-pointer text-[10px]"
            >
              {isExpandedFull ? '限制高度' : '展开全屏'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2D2A26] hover:bg-[#3D3A36] text-[#D5CCC0] hover:text-white transition-colors cursor-pointer text-[11px] font-medium"
            title="复制代码"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? '已复制' : '复制代码'}</span>
          </button>
        </div>
      </div>
      <pre
        style={{
          maxHeight: isExpandedFull ? 'none' : `${blockHeight || 260}px`,
          height: isExpandedFull ? 'auto' : undefined,
        }}
        className="p-4 overflow-x-auto overflow-y-auto text-[12px] font-mono text-[#E8E2D8] leading-relaxed select-text"
      >
        <code>{code}</code>
      </pre>

      {/* Draggable bottom resize handle for code block */}
      {isLong && (
        <div
          onMouseDown={handleResizeStart}
          className={`h-2.5 w-full cursor-row-resize flex items-center justify-center border-t border-[#2E2B27] transition-colors ${
            isDragging ? 'bg-[#D96B27]/40' : 'bg-[#22201E] hover:bg-[#D96B27]/20'
          }`}
          title="上下拖动调整代码块高度"
        >
          <div className="w-8 h-1 bg-[#7A746C]/40 rounded-full" />
        </div>
      )}
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
    <div className="my-3 overflow-x-auto rounded-xl border border-[#E8E2D8] shadow-xs bg-white">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-[#FAF8F5] border-b border-[#E8E2D8]">
            {headerCells.map((h, i) => (
              <th key={i} className="py-2.5 px-3.5 font-bold text-[#1E1C1A] border-r border-[#E8E2D8]/60 last:border-r-0 text-[11px] uppercase tracking-wider">
                {renderInlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F2ECE4]">
          {bodyRows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className={`hover:bg-[#FAF8F5]/80 transition-colors ${
                rIdx % 2 === 1 ? 'bg-[#FDFBF7]' : 'bg-white'
              }`}
            >
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="py-2.5 px-3.5 text-[#3D3A36] border-r border-[#F2ECE4]/60 last:border-r-0">
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
      return (
        <h1 className="text-[22px] font-bold text-[#1E1C1A] mt-6 mb-3 pb-2 border-b border-[#EDE8E0] leading-tight">
          {content}
        </h1>
      );
    case 2:
      return (
        <h2 className="text-[18px] font-semibold text-[#1E1C1A] mt-5 mb-2.5 leading-snug">
          {content}
        </h2>
      );
    case 3:
      return (
        <h3 className="text-[15px] font-semibold text-[#2C2420] mt-4 mb-2 leading-snug">
          {content}
        </h3>
      );
    case 4:
    default:
      return (
        <h4 className="text-[13px] font-semibold text-[#3D3A36] mt-3 mb-1.5 uppercase tracking-wide">
          {content}
        </h4>
      );
  }
};
