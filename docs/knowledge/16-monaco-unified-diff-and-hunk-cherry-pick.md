# Git 行级 Unified Diff 结构化解析、Hunk 分块与单块 Cherry-Pick 采纳/逆向丢弃实现机制

> 本文档依据 `AGENTS.md`【铁律 6】强制设立，记录在 Tcode Studio v2.0 中，如何通过 Go 微内核结合 Git 底层管道实现行级 Unified Diff 的精准 Hunk 分块解析、前台 Vue 3 独立渲染，以及基于 `git apply` / `git apply --reverse` 实现单块 Cherry-Pick 暂存与无损丢弃撤销的完整技术落地经验。

---

## ① 知识点与问题背景 (Context & Problem Statement)

在现代 AI 原生编程工作台中，大模型修改工程文件往往会同时改动同一个文件内的多个离散代码区域（Hunks）：
1. **全量粗粒度回滚的痛点**：
   若只支持文件级回滚（如 `git checkout HEAD -- <file>`），用户如果只想采纳其中的一部分改动（如保留功能实现、放弃调试代码），只能被迫全量接受或全量丢弃；
2. **Unified Diff 结构化语义提取的复杂度**：
   原始 `git diff` 输出为纯文本，包含 `diff --git`、`index`、`--- a/`、`+++ b/` 等元信息以及以 `@@ -start,len +start,len @@` 开头的分块标头；需要将其精确切分为一个个拥有独立上下文的 `DiffHunk` 结构体；
3. **补丁应用与逆向恢复的安全与原子性**：
   单块采纳必须支持暂存到 Git 暂存区（Index），而单块丢弃必须能够精准反向抹除物理工作区的改动，同时不能破坏同文件内的其他 Hunk。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. Unified Diff 的语法剖析与 Hunk 状态机解析
- 每一个变更块均由 `@@` 行界定：
  - 例如 `@@ -42,6 +42,8 @@ func main() {` 表示原文件从第 42 行起 6 行，新文件从第 42 行起 8 行；
- 解析器状态机遇到以 `@@` 开头的行时触发分块结算，为当前 Hunk 聚合其内部的：
  - `+` (新增行, Type: `add`)
  - `-` (删除行, Type: `del`)
  - 空格 (上下文行, Type: `ctx`)
- 自动构建符合 GNU Patch / Git 标准的补丁头：
  ```text
  --- a/<rel_path>
  +++ b/<rel_path>
  @@ -x,y +m,n @@
  <lines...>
  ```

### 2. Git 原生补丁管道算子 (`git apply`)
- **采纳并暂存 (`ApplyDiffHunk`)**：
  - 命令：`git apply --whitespace=nowarn --cached -`
  - 作用：将单个 Hunk 的 patch 流直接通过 Stdin 输入给 Git，仅应用到暂存区（Index），工作区保持改动，实现精准 Cherry-Pick 暂存；
- **丢弃并逆向还原 (`DiscardDiffHunk`)**：
  - 命令：`git apply --whitespace=nowarn --reverse -`
  - 作用：将单个 Hunk 的 patch 反向（Reverse）应用至工作区，彻底抹除该块变更，实现毫秒级局部无损撤销。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. Go 后端微内核算子实现 (`internal/diff/differ.go`)
```go
// 采纳单个 Hunk 到暂存区
func ApplyHunkPatch(workspaceRoot, relPath string, hunkIndex int, stageOnly bool) error {
    report, _ := ComputeFileDiff(workspaceRoot, relPath)
    patch := report.Hunks[hunkIndex].RawPatch
    args := []string{"apply", "--whitespace=nowarn"}
    if stageOnly {
        args = append(args, "--cached")
    }
    args = append(args, "-")
    cmd := exec.Command("git", args...)
    cmd.Dir = workspaceRoot
    cmd.Stdin = strings.NewReader(patch)
    return cmd.Run()
}

// 逆向撤销单个 Hunk
func DiscardHunkPatch(workspaceRoot, relPath string, hunkIndex int) error {
    report, _ := ComputeFileDiff(workspaceRoot, relPath)
    patch := report.Hunks[hunkIndex].RawPatch
    cmd := exec.Command("git", "apply", "--reverse", "--whitespace=nowarn", "-")
    cmd.Dir = workspaceRoot
    cmd.Stdin = strings.NewReader(patch)
    return cmd.Run()
}
```

### 2. 前端 Vue 3 界面与 IPC 绑定 (`frontend/src/App.vue`)
- 模板支持按 `diffReport.hunks` 渲染独立卡片，展示 `块 #N`、增减统计与操作按钮；
- 每次操作完成后，自动联动触发 `loadDiff()` 与 `loadGitStatus()`，实时刷新变更计数与 Git 源代码管理抽屉。

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **路径格式斜杠兼容**：
   - Windows 路径中的反斜杠（`\`）在 Git Patch 中会被误判为转义字符；
   - 必须使用 `filepath.ToSlash(relPath)` 将相对路径规范化为标准正斜杠（`/`）。
2. **换行符不一致警告规避**：
   - Windows 与 Linux 换行符（CRLF vs LF）混用容易导致 `git apply` 报错 `corrupt patch at line...`；
   - 必须在执行 `git apply` 时显式注入 `--whitespace=nowarn` 参数提升容错。
3. **单块操作后的状态连带刷新**：
   - 采纳块会影响 Git Index（Staged 状态），丢弃块会影响 Working Tree；
   - 前端必须在异步调用返回后同时刷新 Diff 视图与 Git 状态面板，杜绝界面与磁盘不同步。
