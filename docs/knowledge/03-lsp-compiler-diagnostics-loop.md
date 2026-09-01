# 03 - LSP 编译器诊断与代码自愈闭环设计

## ① 知识点与问题背景 (Context & Problem Statement)

在自主智能体（Autonomous Coding Agent）的代码生成过程中，模型经常会出现：
- 缺少 import 导入；
- 类型不匹配（TS2322 / Type Mismatch）；
- 标点符号漏写或语法拼写错误。
传统做法是等代码全写完了让用户自己运行 `npm test` 或编译命令去发现，导致大量的上下文往返和测试报错。
**目标**：构建“写盘即诊断”的即时自愈回路。每次 Agent `write_file` 动作落盘后，无需启动繁重的全量测试，通过毫秒级编译器语法检查捕获错误，并将红线报错作为最高优先级反馈给 Agent 自动修复。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. 语言编译器的轻量探针机制
宿主（Backend Core）在无需完整打包的前提下，利用各语言编译器提供的静态检查模式进行毫秒级探测：
- **TypeScript / JavaScript**：`npx tsc --noEmit --target es2022 <filePath>` 或针对项目配置扫描；
- **Python**：`python -m py_compile <filePath>` 快速编译为字节码检验语法树；
- **Rust**：`cargo check --message-format=json` 仅生成类型元数据不生成机器码。

### 2. 结构化错误提取与严重级别分级
从编译器原始标准错误（stderr）输出中，使用正则提取关键元数据：
- `filePath`: 错误发生的文件路径；
- `line` & `column`: 具体的行列定位；
- `code`: 错误代码（如 `TS2322`, `TS2304`）；
- `message`: 错误详情。

### 3. 自愈回路组装与反馈注入
在 Agent Loop 收集动作执行结果（`formatExecutionFeedback`）时：
- 将编译报错直接置顶，冠以 `【⚡ 编译器实时诊断反馈 (LSP Compiler Diagnostics)】`；
- 明确指示 Agent：“编译器发现了语法/类型错误，严禁忽视上述报错，请优先修复上述红线问题”。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. 宿主诊断端点实现
在桌面端宿主（`desktop_app.py` 或 Rust `plugin_lsp.rs`）中暴露诊断接口：
- 路由：`POST /api/diagnostics/check`
- 请求参数：`{ "filePath": "src/services/foo.ts", "projectPath": "..." }`
- 返回结果：`{ "success": true, "hasErrors": true, "errors": [...] }`

### 2. 前端诊断执行器与反馈格式化
代码位置：`prototype/src/services/compilerDiagnostics.ts`
```typescript
export function formatDiagnosticFeedback(errors: DiagnosticError[]): string {
  if (errors.length === 0) return '';
  const errorLines = errors
    .slice(0, 5)
    .map((e, idx) => `${idx + 1}. [${e.source.toUpperCase()} ${e.code || 'ERR'}] ${e.filePath} (行 ${e.line}, 列 ${e.column}): ${e.message}`)
    .join('\n');

  return `
【⚡ 编译器实时诊断反馈 (LSP Compiler Diagnostics)】
代码落盘后编译器检测到以下语法或类型错误：
${errorLines}
⚠️ 严禁忽视上述编译器报错！请在进行下一步之前，优先修改代码消除上述编译错误。
`.trim();
}
```

### 3. Agent 循环串联
在 `agentLoop.ts` 中：
```typescript
if (action.type === 'write_file') {
  const diagErrors = await runFileDiagnostics(action.path, workspacePath);
  if (diagErrors.length > 0) {
    feedback += '\n\n' + formatDiagnosticFeedback(diagErrors);
  }
}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **超时与静默执行**：
   编译器检查必须配置超时限制（如 5 秒），防止 `tsc` 或大型工程扫描死锁卡死 Agent 执行主流程。
2. **过滤警告与无关建议**：
   仅拦截 `error` 级别的硬性错误，过滤低优先级 `warning` 或代码样式提示，避免扰乱模型的注意力窗口。
