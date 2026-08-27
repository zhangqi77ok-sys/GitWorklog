"""聊天接入层（SSE）：意图路由 → 领域 Agent → 统一 SSE 事件流。

真实接线（替代原先恒返回 None 的占位工厂）：
- 按请求装配领域 context（DB session + 登录用户 + 政策规则），交给 DomainAgentFactory；
  配了模型 Key 就构建真实 LangGraph Agent，没配则返回 None → runtime 降级流。
- 挂 Hook 链：进度推送 + 会话持久化（降级态同样生效）。

鉴权是**可选**的：带 Authorization 头则识别用户并持久化会话，
不带则匿名试用、不落库。这样未登录也能体验，登录后自动获得历史记录。

诚实边界：data 域需要 live MySQL 只读连接 + schema 自省（见 docs/NEEDS_LIVE.md），
本层不假装能装配，data 域一律返回 None 走降级；travel 域已可真实装配。
"""

from __future__ import annotations

import uuid
from contextlib import ExitStack
from typing import Annotated, Any

import jwt
from fastapi import APIRouter, Header
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.core.db import session_scope
from app.core.logging import get_logger
from app.orchestrator.factory import DomainAgentFactory
from app.orchestrator.intent.defaults import default_rule_matcher
from app.orchestrator.intent.llm_classifier import LLMIntentClassifierImpl
from app.orchestrator.pipeline import IntentPipeline
from app.orchestrator.resume import build_checkpointer
from app.orchestrator.rewriter import LLMQueryRewriter
from app.orchestrator.supervisor import Supervisor
from app.platform.auth.security import decode_token
from app.platform.hooks.base import HookChain, HookContext
from app.platform.hooks.persistence import PersistenceHook
from app.platform.hooks.progress import ProgressHook
from app.platform.session.service import get_messages
from app.platform.session.sink import DbMessageSink

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = get_logger(__name__)


class ChatRequest(BaseModel):
    query: str
    conversation_id: str | None = None
    online: bool = False
    file_id: str | None = None
    file_ids: list[str] = []
    kb_id: int | None = None
    kb_ids: list[int] = []
    all_kb: bool = False
    # 对上一次 USER_INTERACTION 提问的答复；带上则恢复挂起的执行（P1-M6）
    resume: str | None = None
    # 动态指定大模型厂商与模型名称（如 dashscope/qwen3.7-flash, deepseek/deepseek-reasoner 等）
    provider: str | None = None
    model: str | None = None




class _RequestContext:
    """按请求提供领域工具上下文（满足 orchestrator.factory.DomainContextProvider）。

    工具持有的 session 必须活到流结束（Agent 在流式过程中才调用工具），
    但又不能用 FastAPI 的 yield 依赖（流式响应下它会被提前关闭）。
    因此自建 session 并用 ExitStack 托管，由调用方在流结束时 close()。
    """

    def __init__(self, user_id: int, dept_id: int = 0) -> None:
        self.user_id = user_id
        self.dept_id = dept_id
        self._stack = ExitStack()

    def data_tools(self) -> Any:
        from app.domains.data.schema.glossary import Glossary
        from app.domains.data.schema.mschema import (
            CachedSchemaProvider,
            DatabaseSchemaProvider,
            YamlSchemaProvider,
        )
        from app.domains.data.sql.executor import ExecuteSqlPipeline
        from app.domains.data.sql.guard import SqlSafetyGuard
        from app.domains.data.sql.rewriter import DataScopeRewriter
        from app.domains.data.sql.runner import MySQLReadOnlyRunner
        from app.domains.data.tools.text2sql import DataAgentContext, Text2SqlTools
        from app.platform.auth.datascope import DataScope, DataScopeResult

        session = self._stack.enter_context(session_scope())
        engine = session.get_bind()
        try:
            schema_provider: Any = CachedSchemaProvider(DatabaseSchemaProvider(engine))
            schema_provider.list_tables()
        except Exception:
            schema_provider = YamlSchemaProvider([])

        runner = MySQLReadOnlyRunner(engine)
        pipeline = ExecuteSqlPipeline(
            guard=SqlSafetyGuard(),
            rewriter=DataScopeRewriter(rules={}),
            runner=runner,
        )
        scope = DataScopeResult(scope=DataScope.ALL, user_id=self.user_id)
        return Text2SqlTools(
            DataAgentContext(
                schema=schema_provider,
                glossary=Glossary([]),
                pipeline=pipeline,
                scope=scope,
            )
        )

    def travel_tools(self) -> Any:
        from app.domains.travel.business.service import load_policy_engine
        from app.domains.travel.tools.travel_tools import TravelAgentContext, TravelTools

        session = self._stack.enter_context(session_scope())
        engine = load_policy_engine(session)
        return TravelTools(
            TravelAgentContext(
                session=session,
                user_id=self.user_id,
                dept_id=self.dept_id,
                policy=engine,
            )
        )

    def close(self) -> None:
        """释放本次请求装配工具时开出的所有 session。"""
        self._stack.close()


