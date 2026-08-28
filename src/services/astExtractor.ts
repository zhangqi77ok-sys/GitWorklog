import { CodeAnchorRef, ASTCompressedItem } from "../types/contracts";

export class ASTExtractor {
  /**
   * 结构感知轻量提取：提取 TypeScript/JavaScript/Python 代码中的核心签名 (类、函数、接口、导入)
   */
  public extractSignatures(code: string, fileName: string = "source.ts"): {
    signatures: string[];
    imports: string[];
    anchors: CodeAnchorRef[];
  } {
    const lines = code.split("\n");
    const signatures: string[] = [];
    const imports: string[] = [];
    const anchors: CodeAnchorRef[] = [];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // 1. 提取导入依赖
      if (trimmed.startsWith("import ") || trimmed.startsWith("from ") || trimmed.startsWith("require(")) {
        imports.push(trimmed);
      }

      // 2. 提取函数与方法签名 (TS/JS/Python)
      const funcMatch = trimmed.match(
        /^(?:export\s+)?(?:async\s+)?(?:public\s+|private\s+|protected\s+|static\s+)?(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|def\s+([a-zA-Z0-9_$]+)\s*\([^)]*\))/
      );

      // 3. 提取类、接口与类型签名
      const classOrTypeMatch = trimmed.match(
        /^(?:export\s+)?(?:abstract\s+)?(?:class|interface|type|enum|struct)\s+([a-zA-Z0-9_$]+)/
      );

      if (funcMatch || classOrTypeMatch) {
        const symbolName = funcMatch ? (funcMatch[1] || funcMatch[2] || funcMatch[3]) : classOrTypeMatch![1];

        // 截取签名头部 (至开括号或等号)
        let sig = trimmed;
        if (sig.includes("{")) {
          sig = sig.substring(0, sig.indexOf("{")).trim();
        }
        signatures.push(`L${lineNum}: ${sig}`);

        anchors.push({
          file: fileName,
          startLine: lineNum,
          symbolName,
          signature: sig,
        });
      }
    });

    return { signatures, imports, anchors };
  }

  /**
   * 将大段代码结构化蒸馏为 AST 骨架概要 (保留类型契约与接口定义，安全折叠具体函数实现体)
   */
  public generateASTDistillation(code: string, fileName: string): ASTCompressedItem {
    const { signatures, imports, anchors } = this.extractSignatures(code, fileName);
    const lineCount = code.split("\n").length;

    const summary = [
      `// [AST Skeleton] ${fileName} (${lineCount} lines total)`,
      `// 核心依赖: ${imports.slice(0, 3).join("; ")}${imports.length > 3 ? ` ... (+${imports.length - 3} more)` : ""}`,
      `// 关键符号与契约签名:`,
      ...signatures.slice(0, 8).map((s) => `//   • ${s}`),
    ].join("\n");

    return {
      id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      anchor: anchors[0] || { file: fileName, startLine: 1, endLine: lineCount },
      extractedSignatures: signatures,
      summary,
      originalLineCount: lineCount,
      compressedTokenCount: Math.ceil(summary.length / 3.8),
    };
  }
}

export const astExtractor = new ASTExtractor();
