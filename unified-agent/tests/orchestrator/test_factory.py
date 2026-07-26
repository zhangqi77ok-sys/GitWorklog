"""领域 Agent 工厂测试：降级路径 + 有模型时构建真实 Agent（mock 上下文/模型）。"""

from __future__ import annotations

from typing import Any

from app.domains.data.schema.glossary import Glossary, GlossaryTerm
from app.domains.data.schema.mschema import TableMeta, YamlSchemaProvider
from app.domains.data.sql.executor import ExecuteSqlPipeline, QueryResult, QueryRunner
from app.domains.data.sql.guard import SqlSafetyGuard
from app.domains.data.sql.rewriter import DataScopeRewriter
from app.domains.data.tools.text2sql import DataAgentContext, Text2SqlTools
from app.orchestrator.factory import DomainAgentFactory
from app.platform.auth.datascope import DataScope, DataScopeResult
from app.platform.llm.models import ModelNotConfiguredError


class _Runner(QueryRunner):
    def run(self, sql: str) -> QueryResult:
        return QueryResult(columns=["x"], rows=[{"x": 1}])


class FakeCtx:
    """mock 领域上下文：只需 data_tools 供本测使用。"""

    def data_tools(self) -> Text2SqlTools:
        ctx = DataAgentContext(
            schema=YamlSchemaProvider([TableMeta(name="t", comment="表")]),
            glossary=Glossary([GlossaryTerm(name="X", definition="d")]),
            pipeline=ExecuteSqlPipeline(SqlSafetyGuard(), DataScopeRewriter({}), _Runner()),
            scope=DataScopeResult(scope=DataScope.ALL, user_id=1, visible_dept_ids=None),
        )
        return Text2SqlTools(ctx)

    def travel_tools(self) -> Any:  # 本测不覆盖 travel
        raise NotImplementedError


def make_fake_model() -> Any:
    """真实 BaseChatModel 子类，支持 bind_tools，让 create_react_agent 装配成功。

    只用于验证工厂「有模型→构建 Agent」路径，不实际推理。
    """
    from langchain_core.language_models.chat_models import BaseChatModel
    from langchain_core.messages import AIMessage
    from langchain_core.outputs import ChatGeneration, ChatResult

    class FakeChat(BaseChatModel):
        @property
        def _llm_type(self) -> str:
            return "fake"

        def _generate(self, messages, stop=None, run_manager=None, **kw):  # type: ignore[no-untyped-def]
            return ChatResult(generations=[ChatGeneration(message=AIMessage(content="ok"))])

        def bind_tools(self, tools, **kw):  # type: ignore[no-untyped-def]
            return self

    return FakeChat()


def test_unknown_domain_returns_none() -> None:
    factory = DomainAgentFactory(FakeCtx(), model_builder=make_fake_model)
    assert factory.build("general") is None
    assert factory.build("nonsense") is None


def test_model_not_configured_degrades() -> None:
    def raising_builder() -> Any:
        raise ModelNotConfiguredError("no key")

    factory = DomainAgentFactory(FakeCtx(), model_builder=raising_builder)
    assert factory.build("data") is None


def test_builds_data_agent_when_model_present() -> None:
    factory = DomainAgentFactory(FakeCtx(), model_builder=make_fake_model)
    agent = factory.build("data")
    assert agent is not None
    # create_react_agent 返回一个可 astream_events 的 compiled graph
    assert hasattr(agent, "astream_events")