class _ChatFactory:
    """包一层 DomainAgentFactory：按请求指定或默认网关路由构建 LLM。"""

    def __init__(
        self,
        ctx: _RequestContext,
        checkpointer: Any = None,
        provider_code: str | None = None,
        model_name: str | None = None,
    ) -> None:
        def _custom_model_builder() -> Any:
            with session_scope() as session:
                from app.platform.gateway.service import (
                    get_model_by_provider_and_name,
                    get_model_for_feature,
                )

                if provider_code and model_name:
                    return get_model_by_provider_and_name(
                        session,
                        provider_code=provider_code,
                        model_name=model_name,
                        streaming=True,
                    )
                return get_model_for_feature(session, "chat_default", streaming=True)

        self._inner = DomainAgentFactory(
            ctx, model_builder=_custom_model_builder, checkpointer=checkpointer
        )

    def build(self, domain: str) -> Any | None:
        try:
            return self._inner.build(domain)
        except NotImplementedError as exc:
            logger.info("domain_not_wired_degrade", domain=domain, reason=str(exc))
            return None
        except Exception as exc:  # 宽捕获是刻意的：装配失败降级，不让聊天接口 500
            logger.exception("agent_build_failed", domain=domain, error=str(exc))
            return None



def _identify(authorization: str | None) -> int | None:
    """从可选的 Authorization 头解析 user_id。无效或缺失均返回 None（匿名）。"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        payload = decode_token(authorization.removeprefix("Bearer ").strip())
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        logger.info("chat_anonymous_invalid_token")
        return None


def _build_hooks(persist: bool) -> HookChain:
    hooks: list[Any] = [ProgressHook()]
    if persist:
        hooks.append(PersistenceHook(sink=DbMessageSink()))
    return HookChain(hooks=hooks)


def _build_pipeline() -> IntentPipeline:
    """L1 规则 + L3 LLM 兜底 + 查询改写。

    L2 向量需 live embedding，暂不接（种子语料已在 intent-seed.yml 就位）。
    L3 与改写器在无模型 Key 时各自内部降级为「不改写 / 返回 NONE」，
    不影响 L1 规则这条主路径。
    """
    return IntentPipeline(
        default_rule_matcher(),
        llm_classifier=LLMIntentClassifierImpl(),
        query_rewriter=LLMQueryRewriter(),
    )


_CHECKPOINTER: Any = None


def _checkpointer() -> Any:
    """进程内单例 checkpointer（P1-M4/M6）。

    必须是单例：每请求新建一个 InMemorySaver 等于没有快照，
    中断续跑与 HITL 恢复都会失效——下一次请求根本找不到上一次的 thread。

    诚实边界：内存实现进程重启即丢，也不跨节点。生产要换 Postgres/Redis
    版（见 NEEDS_LIVE.md）；build_checkpointer 对未实现的类型显式抛错，
    不会静默退回内存让人误以为有持久化。
    """
    global _CHECKPOINTER
    if _CHECKPOINTER is None:
        try:
            _CHECKPOINTER = build_checkpointer("memory")
        except Exception as exc:  # 宽捕获是刻意的：没有快照也要能正常聊天
            logger.error("checkpointer_unavailable", error=str(exc))
            return None
    return _CHECKPOINTER


def _load_history(conversation_id: str, limit: int = 6) -> list[dict[str, str]]:
    """取最近几轮供指代消解。取不到就返回空——改写只是增强。"""
    try:
        with session_scope() as session:
            msgs = get_messages(session, conversation_id)
        return [{"role": m.role, "content": m.content} for m in msgs[-limit:]]
    except Exception as exc:  # 宽捕获是刻意的：读历史失败不该阻断提问
        logger.warning("load_history_failed", conversation_id=conversation_id, error=str(exc))
        return []


_SLASH_ALIASES: dict[str, str] = {
    "data": "data-analysis",
    "sql": "data-analysis",
    "data-analysis": "data-analysis",
    "flight": "flight-booking",
    "flight-booking": "flight-booking",
    "hotel": "hotel-booking",
    "hotel-booking": "hotel-booking",
    "travel": "tuniu-travel-guide",
    "guide": "tuniu-travel-guide",
    "tuniu-travel-guide": "tuniu-travel-guide",
    "itinerary": "itinerary-planner",
    "plan": "itinerary-planner",
    "itinerary-planner": "itinerary-planner",
    "reimburse": "travel-reimbursement",
    "reimbursement": "travel-reimbursement",
    "travel-reimbursement": "travel-reimbursement",
}


def _parse_slash_command(raw_query: str) -> tuple[str | None, str]:
    """解析以 / 开头的技能调用指令。"""
    stripped = raw_query.strip()
    if not stripped.startswith("/"):
        return None, raw_query
    parts = stripped.split(maxsplit=1)
    cmd = parts[0][1:].lower()
    skill_name = _SLASH_ALIASES.get(cmd, cmd)
    sub_query = parts[1].strip() if len(parts) > 1 else ""
    return skill_name, sub_query or raw_query


@router.post("")
async def chat(
    req: ChatRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> EventSourceResponse:
    from sqlalchemy import select

    from app.platform.files.models import FileRecord
    from app.platform.skills.models import SkillRecord
    from app.platform.skills.service import get_skill, match_skills

    user_id = _identify(authorization)
    conversation_id = req.conversation_id or uuid.uuid4().hex

    # 1. 检查是否存在显式 /skill 快捷指令
    explicit_skill_name, cleaned_query = _parse_slash_command(req.query)
    effective_user_query = cleaned_query if explicit_skill_name else req.query

    # 只有登录用户才落库：匿名会话没有归属，存了也无法回放
    persist = user_id is not None
    history: list[dict[str, str]] = []
    matched_skills: list[Any] = []
    doc_context = ""

    # 收集待关联文件与知识库集合 ID
    target_fids = list(req.file_ids)
    if req.file_id and req.file_id not in target_fids:
        target_fids.append(req.file_id)

    target_kb_ids = list(req.kb_ids)
    if req.kb_id and req.kb_id not in target_kb_ids:
        target_kb_ids.append(req.kb_id)

    with session_scope() as session:
        # 解析知识库集合包含的所有文件
        if target_kb_ids:
            kb_fids = list(
                session.execute(
                    select(FileRecord.file_id).where(FileRecord.kb_id.in_(target_kb_ids))
                )
                .scalars()
                .all()
            )
            for fid in kb_fids:
                if fid not in target_fids:
                    target_fids.append(fid)

        # 显式 / 指令优先绑定该技能

        if explicit_skill_name:
            sk = get_skill(session, explicit_skill_name)
            if sk is None:
                # 模糊查找
                sk = (
                    session.execute(
                        select(SkillRecord).where(SkillRecord.name.like(f"%{explicit_skill_name}%"))
                    )
                    .scalars()
                    .first()
                )
            if sk:
                matched_skills = [sk]

        # 否则按问题语义自动匹配
        if not matched_skills:
            try:
                matched_skills = match_skills(session, effective_user_query)
            except Exception as exc:
                logger.warning("match_skills_failed", error=str(exc))

        # 2. 智能 RAG 文档检索与知识切片注入
        from app.platform.files.rag import search_knowledge_base

        try:
            if req.all_kb:
                # 显式全库检索：检索全部知识库的所有文档 Top-K 最相关切片
                chunks = search_knowledge_base(
                    session, effective_user_query, all_kb=True, top_k=6, min_score=0.05
                )
                if chunks:
                    doc_parts = [
                        f"【企业全部知识库命中段落 · 来自《{c.filename}》（相关度: {c.best_score}）】\n{c.content}"
                        for c in chunks
                    ]
                    doc_context = "\n\n".join(doc_parts)
            elif target_fids:
                # 显式关联文档：检索关联文件的 Top-K 最相关切片
                chunks = search_knowledge_base(
                    session, effective_user_query, file_ids=target_fids, top_k=5, min_score=0.0
                )
                if not chunks:
                    # 兜底：若查询未命中特定关键词，提取前段文本
                    f_recs = (
                        session.execute(
                            select(FileRecord).where(FileRecord.file_id.in_(target_fids))
                        )
                        .scalars()
                        .all()
                    )
                    doc_parts = [
                        f"【参考文档：{f.filename}】\n{f.text_content[:6000]}"
                        for f in f_recs
                        if f.text_content
                    ]
                    doc_context = "\n\n".join(doc_parts)
                else:
                    doc_parts = [
                        f"【参考文档段落 · 来自《{c.filename}》（相关度: {c.best_score}）】\n{c.content}"
                        for c in chunks
                    ]
                    doc_context = "\n\n".join(doc_parts)
            else:
                # 隐式全局知识库检索：自动检索用户知识库中高相关度的切片 (min_score=0.35)
                auto_chunks = search_knowledge_base(
                    session, effective_user_query, top_k=3, min_score=0.35
                )
                if auto_chunks:
                    doc_parts = [
                        f"【企业知识库命中段落 · 来自《{c.filename}》（相关度: {c.best_score}）】\n{c.content}"
                        for c in auto_chunks
                    ]
                    doc_context = "\n\n".join(doc_parts)

        except Exception as exc:

            logger.warning("rag_retrieval_failed", error=str(exc))

        # 3. 提取并注入用户长期记忆与画像知识图谱
        if user_id:
            try:
                from app.platform.memory.service import get_user_persona_prompt

                persona_context = get_user_persona_prompt(session, user_id)
                if persona_context:
                    doc_context = f"{persona_context}\n\n{doc_context}".strip()
            except Exception as exc:
                logger.warning("get_persona_failed", error=str(exc))

    if persist:
        from fastapi.concurrency import run_in_threadpool

        from app.platform.session.service import get_or_create_conversation

        def _ensure() -> None:
            with session_scope() as session:
                get_or_create_conversation(session, user_id or 0, conversation_id)

        await run_in_threadpool(_ensure)
        # 历史只对已落库的会话才有；匿名没有上文可参照
        history = await run_in_threadpool(_load_history, conversation_id)

    ctx = HookContext(
        query=effective_user_query,
        user_id=user_id,
        conversation_id=conversation_id if persist else None,
    )
    provider = _RequestContext(user_id or 0)
    supervisor = Supervisor(
        _build_pipeline(),
        _ChatFactory(
            provider,
            checkpointer=_checkpointer(),
            provider_code=req.provider,
            model_name=req.model,
        ),
        hooks=_build_hooks(persist),
    )


    async def _gen():  # type: ignore[no-untyped-def]
        accumulated_reply = ""
        try:
            async for evt in supervisor.handle(
                effective_user_query,
                ctx=ctx,
                history=history,
                thread_id=conversation_id,
                resume_value=req.resume,
                skills=matched_skills,
                doc_context=doc_context,
            ):
                if evt.event == "message" and evt.data:
                    accumulated_reply += str(evt.data)
                yield evt.to_sse()
                if evt.event == "done":
                    break
        finally:
            # 客户端断开或流结束时，动态分析并沉淀用户画像与知识图谱
            if user_id and (accumulated_reply or effective_user_query):
                with session_scope() as session:
                    try:
                        from app.platform.memory.service import extract_user_traits_and_graph

                        extract_user_traits_and_graph(
                            session,
                            user_id=user_id,
                            user_query=effective_user_query,
                            agent_reply=accumulated_reply,
                            conversation_id=conversation_id,
                        )
                    except Exception as exc:
                        logger.warning("extract_memory_failed", error=str(exc))

            # 避免 session 泄漏
            provider.close()

    return EventSourceResponse(_gen())
