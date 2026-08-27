import json
import asyncio
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from app.api.deps import DbDep
from app.core.response import R
from app.platform.session import service as session_svc
from app.platform.loop.engine import get_loop_engine
from app.platform.memory.service import get_short_term_memory
from app.platform.graph.service import get_graph_service

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    query: str
    conversation_id: str = "conv-cabinet-main"
    provider: str = "antigravity"
    model: str = "antigravity-core"

@router.post("")
@router.post("/")
async def chat_sse(req: ChatRequest, session: DbDep):
    session_svc.get_or_create_conversation(session, req.conversation_id)
    session_svc.append_message(session, req.conversation_id, "user", req.query)
    get_short_term_memory().push(req.conversation_id, "user", req.query)

    async def event_generator():
        yield {"event": "start", "data": json.dumps({"status": "running", "conversation_id": req.conversation_id})}
        session_svc.update_conversation_status(session, req.conversation_id, "running")

        # 唤醒 Loop 自愈与双向钢人流水线
        loop_engine = get_loop_engine()
        steps = await loop_engine.run_loop(req.query, req.conversation_id, req.provider, req.model)

        for step in steps:
            session_svc.append_message(session, req.conversation_id, step["agent"], step["output"])
            get_short_term_memory().push(req.conversation_id, step["agent"], step["output"])
            
            if "code" in step:
                get_graph_service().record_change(req.conversation_id, "app/utils/task_solver.py", "MODIFY", "实现业务算法并经双向钢人审查")

            yield {"event": "agent_step", "data": json.dumps(step)}
            await asyncio.sleep(0.3)

        session_svc.update_conversation_status(session, req.conversation_id, "idle")
        yield {"event": "done", "data": json.dumps({"status": "idle", "conversation_id": req.conversation_id})}

    return EventSourceResponse(event_generator())
