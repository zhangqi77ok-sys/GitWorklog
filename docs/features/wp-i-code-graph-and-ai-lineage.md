# PRD 增量：WP-I 代码语义图谱与 AI 代码血缘合规审计链（Tcode 定制版）

> 需求-原型-开发三位一体：本 PRD 与 `prototype/` 交互原型强同步。
> 状态: Ready for Implementation (v1.0)

---

## 1. 背景与目标

随着企业级 AI 编码智能体深入生产环境，研发与合规团队面临两大核心诉求：
1. **全局架构认知与重构影响面分析**：在修改核心模块时，需要一目了然地洞察 **爆炸半径 (Blast Radius)** 与全链路调用拓扑，防止遗漏下游改动；
2. **AI 代码血缘与合规审计**：对 AI 生成的每一行代码做到 **责任可追溯 (Who, When, Model, Prompt)**、**门禁有审批 (Stage Gate Approval)**、**合规有防线 (GPL 许可证风险扫描)** 与 **后悔有药 (Git Checkpoint 秒级回退)**。

---

## 2. 核心规约与数据模型 (Spec)

### 2.1 SQLite 物理表结构 (`.tcode/index/semantic_index.db`)
- `code_lineage`：记录行级/Hunk 级血缘元数据（`file_path`, `line_start`, `line_end`, `author_type`, `model_id`, `prompt_hash`, `prompt_preview`, `approved_by`, `approval_timestamp`, `license_risk`, `checkpoint_ref`, `created_at`）；
- `audit_events`：记录关键审计事件（`session_id`, `event_type`, `actor`, `summary`, `metadata_json`, `timestamp`）。

### 2.2 宿主 RESTful API 契约 (`127.0.0.1:8010`)
1. `GET /api/graph/workspace`
   - 查询全工作区核心节点（Nodes）与关联边（Edges）；
2. `GET /api/graph/blast_radius?symbol_id=xxx&hops=2`
   - 递归 CTE 计算目标符号的受影响节点集合及波及层级；
3. `GET /api/lineage/file?path=xxx`
   - 获取指定文件的行级 AI 血缘标记；
4. `GET /api/lineage/timeline?limit=50`
   - 获取合规审计时间轴事件列表；
5. `POST /api/lineage/record`
   - 记录一次 AI 代码变更的血缘指纹与审计事件。
