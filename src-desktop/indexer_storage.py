import os
import sqlite3
import hashlib
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional, Dict, Any


@dataclass
class FileRecord:
    id: Optional[int]
    path: str
    content_hash: str
    signature_hash: str
    indexed_at: int
    is_deleted: bool = False


@dataclass
class SymbolRecord:
    file_id: int
    name: str
    container_name: Optional[str]
    kind: str  # Class, Function, Interface, Method, Variable, Type
    range_start_line: int
    range_start_col: int
    range_end_line: int
    range_end_col: int
    signature: Optional[str] = None
    doc_comment: Optional[str] = None
    is_exported: bool = False
    id: Optional[int] = None


@dataclass
class SymbolReferenceRecord:
    caller_symbol_id: Optional[int]
    callee_symbol_id: int
    caller_file_id: int
    line: int
    col: int
    reference_kind: str = "call"  # call, implements, extends, imports, type_ref
    id: Optional[int] = None


from contextlib import contextmanager


class IndexerStorage:
    """SQLite WAL-based high-performance local storage for code symbols and call topologies."""

    def __init__(self, db_path: Path | str):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(str(self.db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA synchronous = NORMAL;")
            conn.execute("PRAGMA foreign_keys = ON;")
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            # 1. files table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT NOT NULL UNIQUE,
                    content_hash TEXT NOT NULL,
                    signature_hash TEXT NOT NULL,
                    indexed_at INTEGER NOT NULL,
                    is_deleted INTEGER DEFAULT 0
                );
            """)

            # 2. symbols table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS symbols (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    container_name TEXT,
                    kind TEXT NOT NULL,
                    range_start_line INTEGER NOT NULL,
                    range_start_col INTEGER NOT NULL,
                    range_end_line INTEGER NOT NULL,
                    range_end_col INTEGER NOT NULL,
                    signature TEXT,
                    doc_comment TEXT,
                    is_exported INTEGER DEFAULT 0,
                    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
                );
            """)

            # 3. symbol_references table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS symbol_references (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    caller_symbol_id INTEGER,
                    callee_symbol_id INTEGER NOT NULL,
                    caller_file_id INTEGER NOT NULL,
                    line INTEGER NOT NULL,
                    col INTEGER NOT NULL,
                    reference_kind TEXT NOT NULL,
                    FOREIGN KEY(caller_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
                    FOREIGN KEY(callee_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
                    FOREIGN KEY(caller_file_id) REFERENCES files(id) ON DELETE CASCADE
                );
            """)

            # 4. FTS5 Virtual Table for Symbols
            conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
                    name,
                    container_name,
                    signature,
                    doc_comment,
                    content='symbols',
                    content_rowid='id',
                    tokenize='unicode61 remove_diacritics 2'
                );
            """)

            # Triggers to keep FTS in sync
            conn.execute("""
                CREATE TRIGGER IF NOT EXISTS symbols_ai AFTER INSERT ON symbols BEGIN
                    INSERT INTO symbols_fts(rowid, name, container_name, signature, doc_comment)
                    VALUES (new.id, new.name, new.container_name, new.signature, new.doc_comment);
                END;
            """)
            conn.execute("""
                CREATE TRIGGER IF NOT EXISTS symbols_ad AFTER DELETE ON symbols BEGIN
                    INSERT INTO symbols_fts(symbols_fts, rowid, name, container_name, signature, doc_comment)
                    VALUES('delete', old.id, old.name, old.container_name, old.signature, old.doc_comment);
                END;
            """)
            conn.execute("""
                CREATE TRIGGER IF NOT EXISTS symbols_au AFTER UPDATE ON symbols BEGIN
                    INSERT INTO symbols_fts(symbols_fts, rowid, name, container_name, signature, doc_comment)
                    VALUES('delete', old.id, old.name, old.container_name, old.signature, old.doc_comment);
                    INSERT INTO symbols_fts(rowid, name, container_name, signature, doc_comment)
                    VALUES (new.id, new.name, new.container_name, new.signature, new.doc_comment);
                END;
            """)

            # Indices
            conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_name_kind ON symbols(name, kind);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_refs_caller ON symbol_references(caller_symbol_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_refs_callee ON symbol_references(callee_symbol_id);")

            # 5. code_lineage table (AI Lineage & Provenance Metadata)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS code_lineage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL,
                    line_start INTEGER NOT NULL,
                    line_end INTEGER NOT NULL,
                    author_type TEXT NOT NULL,
                    model_id TEXT,
                    prompt_hash TEXT,
                    prompt_preview TEXT,
                    approved_by TEXT,
                    approval_timestamp INTEGER,
                    license_risk TEXT DEFAULT 'SAFE',
                    checkpoint_ref TEXT,
                    created_at INTEGER NOT NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_lineage_file ON code_lineage(file_path);")

            # 6. audit_events table (Compliance Audit Trail)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    event_type TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    metadata_json TEXT,
                    timestamp INTEGER NOT NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_events(timestamp DESC);")

    def upsert_file(self, path: str, content_hash: str, signature_hash: str) -> int:
        import time
        now = int(time.time() * 1000)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO files (path, content_hash, signature_hash, indexed_at, is_deleted)
                VALUES (?, ?, ?, ?, 0)
                ON CONFLICT(path) DO UPDATE SET
                    content_hash = excluded.content_hash,
                    signature_hash = excluded.signature_hash,
                    indexed_at = excluded.indexed_at,
                    is_deleted = 0
            """, (path, content_hash, signature_hash, now))
            
            cursor.execute("SELECT id FROM files WHERE path = ?", (path,))
            row = cursor.fetchone()
            file_id = row["id"]
            
            # Clean old symbols and references for this file on re-index
            cursor.execute("DELETE FROM symbols WHERE file_id = ?", (file_id,))
            cursor.execute("DELETE FROM symbol_references WHERE caller_file_id = ?", (file_id,))
            return file_id

    def get_file_record(self, path: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM files WHERE path = ? AND is_deleted = 0", (path,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def batch_insert_symbols(self, symbol_records: List[SymbolRecord]) -> List[int]:
        if not symbol_records:
            return []
        ids = []
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for s in symbol_records:
                cursor.execute("""
                    INSERT INTO symbols (
                        file_id, name, container_name, kind,
                        range_start_line, range_start_col, range_end_line, range_end_col,
                        signature, doc_comment, is_exported
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    s.file_id, s.name, s.container_name, s.kind,
                    s.range_start_line, s.range_start_col, s.range_end_line, s.range_end_col,
                    s.signature, s.doc_comment, 1 if s.is_exported else 0
                ))
                ids.append(cursor.lastrowid)
        return ids

    def batch_insert_references(self, references: List[SymbolReferenceRecord]) -> None:
        if not references:
            return
        with self._get_connection() as conn:
            cursor = conn.cursor()
            for r in references:
                cursor.execute("""
                    INSERT INTO symbol_references (
                        caller_symbol_id, callee_symbol_id, caller_file_id, line, col, reference_kind
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    r.caller_symbol_id, r.callee_symbol_id, r.caller_file_id, r.line, r.col, r.reference_kind
                ))

    def search_symbols(self, query: str, kind: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        clean_q = query.strip()
        if not clean_q:
            return []

        with self._get_connection() as conn:
            cursor = conn.cursor()
            results = []
            
            # 1. Try FTS5 match first
            try:
                fts_query = f'"{clean_q}"*'
                if kind:
                    sql = """
                        SELECT s.*, f.path as file_path
                        FROM symbols_fts fts
                        JOIN symbols s ON fts.rowid = s.id
                        JOIN files f ON s.file_id = f.id
                        WHERE symbols_fts MATCH ? AND s.kind = ? AND f.is_deleted = 0
                        ORDER BY rank
                        LIMIT ?
                    """
                    cursor.execute(sql, (fts_query, kind, limit))
                else:
                    sql = """
                        SELECT s.*, f.path as file_path
                        FROM symbols_fts fts
                        JOIN symbols s ON fts.rowid = s.id
                        JOIN files f ON s.file_id = f.id
                        WHERE symbols_fts MATCH ? AND f.is_deleted = 0
                        ORDER BY rank
                        LIMIT ?
                    """
                    cursor.execute(sql, (fts_query, limit))
                rows = cursor.fetchall()
                results = [dict(r) for r in rows]
            except Exception:
                results = []

            # 2. Fallback to LIKE if FTS produced 0 results or syntax issue
            if not results:
                like_term = f"%{clean_q}%"
                if kind:
                    sql = """
                        SELECT s.*, f.path as file_path
                        FROM symbols s
                        JOIN files f ON s.file_id = f.id
                        WHERE (s.name LIKE ? OR s.container_name LIKE ?) AND s.kind = ? AND f.is_deleted = 0
                        LIMIT ?
                    """
                    cursor.execute(sql, (like_term, like_term, kind, limit))
                else:
                    sql = """
                        SELECT s.*, f.path as file_path
                        FROM symbols s
                        JOIN files f ON s.file_id = f.id
                        WHERE (s.name LIKE ? OR s.container_name LIKE ?) AND f.is_deleted = 0
                        LIMIT ?
                    """
                    cursor.execute(sql, (like_term, like_term, limit))
                rows = cursor.fetchall()
                results = [dict(r) for r in rows]

            return results

    def get_symbol_subgraph(self, symbol_id: int, depth: int = 2) -> Dict[str, Any]:
        """Extract 1~2 hop caller and callee topology using recursive Common Table Expressions (CTE)."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Root symbol
            cursor.execute("""
                SELECT s.*, f.path as file_path
                FROM symbols s
                JOIN files f ON s.file_id = f.id
                WHERE s.id = ?
            """, (symbol_id,))
            root = cursor.fetchone()
            if not root:
                return {"root_symbol": None, "callers": [], "callees": []}

            # Upstream Callers via CTE
            cursor.execute("""
                WITH RECURSIVE CallerTree AS (
                    SELECT 
                        s.id AS symbol_id,
                        s.name,
                        s.kind,
                        s.signature,
                        f.path AS file_path,
                        s.range_start_line,
                        0 AS depth
                    FROM symbols s
                    JOIN files f ON s.file_id = f.id
                    WHERE s.id = ?

                    UNION ALL

                    SELECT 
                        caller.id,
                        caller.name,
                        caller.kind,
                        caller.signature,
                        cf.path,
                        caller.range_start_line,
                        ct.depth + 1
                    FROM symbol_references ref
                    JOIN symbols caller ON ref.caller_symbol_id = caller.id
                    JOIN files cf ON caller.file_id = cf.id
                    JOIN CallerTree ct ON ref.callee_symbol_id = ct.symbol_id
                    WHERE ct.depth < ?
                )
                SELECT DISTINCT * FROM CallerTree WHERE depth > 0 ORDER BY depth ASC;
            """, (symbol_id, depth))
            caller_rows = cursor.fetchall()

            # Downstream Callees via CTE
            cursor.execute("""
                WITH RECURSIVE CalleeTree AS (
                    SELECT 
                        s.id AS symbol_id,
                        s.name,
                        s.kind,
                        s.signature,
                        f.path AS file_path,
                        s.range_start_line,
                        0 AS depth
                    FROM symbols s
                    JOIN files f ON s.file_id = f.id
                    WHERE s.id = ?

                    UNION ALL

                    SELECT 
                        callee.id,
                        callee.name,
                        callee.kind,
                        callee.signature,
                        cf.path,
                        callee.range_start_line,
                        ct.depth + 1
                    FROM symbol_references ref
                    JOIN symbols callee ON ref.callee_symbol_id = callee.id
                    JOIN files cf ON callee.file_id = cf.id
                    JOIN CalleeTree ct ON ref.caller_symbol_id = ct.symbol_id
                    WHERE ct.depth < ?
                )
                SELECT DISTINCT * FROM CalleeTree WHERE depth > 0 ORDER BY depth ASC;
            """, (symbol_id, depth))
            callee_rows = cursor.fetchall()

            return {
                "root_symbol": dict(root),
                "callers": [dict(r) for r in caller_rows],
                "callees": [dict(r) for r in callee_rows]
            }

    def get_status(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as cnt FROM files WHERE is_deleted = 0")
            total_files = cursor.fetchone()["cnt"]

            cursor.execute("SELECT COUNT(*) as cnt FROM symbols")
            total_symbols = cursor.fetchone()["cnt"]

            cursor.execute("SELECT COUNT(*) as cnt FROM symbol_references")
            total_refs = cursor.fetchone()["cnt"]

            db_size = 0
            if self.db_path.exists():
                db_size = self.db_path.stat().st_size

            return {
                "total_files": total_files,
                "total_symbols": total_symbols,
                "total_references": total_refs,
                "db_size_bytes": db_size
            }

    def get_workspace_graph(self, limit: int = 150, kind: Optional[str] = None) -> Dict[str, Any]:
        """Aggregate high-level nodes and edges for whole-workspace force-directed graph view."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Fetch nodes
            if kind:
                cursor.execute("""
                    SELECT s.id, s.name, s.kind, s.container_name, s.signature, f.path as file_path, s.range_start_line
                    FROM symbols s
                    JOIN files f ON s.file_id = f.id
                    WHERE s.kind = ? AND f.is_deleted = 0
                    ORDER BY s.id ASC
                    LIMIT ?
                """, (kind, limit))
            else:
                cursor.execute("""
                    SELECT s.id, s.name, s.kind, s.container_name, s.signature, f.path as file_path, s.range_start_line
                    FROM symbols s
                    JOIN files f ON s.file_id = f.id
                    WHERE f.is_deleted = 0
                    ORDER BY s.id ASC
                    LIMIT ?
                """, (limit,))
            nodes = [dict(r) for r in cursor.fetchall()]
            node_ids = {n["id"] for n in nodes}

            if not node_ids:
                return {"nodes": [], "edges": []}

            # Fetch edges connecting these nodes
            placeholders = ",".join("?" for _ in node_ids)
            cursor.execute(f"""
                SELECT r.id, r.caller_symbol_id as source, r.callee_symbol_id as target, r.reference_kind as relation
                FROM symbol_references r
                WHERE r.caller_symbol_id IN ({placeholders}) AND r.callee_symbol_id IN ({placeholders})
                LIMIT 500
            """, list(node_ids) + list(node_ids))
            edges = [dict(r) for r in cursor.fetchall()]

            return {
                "nodes": nodes,
                "edges": edges
            }

    def get_blast_radius(self, symbol_id: int, max_hops: int = 2) -> Dict[str, Any]:
        """Compute the ripple impact (Blast Radius) when a core symbol is modified using recursive CTE."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Root symbol
            cursor.execute("""
                SELECT s.*, f.path as file_path
                FROM symbols s
                JOIN files f ON s.file_id = f.id
                WHERE s.id = ?
            """, (symbol_id,))
            root = cursor.fetchone()
            if not root:
                return {"root_symbol": None, "impacted_nodes": []}

            # Recursive Upstream Impact Tree (Who is impacted if I change?)
            cursor.execute("""
                WITH RECURSIVE BlastTree AS (
                    SELECT 
                        s.id AS symbol_id,
                        s.name,
                        s.kind,
                        f.path AS file_path,
                        s.range_start_line,
                        0 AS hop
                    FROM symbols s
                    JOIN files f ON s.file_id = f.id
                    WHERE s.id = ?

                    UNION ALL

                    SELECT 
                        caller.id,
                        caller.name,
                        caller.kind,
                        cf.path,
                        caller.range_start_line,
                        bt.hop + 1
                    FROM symbol_references ref
                    JOIN symbols caller ON ref.caller_symbol_id = caller.id
                    JOIN files cf ON caller.file_id = cf.id
                    JOIN BlastTree bt ON ref.callee_symbol_id = bt.symbol_id
                    WHERE bt.hop < ?
                )
                SELECT DISTINCT * FROM BlastTree WHERE hop > 0 ORDER BY hop ASC;
            """, (symbol_id, max_hops))
            impact_rows = cursor.fetchall()

            # Classify impact severity based on hop distance and number of downstream dependents
            impacted_nodes = []
            for r in impact_rows:
                node_dict = dict(r)
                hop = node_dict["hop"]
                node_dict["severity"] = "CRITICAL" if hop == 1 else ("HIGH" if hop == 2 else "MODERATE")
                impacted_nodes.append(node_dict)

            return {
                "root_symbol": dict(root),
                "impacted_nodes": impacted_nodes,
                "total_impacted": len(impacted_nodes)
            }

    def insert_code_lineage(self, record: Dict[str, Any]) -> int:
        import time
        now = int(time.time() * 1000)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO code_lineage (
                    file_path, line_start, line_end, author_type, model_id,
                    prompt_hash, prompt_preview, approved_by, approval_timestamp,
                    license_risk, checkpoint_ref, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.get("file_path"),
                record.get("line_start", 1),
                record.get("line_end", 1),
                record.get("author_type", "AI_AGENT"),
                record.get("model_id"),
                record.get("prompt_hash"),
                record.get("prompt_preview"),
                record.get("approved_by"),
                record.get("approval_timestamp", now),
                record.get("license_risk", "SAFE"),
                record.get("checkpoint_ref"),
                now
            ))
            return cursor.lastrowid

    def get_code_lineage_for_file(self, file_path: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM code_lineage
                WHERE file_path = ?
                ORDER BY line_start ASC
            """, (file_path,))
            return [dict(r) for r in cursor.fetchall()]

    def insert_audit_event(self, event: Dict[str, Any]) -> int:
        import time
        now = int(time.time() * 1000)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO audit_events (
                    session_id, event_type, actor, summary, metadata_json, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                event.get("session_id"),
                event.get("event_type", "AUDIT_LOG"),
                event.get("actor", "AI_AGENT"),
                event.get("summary", ""),
                event.get("metadata_json", "{}"),
                event.get("timestamp", now)
            ))
            return cursor.lastrowid

    def get_audit_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM audit_events
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))
            return [dict(r) for r in cursor.fetchall()]
