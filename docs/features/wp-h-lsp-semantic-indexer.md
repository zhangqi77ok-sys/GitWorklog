# PRD 增量：WP-H 工业级 LSP 语义索引架构（Tcode 定制版）

> 需求-原型-开发三位一体：本 PRD 与 `prototype/` 交互原型强同步。
> 状态: Ready for Implementation (v1.0)

---

## 1. 背景与目标

在复杂软件工程场景中，Agent 面临代码库庞大、同名符号繁多、跨文件多态继承关系复杂的现实挑战：
- **单纯 AST 语法解析**：无法感知跨文件语义、类型推导与泛型指向；
- **单纯向量文本检索**：语义幻觉多，无法精确分析调用链（Call Graph）与重构影响范围；
- **单纯实时 LSP 轮询**：高并发全库搜索易引发进程 OOM 或响应超时。

**目标**：为 Tcode 打造 **「LSP 语义事实源 + 增量流水线 + SQLite 本地检索与图拓扑」** 三层协同代码智能引擎，提供毫秒级多维检索与编译器级精准认知。

---

## 2. 架构规范与核心契约 (Spec)

### 2.1 SQLite 物理表结构 (`.tcode/index/semantic_index.db`)
- `files`：记录路径、Blake3 内容指纹 `content_hash`、导出接口签名指纹 `signature_hash`、时间戳；
- `symbols`：符号唯一 ID、文件 ID、符号名、容器名（类/模块）、符号类型（Kind: Class/Function/Interface/Method/Variable）、行列范围、签名、Docstring 注释；
- `symbol_references`：调用与继承关联表（`caller_symbol_id`, `callee_symbol_id`, `caller_file_id`, `line`, `col`, `reference_kind`）；
- `symbols_fts`：SQLite FTS5 虚表，支持 unicode61 分词与全文字段模糊索引。

### 2.2 宿主 RESTful API 契约 (`127.0.0.1:8010`)
1. `POST /api/index/sync`
   - 入参：`{ "force": boolean, "file_paths": string[] }`
   - 返回：`{ "status": "success", "indexed_files": number, "symbols_count": number, "duration_ms": number }`
2. `GET /api/index/search`
   - 参数：`q` (关键词), `kind` (可选过滤), `limit` (默认 20)
   - 返回：`{ "status": "success", "results": [ { "id": 1, "name": "foo", "kind": "Function", "filePath": "src/a.ts", "line": 10, "signature": "() => void", "container": "Bar" } ] }`
3. `GET /api/index/subgraph`
   - 参数：`symbol_id` (目标符号 ID), `depth` (遍历深度，默认 2)
   - 返回：`{ "status": "success", "root_symbol": {...}, "callers": [...], "callees": [...], "types": [...] }`
4. `GET /api/index/status`
   - 返回：`{ "status": "success", "total_files": number, "total_symbols": number, "total_references": number, "db_size_bytes": number, "last_synced_at": number }`

---

## 3. 容错与三级降级策略
- **Tier 1 (全保真模式)**：LSP Client 获取精准定义与调用链，SQLite 落地拓扑；
- **Tier 2 (语法降级模式)**：LSP 超时 (>3s) 或缺失运行时，由 Fast-Path AST 正则提取符号签名与外形入库；
- **Tier 3 (基线文本搜索)**：利用宿主内置高速正则进行文本定位，保障绝对可用性。
