---
name: data-analysis
description: 数据分析全流程编排：拆题→探Schema→写SQL→校验→执行→产出分析报告
---

# 数据分析技能

回答数据问题时遵循以下流程：

1. **拆题**：明确要查的指标、维度、时间范围、过滤条件。
2. **探 Schema**：先 `list_tables`，再对目标表 `describe_tables` 确认字段，禁止凭记忆写 SQL。
3. **术语对齐**：遇到业务术语先 `lookup_glossary` 取标准口径。
4. **写 SQL**：只写只读 SELECT；聚合交给 SQL，最终标量用 calculate。
5. **执行**：`execute_sql` 会自动做安全校验、数据权限过滤、脱敏；失败按错误修正重试。
6. **产出**：给出结构化中文分析结论，必要时出图表。
