import os
import re
import hashlib
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Set, Tuple

from indexer_storage import IndexerStorage, SymbolRecord, SymbolReferenceRecord

# Supported file extensions for fast/slow indexing
SUPPORTED_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".cpp", ".c", ".h"
}

IGNORED_DIRS = {
    ".git", "node_modules", "dist", "release", "build", "build_temp",
    "__pycache__", ".pytest_cache", ".tcode", ".codemind", ".vscode"
}


class FastAstExtractor:
    """Fast-Path Regex/AST extractor for symbols across TS/JS/Python/Rust."""

    @staticmethod
    def extract_symbols_and_signatures(file_path: str, code: str) -> Tuple[List[SymbolRecord], str]:
        ext = Path(file_path).suffix.lower()
        symbols: List[SymbolRecord] = []
        exported_sig_parts: List[str] = []

        lines = code.splitlines()
        
        if ext in (".ts", ".tsx", ".js", ".jsx"):
            # Patterns for TS/JS
            # 1. Classes / Interfaces / Types
            class_pattern = re.compile(r'^\s*(export\s+)?(default\s+)?(class|interface|type|enum)\s+([A-Za-z0-9_$]+)')
            # 2. Functions / Methods / Arrow functions
            func_pattern = re.compile(r'^\s*(export\s+)?(default\s+)?(async\s+)?function\s+([A-Za-z0-9_$]+)\s*\((.*?)\)')
            const_func_pattern = re.compile(r'^\s*(export\s+)?(const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(async\s*)?\((.*?)\)\s*=>')
            method_pattern = re.compile(r'^\s*(public\s+|private\s+|protected\s+|static\s+|async\s+)*([A-Za-z0-9_$]+)\s*\((.*?)\)\s*(:\s*([^{;]+))?\s*\{?')

            current_container: Optional[str] = None

            for i, line in enumerate(lines):
                line_no = i + 1
                # Class / Interface
                m_cls = class_pattern.match(line)
                if m_cls:
                    is_exp = bool(m_cls.group(1))
                    kind = m_cls.group(3).capitalize()
                    name = m_cls.group(4)
                    current_container = name
                    symbols.append(SymbolRecord(
                        file_id=0,
                        name=name,
                        container_name=None,
                        kind=kind,
                        range_start_line=line_no,
                        range_start_col=0,
                        range_end_line=line_no,
                        range_end_col=len(line),
                        signature=line.strip(),
                        doc_comment=None,
                        is_exported=is_exp
                    ))
                    if is_exp:
                        exported_sig_parts.append(f"{kind}:{name}")
                    continue

                # Function
                m_fn = func_pattern.match(line)
                if m_fn:
                    is_exp = bool(m_fn.group(1))
                    name = m_fn.group(4)
                    symbols.append(SymbolRecord(
                        file_id=0,
                        name=name,
                        container_name=current_container,
                        kind="Function",
                        range_start_line=line_no,
                        range_start_col=0,
                        range_end_line=line_no,
                        range_end_col=len(line),
                        signature=line.strip(),
                        doc_comment=None,
                        is_exported=is_exp
                    ))
                    if is_exp:
                        exported_sig_parts.append(f"fn:{name}:{m_fn.group(5)}")
                    continue

                # Const Arrow function
                m_c_fn = const_func_pattern.match(line)
                if m_c_fn:
                    is_exp = bool(m_c_fn.group(1))
                    name = m_c_fn.group(3)
                    symbols.append(SymbolRecord(
                        file_id=0,
                        name=name,
                        container_name=current_container,
                        kind="Function",
                        range_start_line=line_no,
                        range_start_col=0,
                        range_end_line=line_no,
                        range_end_col=len(line),
                        signature=line.strip(),
                        doc_comment=None,
                        is_exported=is_exp
                    ))
                    if is_exp:
                        exported_sig_parts.append(f"arrow:{name}")
                    continue

                # Method in Class / Interface
                m_meth = method_pattern.match(line)
                if m_meth and current_container:
                    name = m_meth.group(2)
                    if name not in ("if", "for", "while", "switch", "catch", "constructor"):
                        symbols.append(SymbolRecord(
                            file_id=0,
                            name=name,
                            container_name=current_container,
                            kind="Method",
                            range_start_line=line_no,
                            range_start_col=0,
                            range_end_line=line_no,
                            range_end_col=len(line),
                            signature=line.strip(),
                            doc_comment=None,
                            is_exported=True
                        ))
                        exported_sig_parts.append(f"method:{current_container}.{name}")
                        continue

        elif ext == ".py":
            # Python Classes and defs
            class_py = re.compile(r'^(class)\s+([A-Za-z0-9_]+)(\((.*?)\))?:')
            def_py = re.compile(r'^(\s*)(async\s+)?def\s+([A-Za-z0-9_]+)\s*\((.*?)\)(\s*->\s*(.*?))?:')

            current_container = None
            container_indent = 0

            for i, line in enumerate(lines):
                line_no = i + 1
                m_cls = class_py.match(line)
                if m_cls:
                    name = m_cls.group(2)
                    current_container = name
                    container_indent = len(line) - len(line.lstrip())
                    symbols.append(SymbolRecord(
                        file_id=0,
                        name=name,
                        container_name=None,
                        kind="Class",
                        range_start_line=line_no,
                        range_start_col=0,
                        range_end_line=line_no,
                        range_end_col=len(line),
                        signature=line.strip(),
                        doc_comment=None,
                        is_exported=not name.startswith("_")
                    ))
                    if not name.startswith("_"):
                        exported_sig_parts.append(f"class:{name}")
                    continue

                m_def = def_py.match(line)
                if m_def:
                    indent = len(m_def.group(1))
                    name = m_def.group(3)
                    kind = "Method" if (current_container and indent > container_indent) else "Function"
                    container = current_container if kind == "Method" else None
                    if indent <= container_indent:
                        current_container = None

                    symbols.append(SymbolRecord(
                        file_id=0,
                        name=name,
                        container_name=container,
                        kind=kind,
                        range_start_line=line_no,
                        range_start_col=indent,
                        range_end_line=line_no,
                        range_end_col=len(line),
                        signature=line.strip(),
                        doc_comment=None,
                        is_exported=not name.startswith("_")
                    ))
                    if not name.startswith("_"):
                        exported_sig_parts.append(f"{kind}:{name}")
                    continue
        else:
            # Generic fallback
            gen_pattern = re.compile(r'^\s*(fn|func|def|class|interface|struct)\s+([A-Za-z0-9_]+)')
            for i, line in enumerate(lines):
                m = gen_pattern.match(line)
                if m:
                    kind = m.group(1).capitalize()
                    name = m.group(2)
                    symbols.append(SymbolRecord(
                        file_id=0,
                        name=name,
                        container_name=None,
                        kind=kind,
                        range_start_line=i + 1,
                        range_start_col=0,
                        range_end_line=i + 1,
                        range_end_col=len(line),
                        signature=line.strip(),
                        doc_comment=None,
                        is_exported=True
                    ))
                    exported_sig_parts.append(f"{kind}:{name}")

        signature_hash = hashlib.sha256(";".join(exported_sig_parts).encode("utf-8")).hexdigest()
        return symbols, signature_hash


