# 开发流程

## 1. 环境准备

```bash
python -m venv .venv
source .venv/Scripts/activate        # Windows Git Bash
pip install -e ".[dev]"
pre-commit install                   # 装提交钩子
docker compose up -d                 # 起基础设施
cp .env.example .env                 # 填配置
```

## 2. 开发一个功能点

1. 在 `docs/FEATURE_CATALOG.md` 找到功能点 ID，状态改 🟡。
2. 对照 `docs/DIRECTORY_GUIDE.md` 确认代码落点。
3. 遵循 `docs/CODING_STANDARDS.md` 编码，配测试。
4. `make check` 全绿。
5. 提交（见 §4），功能点状态改 ✅。

## 3. 分支策略

- `master`：稳定主干，不直接提交。
- 功能分支：`feat/<域>-<简述>`，如 `feat/data-sql-guard`。
- 修复分支：`fix/<简述>`。
- 合并前 rebase 到最新 master，保持线性历史。

## 4. 提交信息规范（Conventional Commits）

```
<type>(<scope>): <简述>

type: feat / fix / docs / refactor / test / chore
scope: core / platform / travel / data / orchestrator / api
```

示例：
```
feat(data): 实现 SqlSafetyGuard 白名单与强制 LIMIT (D-5)
fix(auth): 修复 JWT 过期时间计算 (P1-A1)
docs: 补充目录职责指南
```

- 关联功能点 ID 写进括号，便于追溯。
- 一次提交只做一件事。

## 5. 提交前检查（自动 + 手动）

- 自动（pre-commit）：ruff fix + format、mypy、大文件/私钥检测。
- 手动：`make check`（lint + typecheck + test）。
- **禁止提交**：`.env`、密钥、大二进制、未通过测试的代码。

## 6. 代码评审要点

- 依赖方向是否合规（无跨域/反向依赖）。
- 通用能力是否误放进域（应在 platform）。
- SQL/权限/密钥相关是否有测试与脱敏。
- 是否更新了 FEATURE_CATALOG 状态。

## 7. 数据库变更

- 改 ORM 模型后生成迁移：`alembic revision --autogenerate -m "..."`。
- 审查生成的迁移脚本再 `alembic upgrade head`。
- 迁移脚本入库，不手改线上表结构。

## 8. 阶段推进

按 `docs/FEATURE_CATALOG.md` 的阶段顺序推进：0→1→2→3→4→5。
阶段 1（平台底座）是关键路径，先稳。阶段 2/3 可并行。
每阶段有明确验收（见融合规划 §8）。
