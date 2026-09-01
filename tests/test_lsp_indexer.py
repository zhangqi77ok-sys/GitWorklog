import os
import sys
import tempfile
import pytest
from pathlib import Path

# Add src-desktop to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src-desktop"))

from indexer_storage import IndexerStorage, SymbolRecord, FileRecord, SymbolReferenceRecord
from lsp_indexer_service import LspIndexerService


@pytest.fixture
def temp_db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "semantic_index.db"
        yield db_file


def test_indexer_storage_init_and_crud(temp_db_path):
    storage = IndexerStorage(temp_db_path)
    status = storage.get_status()
    assert status["total_files"] == 0
    assert status["total_symbols"] == 0

    # 1. Upsert file
    file_id = storage.upsert_file("src/payment.ts", "hash_content_1", "hash_sig_1")
    assert file_id > 0

    # 2. Insert symbols
    sym1 = SymbolRecord(
        file_id=file_id,
        name="processPayment",
        container_name="PaymentService",
        kind="Method",
        range_start_line=10,
        range_start_col=4,
        range_end_line=25,
        range_end_col=5,
        signature="(amount: number, orderId: string) => Promise<boolean>",
        doc_comment="Handles payment checkout logic",
        is_exported=True
    )
    sym2 = SymbolRecord(
        file_id=file_id,
        name="PaymentService",
        container_name=None,
        kind="Class",
        range_start_line=5,
        range_start_col=0,
        range_end_line=50,
        range_end_col=1,
        signature="class PaymentService",
        doc_comment="Enterprise payment gateway service",
        is_exported=True
    )
    sym_ids = storage.batch_insert_symbols([sym1, sym2])
    assert len(sym_ids) == 2

    # 3. FTS5 Search
    results = storage.search_symbols("Payment", limit=10)
    assert len(results) >= 2
    names = [r["name"] for r in results]
    assert "processPayment" in names
    assert "PaymentService" in names

    # 4. Search with Kind filter
    func_results = storage.search_symbols("Payment", kind="Method", limit=10)
    assert len(func_results) == 1
    assert func_results[0]["name"] == "processPayment"


def test_symbol_references_and_recursive_cte(temp_db_path):
    storage = IndexerStorage(temp_db_path)
    file_a = storage.upsert_file("src/service.ts", "c1", "s1")
    file_b = storage.upsert_file("src/controller.ts", "c2", "s2")

    # Symbols
    callee_sym = SymbolRecord(
        file_id=file_a,
        name="calcFee",
        container_name="FeeCalculator",
        kind="Method",
        range_start_line=15,
        range_start_col=4,
        range_end_line=20,
        range_end_col=5,
        signature="(val: number) => number",
        doc_comment="Calculates platform tax",
        is_exported=True
    )
    caller_sym = SymbolRecord(
        file_id=file_b,
        name="handleCheckout",
        container_name="CheckoutController",
        kind="Method",
        range_start_line=30,
        range_start_col=4,
        range_end_line=45,
        range_end_col=5,
        signature="() => void",
        doc_comment="Endpoint controller",
        is_exported=True
    )
    ids = storage.batch_insert_symbols([callee_sym, caller_sym])
    callee_id, caller_id = ids[0], ids[1]

    # Reference: caller -> callee
    ref = SymbolReferenceRecord(
        caller_symbol_id=caller_id,
        callee_symbol_id=callee_id,
        caller_file_id=file_b,
        line=35,
        col=8,
        reference_kind="call"
    )
    storage.batch_insert_references([ref])

    # Test Subgraph Extraction via recursive CTE
    subgraph = storage.get_symbol_subgraph(callee_id, depth=2)
    assert subgraph["root_symbol"]["name"] == "calcFee"
    assert len(subgraph["callers"]) == 1
    assert subgraph["callers"][0]["name"] == "handleCheckout"
    assert subgraph["callers"][0]["file_path"] == "src/controller.ts"


def test_lsp_indexer_service_incremental_sync(temp_db_path):
    with tempfile.TemporaryDirectory() as project_dir:
        p = Path(project_dir)
        src_dir = p / "src"
        src_dir.mkdir()
        file_ts = src_dir / "math.ts"
        file_ts.write_text(
            "export class MathUtils {\n"
            "  static add(a: number, b: number): number {\n"
            "    return a + b;\n"
            "  }\n"
            "}\n",
            encoding="utf-8"
        )

        service = LspIndexerService(workspace_dir=p, db_path=temp_db_path)
        res = service.sync_workspace()
        assert res["status"] == "success"
        assert res["indexed_files"] >= 1
        assert res["symbols_count"] >= 1

        # Search extracted symbol
        search_res = service.search("add")
        assert len(search_res) > 0
        assert search_res[0]["name"] == "add"

        # Second sync without file changes -> Should skip (Incremental DAG)
        res_2 = service.sync_workspace()
        assert res_2["indexed_files"] == 0  # skipped because hash matches

        # Status check
        status = service.get_status()
        assert status["total_files"] >= 1
        assert status["total_symbols"] >= 1


def test_desktop_app_indexer_service():
    from desktop_app import get_indexer_service
    with tempfile.TemporaryDirectory() as project_dir:
        svc = get_indexer_service(project_dir)
        assert svc is not None
        st = svc.get_status()
        assert "total_files" in st