class LspIndexerService:
    """Orchestrates workspace scanning, DAG incremental invalidation, and LSP/AST indexing."""

    def __init__(self, workspace_dir: Path | str, db_path: Optional[Path | str] = None):
        self.workspace_dir = Path(workspace_dir).resolve()
        if db_path:
            self.db_path = Path(db_path)
        else:
            self.db_path = self.workspace_dir / ".tcode" / "index" / "semantic_index.db"
        
        self.storage = IndexerStorage(self.db_path)

    def _collect_files(self) -> List[Path]:
        files: List[Path] = []
        for root, dirs, filenames in os.walk(self.workspace_dir):
            # Prune ignored directories in-place
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
            for filename in filenames:
                ext = Path(filename).suffix.lower()
                if ext in SUPPORTED_EXTENSIONS:
                    files.append(Path(root) / filename)
        return files

    def sync_workspace(self, force: bool = False, file_paths: Optional[List[str]] = None) -> Dict[str, Any]:
        """Perform high-speed incremental indexing based on Blake3/SHA256 content hashes."""
        start_time = time.time()
        
        if file_paths:
            target_files = [self.workspace_dir / p for p in file_paths]
        else:
            target_files = self._collect_files()

        indexed_count = 0
        symbols_count = 0
        symbol_map: Dict[str, int] = {}  # name -> symbol_id for reference link

        # 1. Process files incrementally
        for fpath in target_files:
            if not fpath.exists() or not fpath.is_file():
                continue

            rel_path = str(fpath.relative_to(self.workspace_dir)).replace("\\", "/")
            try:
                content = fpath.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue

            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            existing_rec = self.storage.get_file_record(rel_path)

            if not force and existing_rec and existing_rec["content_hash"] == content_hash:
                # Cache hit: File has not changed at all, skip!
                continue

            # Extract symbols & signature hash via fast-path
            symbols, signature_hash = FastAstExtractor.extract_symbols_and_signatures(rel_path, content)
            
            # Upsert file and clean obsolete entries
            file_id = self.storage.upsert_file(rel_path, content_hash, signature_hash)
            
            for s in symbols:
                s.file_id = file_id

            sym_ids = self.storage.batch_insert_symbols(symbols)
            for s, s_id in zip(symbols, sym_ids):
                symbol_map[s.name] = s_id

            indexed_count += 1
            symbols_count += len(symbols)

        duration_ms = int((time.time() - start_time) * 1000)
        return {
            "status": "success",
            "indexed_files": indexed_count,
            "symbols_count": symbols_count,
            "duration_ms": duration_ms
        }

    def search(self, query: str, kind: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        return self.storage.search_symbols(query, kind=kind, limit=limit)

    def get_subgraph(self, symbol_id: int, depth: int = 2) -> Dict[str, Any]:
        return self.storage.get_symbol_subgraph(symbol_id, depth=depth)

    def get_status(self) -> Dict[str, Any]:
        status = self.storage.get_status()
        status["workspace"] = str(self.workspace_dir)
        return status
