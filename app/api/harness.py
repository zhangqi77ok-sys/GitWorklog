from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.response import R
from app.platform.harness.service import get_harness
from app.platform.audit.service import get_audit_skill, get_ironman_skill

router = APIRouter(prefix="/harness", tags=["harness"])

class SyntaxCheckRequest(BaseModel):
    code: str

class DiffRequest(BaseModel):
    original: str
    modified: str
    filename: str = "file.py"

class AuditRequest(BaseModel):
    code: str

class DebateRequest(BaseModel):
    requirement: str
    code: str

@router.post("/syntax_check")
def check_syntax(req: SyntaxCheckRequest) -> R[dict[str, Any]]:
    harness = get_harness()
    valid, msg = harness.check_ast_syntax(req.code)
    return R.ok({"valid": valid, "message": msg})

@router.post("/diff")
def make_diff(req: DiffRequest) -> R[dict[str, str]]:
    harness = get_harness()
    diff = harness.generate_diff(req.original, req.modified, req.filename)
    return R.ok({"diff": diff})

@router.get("/run_tests")
@router.post("/run_tests")
def run_pytest() -> R[dict[str, Any]]:
    harness = get_harness()
    res = harness.run_tests("tests/")
    return R.ok(res)

@router.post("/audit")
def audit_code(req: AuditRequest) -> R[dict[str, Any]]:
    auditor = get_audit_skill()
    res = auditor.inspect_code(req.code)
    return R.ok(res)

@router.post("/debate")
def debate_code(req: DebateRequest) -> R[dict[str, Any]]:
    ironman = get_ironman_skill()
    res = ironman.conduct_debate(req.requirement, req.code)
    return R.ok(res)
