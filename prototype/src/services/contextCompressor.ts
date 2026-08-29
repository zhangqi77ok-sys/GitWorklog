import { extractAstSkeleton } from '../types/contracts';

export class ContextCompressor {
  public compressFiles(files: Array<{ path: string; content: string }>): {
    compressedPrompt: string;
    originalTokens: number;
    compressedTokens: number;
    savingPercentage: number;
  } {
    let originalTotal = 0;
    let compressedTotal = 0;
    const parts: string[] = [];

    for (const f of files) {
      const origTokens = Math.ceil(f.content.length / 4);
      originalTotal += origTokens;

      const skeleton = extractAstSkeleton(f.content);
      const compTokens = Math.ceil(skeleton.length / 4);
      compressedTotal += compTokens;

      parts.push(`// --- Skeleton: ${f.path} ---\n${skeleton}`);
    }

    const saving = originalTotal > 0 ? Math.round(((originalTotal - compressedTotal) / originalTotal) * 100) : 0;

    return {
      compressedPrompt: parts.join('\n\n'),
      originalTokens: originalTotal,
      compressedTokens: compressedTotal,
      savingPercentage: saving
    };
  }
}

export const defaultContextCompressor = new ContextCompressor();
