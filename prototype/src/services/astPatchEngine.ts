import { PatchChunk, PatchApplyResult, applyUnifiedDiffPatch } from '../types/contracts';

export class AstPatchEngine {
  public applyPatch(sourceCode: string, chunk: PatchChunk): PatchApplyResult {
    return applyUnifiedDiffPatch(sourceCode, chunk);
  }

  public validateAstSyntax(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (code.includes('class class') || code.includes('function function')) {
      errors.push('检测到重复关键字声明 (Duplicate Keyword)');
    }
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`花括号不匹配: 开括号 ${openBraces} 个, 闭括号 ${closeBraces} 个`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const defaultPatchEngine = new AstPatchEngine();
