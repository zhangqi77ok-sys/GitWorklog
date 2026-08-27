from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.response import R
from app.platform.mesh.engine import get_mesh_engine

router = APIRouter(prefix="/mesh", tags=["mesh"])

class PipelineRequest(BaseModel):
    query: str
    conversation_id: str = "conv-mesh-1"
    provider: str = "antigravity"
    model: str = "antigravity-core"

@router.post("/pipeline")
async def run_pipeline(req: PipelineRequest) -> R[list[dict[str, Any]]]:
    engine = get_mesh_engine()
    steps = await engine.execute_pipeline(req.query, req.conversation_id, req.provider, req.model)
    return R.ok(steps)
