# GitWorklog

GitWorklog 当前仓库已切换为新的产品方向：`Loop 工程化产品`。

这个项目的目标不是继续原来的日报工具，而是构建一个面向 AI 编码任务的 `Loop Control Plane`，用任务而不是会话作为核心对象，用策略和审核流控制自动化边界，用证据和回放支撑整个闭环。

## 当前仓库内容

- `docs/loop-engineering-architecture-v1.md`
  Loop 工程化产品架构总纲
- `docs/v1-development-task-breakdown.md`
  v1 开发任务拆解清单
- `docs/database-schema-v1.sql`
  v1 数据库表 SQL 草案
- `docs/api-and-ipc-contracts-v1.md`
  v1 首批 API / IPC 接口定义
- `apps/`
  应用层骨架
- `packages/`
  核心能力包骨架

## 工程结构

```text
apps/
  desktop/      Electron 桌面壳
  web/          React 控制台

packages/
  shared-types/ 共享类型
  db/           数据库 schema 与数据访问层入口
  core/         Loop Runtime 与状态机入口
  connectors/   Codex 接入层接口
  evidence/     证据系统入口
  analyzers/    分析器入口
  policy/       策略和审核流入口
  action-engine/动作执行入口
```

## 本地开发

当前仓库已经具备 Monorepo 基础骨架。默认推荐一键启动桌面端，它会先构建 packages、构建 Web 控制台，再打开 Electron 窗口。

```bash
npm install
npm run dev
```

仓库内置了 Electron 下载镜像配置，避免桌面端依赖在国内网络下长时间卡在 postinstall。

如果只想运行 Web 控制台：

```bash
npm run dev:web
```

桌面端当前会加载本地构建后的 Web 控制台；后续再把 `DesktopAppService` 挂到真实 IPC 通道。

## 开发优先级

建议顺序：

1. 先完成数据库层和共享类型
2. 再接入 Codex Session Discovery
3. 再做 Loop Runtime 与 Evidence 主链
4. 最后补分析器、策略和审核流

## 说明

当前仓库是新方向起点版本，旧项目内容已按要求清理。
