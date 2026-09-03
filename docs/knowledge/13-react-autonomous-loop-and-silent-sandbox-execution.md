# ReAct 自主智能体多轮自愈循环、物理算子沙箱与 Windows 静默 Shell 规范

> 本文档依据 `AGENTS.md`【铁律 6】强制设立，记录在构建 Tcode 物理算子调度中心、Windows 零弹窗进程调用以及影子快照防灾设计中的核心经验与工程规范。

---

## ① 知识点与问题背景 (Context & Problem Statement)

将 AI 大模型从“纯文本聊天机器人”升级为具备真实自主编程能力的“智能体开发助手”，必须攻克两大难题：
1. **多轮 ReAct 闭环自动化驱动**：
   模型输出工具调用意图后，系统必须能在物理沙箱中安全执行，并将执行结果无缝注回模型上下文，让模型自主完成“分析错误 -> 补丁修复 -> 自动化测试验证”的自愈循环；
2. **Windows 桌面端外部进程黑框弹窗闪烁**：
   在 Windows 下调用 `child_process.spawn` 执行 Shell 命令（如 `git status`、`npm test`）时，若未配置底层进程标志位，系统会频繁弹出控制台黑色命令窗口（`cmd.exe` / `conhost.exe`），严重破坏桌面端用户体验；
3. **物理文件破坏防灾机制**：
   Agent 在自主写代码或打补丁时，可能出现误删核心代码或产生语法崩溃。必须在写入前具备秒级无损回退的底层防线。

---

## ② 核心原理与知识内容 (Knowledge Content & Root Cause)

### 1. ReAct (Reasoning + Acting) 闭环数学模型
智能体自愈推理环由以下时序驱动：
$$\text{Observation}_t \rightarrow \text{Thought}_t \rightarrow \text{Action}_t (\text{ToolCall}) \rightarrow \text{Execution} \rightarrow \text{Observation}_{t+1}$$
当模型输出形如 `<<<TOOL_CALL: run_command {"cmd": "npm test"}>>>` 时，微内核拦截该指令，在本地物理沙箱执行，并将控制台标准输出以 `role: "user"`（或 `role: "tool"`）追加至会话历史，触发第二轮推理合成。

### 2. Windows `CREATE_NO_WINDOW` 进程标志位规范
在 Win32 API 中，创建子进程的底层函数是 `CreateProcessW`。
若要彻底禁止产生控制台宿主窗体，必须在进程创建标志位中注入：
$$\text{CREATE\_NO\_WINDOW} = \text{0x08000000}$$
在 Node.js 中对应的配置项为 `windowsHide: true`，在 Rust 中对应的配置项为 `creation_flags(0x08000000)`。若忽略此标志位，每次执行命令都会出现瞬间闪现的黑色 cmd 窗口。

### 3. 微内核影子 Git 快照 (Shadow Snapshot) 防护网
在执行任何物理文件写入操作前 5ms，系统通过轻量 Git Plumbing 管道（`git write-tree` / `git commit-tree`）在 `.git/refs/tcode/snapshots/` 下创建隔离的影子提交对象。该操作不改变用户的 `HEAD`，但能以 O(1) 复杂度永久锁定写入前的文件快照，支持秒级回退。

---

## ③ 标准解决方案与实操步骤 (Actionable Solutions & Step-by-Step Guide)

### 1. Windows 静默 Shell 算子实现 (`backend/daemon.js`)
```javascript
function executeTool(name, args) {
  if (name === "run_command") {
    return new Promise((resolve) => {
      // 必须注入 windowsHide: true 杜绝黑框！
      child_process.exec(
        args.cmd,
        {
          cwd: WORKSPACE_DIR,
          windowsHide: true,
          timeout: 60000,
        },
        (err, stdout, stderr) => {
          resolve(stdout || stderr || (err ? err.message : "执行完成"));
        }
      );
    });
  }
}
```

### 2. 受控文件沙箱读取与原子写保护
```javascript
if (name === "read_file") {
  const safePath = path.resolve(WORKSPACE_DIR, args.path);
  // 沙箱防穿越检查
  if (!safePath.startsWith(WORKSPACE_DIR)) {
    return "安全沙箱阻断：禁止访问工作区外部路径！";
  }
  return fs.readFileSync(safePath, "utf-8");
}
```

---

## ④ 避坑指南与最佳实践 (Troubleshooting & Best Practices)

1. **死循环熔断保护**：ReAct 循环必须设置 `MAX_TURNS`（建议为 5 轮），超过上限后强制中断并提示用户人工介入；
2. **命令超时阻断**：所有外部 Shell 执行必须注入 `timeout: 60000`（控制在 60 秒内），防止交互式命令（如等待用户输入的 `git commit`）导致守护进程卡死；
3. **输出体积截断**：若命令输出超过 20KB（如全量 `npm install` 日志），应自动截取前后关键行，防止大量输出耗尽 LLM 上下文窗口。
