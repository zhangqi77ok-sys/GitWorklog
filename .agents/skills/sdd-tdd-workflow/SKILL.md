---
name: sdd-tdd-workflow
description: >-
  Enforce Spec-Driven Development (SDD) and Test-Driven Development (TDD) before writing, modifying,
  or refactoring any code. Mandates defining specifications/contracts first and writing failing tests
  (Red) before writing minimal implementation code (Green) and refactoring (Dual Iron-Man).
---

# SDD + TDD 规范与测试驱动开发规约 (Mandatory Code Workflow)

本规约是本项目所有代码编写、接口设计、业务功能实现与 Bug 修复的**最高级别强制规范**。
**严禁先写实现代码后补测试，严禁无规范直接输出代码！**

---

## 📐 阶段一：SDD 规范驱动设计 (Spec-Driven Development)

在敲下任何一行业务代码之前，必须先产出**《功能技术规范与契约文档 (Spec Contract)》**：

### 1. 需求与边界定义 (Scope & Boundaries)
- 明确本轮需求解决的核心问题与不解决的问题（Out of Scope）；
- 识别并列出所有边界条件（空值、超大并发、网络断开、系统权限、脏数据）。

### 2. 接口与数据契约 (Data Contracts & Interfaces)
- 定义精确的 TypeScript / Rust 数据模型（Interface、Type、Enum）；
- 明确方法签名、入参约束、返回类型与异常抛出类型；
- 遵循单一职责（SRP）与高内聚低耦合的积木式模块设计。

---

## 🧪 阶段二：TDD 测试驱动开发 (Test-Driven Development)

在确认 Spec 契约后，必须严格遵循经典的 **红 (Red) → 绿 (Green) → 重构 (Refactor)** 三步节拍：

```
[1. Red: 编写前置测试]
         ↓
  运行测试确认其失败 (Fail)
         ↓
[2. Green: 编写最简实现]
         ↓
  运行测试确认全绿通过 (Pass)
         ↓
[3. Refactor: 优化与重构]
         ↓
  触发双向钢人审查，保证测试依然全绿
```

### 1. 🔴 红灯阶段 (Red: Write Tests First)
- 编写覆盖率至少包含：
  - **Happy Path**（标准成功用例）；
  - **Edge Cases**（边界与极限用例）；
  - **Error Path**（预期异常与防御断言）。
- **必须先执行测试验证其失败**，证明测试用例有效且非空断言。

### 2. 🟢 绿灯阶段 (Green: Minimal Implementation)
- 编写刚好能够让测试全部通过的最小化代码；
- 杜绝过度设计（Over-Engineering）、杜绝未经验证的预先假想抽象；
- 保持代码简练、可读、直观。

### 3. 🔵 重构与双向钢人审查 (Refactor: Dual Iron-Man Review)
- **Builder (蓝军建设者)**：清理代码坏味道，消除重复，提升性能；
- **Critic (红军质询者)**：审查是否存在过度封装、死锁隐患或安全性缺陷；
- 确保重构完成后所有测试依然保持 100% 绿灯。

---

## 🚀 落地验证核对清单 (Execution Checklist)

每次完成代码编写时，必须在回复中显式附带以下 SDD+TDD 验证表格：

| 步骤 | 状态 | 交付物 / 命令结果 |
| :--- | :--- | :--- |
| **1. SDD 规范契约** | [x] 已定义 | 输入/输出/异常接口已完成定义 |
| **2. TDD 红灯验证** | [x] 已触发 | 编写了前置测试，并确认初始执行失败 (Red) |
| **3. TDD 绿灯验证** | [x] 已通过 | 编写实现代码，执行测试全绿 (Green, 100% Passed) |
| **4. 双向钢人审查** | [x] 已完成 | 无过度封装，积木式解耦，架构清晰 |
