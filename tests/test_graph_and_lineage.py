import sys
import tempfile
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src-desktop"))

from indexer_storage import IndexerStorage, SymbolRecord, SymbolReferenceRecord
from lineage_service import LineageService, CodeLineageRecord, AuditEventRecord, scan_license_risk


@pytest.fixture
def temp_db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_graph_lineage.db"
        yield db_file


def test_workspace_graph_and_blast_radius(temp_db_path):
    storage = IndexerStorage(temp_db_path)
    file_1 = storage.upsert_file("src/auth.ts", "h1", "s1")
    file_2 = storage.upsert_file("src/user.ts", "h2", "s2")
    file_3 = storage.upsert_file("src/api.ts", "h3", "s3")

    # Symbols: API -> User -> Auth
    sym_auth = SymbolRecord(file_1, "AuthService", None, "Class", 1, 0, 30, 0, "class AuthService", None, True)
    sym_user = SymbolRecord(file_2, "UserService", None, "Class", 1, 0, 40, 0, "class UserService", None, True)
    sym_api = SymbolRecord(file_3, "ApiController", None, "Class", 1, 0, 50, 0, "class ApiController", None, True)

    ids = storage.batch_insert_symbols([sym_auth, sym_user, sym_api])
    auth_id, user_id, api_id = ids[0], ids[1], ids[2]

    # References: User -> Auth, Api -> User
    ref_1 = SymbolReferenceRecord(user_id, auth_id, file_2, 10, 5, "call")
    ref_2 = SymbolReferenceRecord(api_id, user_id, file_3, 15, 5, "call")
    storage.batch_insert_references([ref_1, ref_2])

    # 1. Test Workspace Graph Aggregation
    graph = storage.get_workspace_graph(limit=100)
    assert len(graph["nodes"]) >= 3
    assert len(graph["edges"]) >= 2
    edge_types = [e["relation"] for e in graph["edges"]]
    assert "call" in edge_types

    # 2. Test Blast Radius (Modifying AuthService impacts UserService at hop 1, and ApiController at hop 2)
    blast = storage.get_blast_radius(auth_id, max_hops=2)
    assert blast["root_symbol"]["name"] == "AuthService"
    assert len(blast["impacted_nodes"]) == 2
    impact_names = [n["name"] for n in blast["impacted_nodes"]]
    assert "UserService" in impact_names
    assert "ApiController" in impact_names
    # Check hops
    user_node = next(n for n in blast["impacted_nodes"] if n["name"] == "UserService")
    api_node = next(n for n in blast["impacted_nodes"] if n["name"] == "ApiController")
    assert user_node["hop"] == 1
    assert api_node["hop"] == 2


def test_lineage_and_audit_records(temp_db_path):
    service = LineageService(db_path=temp_db_path)
    
    # 1. Record Code Lineage
    rec = CodeLineageRecord(
        file_path="src/auth.ts",
        line_start=15,
        line_end=25,
        author_type="AI_AGENT",
        model_id="claude-3-5-sonnet",
        prompt="Add JWT token verification logic",
        approved_by="Lead Architect: Sarah Chen",
        checkpoint_ref="refs/tcode/checkpoints/sess-1/1"
    )
    rec_id = service.record_lineage(rec)
    assert rec_id > 0

    # 2. Query File Lineage
    file_lineage = service.get_file_lineage("src/auth.ts")
    assert len(file_lineage) == 1
    item = file_lineage[0]
    assert item["author_type"] == "AI_AGENT"
    assert item["model_id"] == "claude-3-5-sonnet"
    assert item["license_risk"] == "SAFE"
    assert item["approved_by"] == "Lead Architect: Sarah Chen"

    # 3. Query Audit Timeline
    timeline = service.get_audit_timeline(limit=10)
    assert len(timeline) >= 1
    assert timeline[0]["actor"] == "AI_AGENT"


def test_license_compliance_scanner():
    # Safe MIT/Apache code
    safe_code = """
    // Licensed under MIT
    export function add(a: number, b: number): number {
        return a + b;
    }
    """
    assert scan_license_risk(safe_code)["risk_level"] == "SAFE"

    # High-risk GPL license code snippet
    gpl_code = """
    /* This program is free software; you can redistribute it and/or modify
     * it under the terms of the GNU General Public License as published by the Free Software Foundation */
    int main() { return 0; }
    """
    gpl_res = scan_license_risk(gpl_code)
    assert gpl_res["risk_level"] == "HIGH_RISK"
    assert "GNU General Public License" in gpl_res["matched_license"]
