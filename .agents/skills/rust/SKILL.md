---
name: rust
description: >-
  Principal Rust Systems Engineer specializing in Tauri v2 native core, Tokio async runtime, IPC commands, and systems safety.
  Must be consulted first before creating or modifying any Rust files, Cargo configurations, Tauri commands, or system integrations.
  Enforces memory safety, zero-copy I/O, robust error handling (Result/thiserror), headless subprocess execution,
  file path sandboxing, and shadow Git checkpointing.
---

# Rust 原生内核与系统架构专业规约 (Rust Skill)

本技能为 Tcode 桌面端底层内核与跨平台系统集成的**最高工程准则**。在进行任何 `src-tauri` 下的代码编写、Rust 模块扩展、IPC 接口定义、外部进程调用或安全沙箱修改前，必须优先查阅本规约。

---

## 🦀 1. Rust 现代工程与内存安全基线 (Rust Core Principles)

### 1.1 零不安全代码与内存保证
- 100% 遵循 Safe Rust 原则，严禁在无物理硬件驱动场景下滥用 `unsafe`；
- 善用所有权（Ownership）与借用检查（Borrow Checker），杜绝不必要的内存分配与深拷贝（Deep Clone）；
- 对字符串与切片优先使用 `&str` 与 `Cow<'a, str>` 借用。

### 1.2 严格错误处理规范 (Result & thiserror)
- **绝对严禁在生产代码中使用 `unwrap()` 或 `expect()`**（除非在单元测试中）；
- 定义强类型错误枚举：
  ```rust
  #[derive(thiserror::Error, Debug)]
  pub enum TcodeError {
      #[error("文件系统访问越权: {0}")]
      SandboxViolation(String),
      #[error("外部命令执行超时: {0}")]
      ProcessTimeout(String),
      #[error("IO 错误: {0}")]
      Io(#[from] std::io::Error),
      #[error("序列化异常: {0}")]
      Serialization(#[from] serde_json::Error),
  }
  ```
- 所有对外暴露的 Tauri 命令必须返回 `Result<T, String>` 或强类型序列化错误对象。

---

## ⚡ 2. Tokio 异步运行时与高并发 (Async Tokio Concurrency)

1. **非阻塞长任务**：
   - 严禁在异步任务中直接调用阻塞式 IO（如 `std::thread::sleep` 或阻塞式网络请求）；
   - 长时间计算或密集构建任务必须使用 `tokio::task::spawn_blocking` 移入专用线程池；
2. **多进程与管道通信**：
   - 调用外部编译器、Git 或 Shell 时，使用 `tokio::process::Command`；
   - 必须配置 Windows 平台专属标志：
     ```rust
     #[cfg(target_os = "windows")]
     use std::os::windows::process::CommandExt;
     const CREATE_NO_WINDOW: u32 = 0x08000000;
     cmd.creation_flags(CREATE_NO_WINDOW);
     ```
   - 彻底消灭黑色控制台闪烁弹窗。

---

## 🔌 3. Tauri v2 原生 IPC 与强类型数据契约 (Tauri v2 IPC)

1. **命令强类型序列化**：
   - 所有 IPC 命令入参和出参必须通过 `serde::{Serialize, Deserialize}` 实现完整强类型映射；
   - 严禁传递模糊的无结构文本或未校验的原始指针；
2. **事件流推送 (Event Emitter)**：
   - 大模型流式思考块与生成内容，通过轻量级 `app_handle.emit("agent_thought_chunk", ...)` 与 `agent_text_chunk` 广播；
   - 每次推送保持合适的数据包粒度，避免频繁微小 IO 耗尽 WebView 消息总线。

---

## 🛡️ 4. 路径沙箱与数据防御 (Path Sandboxing & Protection)

1. **绝对路径与相对路径校验**：
   - 在执行任何读写、删除或扫描前，必须将目标路径解析为规范绝对路径（Canonicalize）；
   - 严格比对工作区白名单目录，拦截任何形式的 `../` 路径穿越越权行为；
2. **自动影子快照机制 (Shadow Checkpoints)**：
   - 在 Agent 自动修改任何用户文件前，内核自动触发 Git 影子提交快照（`refs/tcode/checkpoints/...`）；
   - 确保即使 Agent 生成错误代码，用户也能在 1 秒内一键无损还原（Rollback）。
