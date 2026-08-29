# CodeMind-Hub

新一代开源极简 AI 编程桌面工作台 (Cursor-Alternative Native Desktop IDE)。

当前阶段处于：**Phase 0 - 产品需求定义与前端 UI/UX 原型验证阶段**。

---

## 📂 仓库结构规约 (Repository Layout)

按照规范，本项目将**产品需求文档**与**交互式原型工程**严格隔离存放于各自独立的专属目录下：

```
e:/pro/agent-learning/
├── docs/                       # 📋 需求规约目录 (All Requirements & Specs)
│   ├── PRODUCT_REQUIREMENTS_DOCUMENT.md   # 全景 PRD 终极精粹整合版
│   └── ARCHITECTURE.md                    # 架构全景设计规范
│
├── prototype/                  # 🎨 前端 UI/UX 交互式原型工程 (Interactive Prototype)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/                    # 原型组件 (Titlebar, LeftPanel, ChatColumn, EditorWorkspace)
│   └── tests/                  # 原型契约自动化测试 (Vitest)
│
├── .agents/                    # 🤖 智能体研发流程与规范治理
├── AGENTS.md                   # 📜 团队核心协作铁律
└── README.md                   # 📖 项目总览
```

---

## 🚀 启动与体验原型 (Run Prototype)

交互式原型已独立封装于 `prototype/` 目录下，可直接运行：

```bash
cd prototype
npm install
npm run dev
```

执行原型自动化测试：
```bash
cd prototype
npm test
```
