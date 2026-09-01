import os
import re
import hashlib
import time
import json
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional

from indexer_storage import IndexerStorage

# High-risk viral open-source license patterns (GPL / AGPL / SSPL)
VIRAL_LICENSE_PATTERNS = [
    (re.compile(r'GNU\s+General\s+Public\s+License', re.IGNORECASE), "GNU General Public License (GPL)"),
    (re.compile(r'Affero\s+General\s+Public\s+License', re.IGNORECASE), "GNU Affero General Public License (AGPL)"),
    (re.compile(r'Server\s+Side\s+Public\s+License', re.IGNORECASE), "Server Side Public License (SSPL)"),
    (re.compile(r'GPL\s*v?[23]', re.IGNORECASE), "GPL License"),
    (re.compile(r'AGPL\s*v?[3]', re.IGNORECASE), "AGPL License"),
]

PERMISSIVE_LICENSE_PATTERNS = [
    (re.compile(r'MIT\s+License', re.IGNORECASE), "MIT"),
    (re.compile(r'Apache\s+License(\s*Version\s*2\.0)?', re.IGNORECASE), "Apache-2.0"),
    (re.compile(r'BSD\s*(2|3)-Clause', re.IGNORECASE), "BSD"),
]


def scan_license_risk(code_snippet: str) -> Dict[str, Any]:
    """Scans code text/comments for copyleft viral licenses (GPL/AGPL) to protect IP compliance."""
    if not code_snippet:
        return {"risk_level": "SAFE", "matched_license": None, "details": "Clean code without viral license headers"}

    for pattern, name in VIRAL_LICENSE_PATTERNS:
        if pattern.search(code_snippet):
            return {
                "risk_level": "HIGH_RISK",
                "matched_license": name,
                "details": f"Detected viral copyleft license ({name}). Modifying or embedding this code may contaminate proprietary codebase."
            }

    for pattern, name in PERMISSIVE_LICENSE_PATTERNS:
        if pattern.search(code_snippet):
            return {
                "risk_level": "SAFE",
                "matched_license": name,
                "details": f"Detected permissive commercial-friendly license ({name})."
            }

    return {"risk_level": "SAFE", "matched_license": None, "details": "No copyleft contamination detected"}


@dataclass
class CodeLineageRecord:
    file_path: str
    line_start: int
    line_end: int
    author_type: str = "AI_AGENT"  # 'AI_AGENT' | 'HUMAN'
    model_id: Optional[str] = "claude-3-5-sonnet"
    prompt: Optional[str] = None
    approved_by: Optional[str] = None
    checkpoint_ref: Optional[str] = None
    license_risk: Optional[str] = None
    prompt_hash: Optional[str] = None
    prompt_preview: Optional[str] = None


@dataclass
class AuditEventRecord:
    session_id: Optional[str]
    event_type: str
    actor: str
    summary: str
    metadata: Optional[Dict[str, Any]] = None


class LineageService:
    """Manages AI code provenance, Stage Gate approval auditing, and compliance verification."""

    def __init__(self, workspace_dir: Optional[Path | str] = None, db_path: Optional[Path | str] = None):
        if db_path:
            self.db_path = Path(db_path)
        elif workspace_dir:
            self.db_path = Path(workspace_dir).resolve() / ".tcode" / "index" / "semantic_index.db"
        else:
            self.db_path = Path.cwd().resolve() / ".tcode" / "index" / "semantic_index.db"

        self.storage = IndexerStorage(self.db_path)

    def record_lineage(self, record: CodeLineageRecord) -> int:
        """Records provenance metadata and automatically generates a tamper-evident audit event."""
        prompt_str = record.prompt or ""
        p_hash = hashlib.sha256(prompt_str.encode("utf-8")).hexdigest() if prompt_str else None
        p_preview = (prompt_str[:120] + "...") if len(prompt_str) > 120 else prompt_str

        license_eval = scan_license_risk(prompt_str)
        l_risk = record.license_risk or license_eval["risk_level"]

        rec_dict = {
            "file_path": record.file_path,
            "line_start": record.line_start,
            "line_end": record.line_end,
            "author_type": record.author_type,
            "model_id": record.model_id,
            "prompt_hash": p_hash,
            "prompt_preview": p_preview,
            "approved_by": record.approved_by,
            "license_risk": l_risk,
            "checkpoint_ref": record.checkpoint_ref,
        }
        lineage_id = self.storage.insert_code_lineage(rec_dict)

        # Also emit audit event
        summary = f"AI Generated L{record.line_start}-L{record.line_end} in {record.file_path} via {record.model_id}"
        if record.approved_by:
            summary += f" (Approved by {record.approved_by})"

        self.storage.insert_audit_event({
            "session_id": "auto-session",
            "event_type": "AI_CODE_MODIFICATION",
            "actor": record.author_type,
            "summary": summary,
            "metadata_json": json.dumps({
                "lineage_id": lineage_id,
                "file_path": record.file_path,
                "lines": [record.line_start, record.line_end],
                "model": record.model_id,
                "checkpoint": record.checkpoint_ref,
                "license_risk": l_risk
            })
        })

        return lineage_id

    def get_file_lineage(self, file_path: str) -> List[Dict[str, Any]]:
        return self.storage.get_code_lineage_for_file(file_path)

    def get_audit_timeline(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.storage.get_audit_events(limit=limit)
