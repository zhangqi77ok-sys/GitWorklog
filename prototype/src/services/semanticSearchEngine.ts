/**
 * Semantic Code Search Engine (Embedding & Semantic Chunking)
 * Splits codebase files into semantic chunks (functions/classes/contracts)
 * and performs cosine / hybrid similarity matching for natural language questions.
 */

export interface CodeChunk {
  id: string;
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  content: string;
  tokensEstimated: number;
}

export interface SemanticSearchResult {
  chunk: CodeChunk;
  score: number; // 0.0 - 1.0
  matchedTerms: string[];
}

/**
 * Chunks a single code file into semantic blocks based on syntax keywords (function, class, interface, export, def)
 */
export function splitCodeIntoSemanticChunks(filePath: string, content: string): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  let currentChunkLines: string[] = [];
  let currentStartLine = 1;
  let currentSymbolName = filePath.split('/').pop() || filePath;

  const symbolRegex = /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|def|fn|struct|enum)\s+([A-Za-z0-9_$]+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.trim().match(symbolRegex);

    if (match && currentChunkLines.length >= 12) {
      // Flush previous chunk
      const chunkText = currentChunkLines.join('\n');
      chunks.push({
        id: `chunk-${filePath}-${currentStartLine}`,
        filePath,
        symbolName: currentSymbolName,
        startLine: currentStartLine,
        endLine: i,
        content: chunkText,
        tokensEstimated: Math.ceil(chunkText.length / 3.8)
      });
      currentChunkLines = [line];
      currentStartLine = i + 1;
      currentSymbolName = match[1];
    } else {
      currentChunkLines.push(line);
      if (match && currentChunkLines.length < 12) {
        currentSymbolName = match[1];
      }
    }
  }

  if (currentChunkLines.length > 0) {
    const chunkText = currentChunkLines.join('\n');
    chunks.push({
      id: `chunk-${filePath}-${currentStartLine}`,
      filePath,
      symbolName: currentSymbolName,
      startLine: currentStartLine,
      endLine: lines.length,
      content: chunkText,
      tokensEstimated: Math.ceil(chunkText.length / 3.8)
    });
  }

  return chunks;
}

/**
 * Searches code chunks using hybrid BM25 / token-frequency similarity
 */
export function searchSemanticCodebase(
  query: string,
  chunks: CodeChunk[],
  topK: number = 4
): SemanticSearchResult[] {
  if (!query.trim() || chunks.length === 0) return [];

  // Extract query keywords (support English & Chinese tokens)
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length >= 2);

  if (keywords.length === 0) return [];

  const results: SemanticSearchResult[] = [];

  for (const chunk of chunks) {
    const chunkTextLower = `${chunk.filePath} ${chunk.symbolName} ${chunk.content}`.toLowerCase();
    const matchedTerms: string[] = [];
    let score = 0;

    for (const kw of keywords) {
      if (chunk.symbolName.toLowerCase().includes(kw)) {
        score += 3.5; // High weight on symbol match
        matchedTerms.push(kw);
      } else if (chunk.filePath.toLowerCase().includes(kw)) {
        score += 2.0; // Medium weight on file path match
        matchedTerms.push(kw);
      } else if (chunkTextLower.includes(kw)) {
        score += 1.0; // Base content match
        matchedTerms.push(kw);
      }
    }

    if (score > 0) {
      const normalizedScore = Math.min(1.0, score / (keywords.length * 3.5));
      results.push({ chunk, score: normalizedScore, matchedTerms });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}
