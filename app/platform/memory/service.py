"""用户长期记忆与知识图谱服务：动态特征抽取、三元组沉淀与自适应画像生成。"""

from __future__ import annotations

import re

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.platform.memory.models import UserGraphEdge, UserMemoryRecord

# 常见城市、航司、酒店与业务主题模式词典
_CITY_PATTERNS = [
    r"(?:常驻|人在|家在|坐标|位于|来自|从|在)([\u4e00-\u9fa5]{2,6})(?:市|出差|出发|办公|居住)",
    r"([\u4e00-\u9fa5]{2,4})(?:人|出发|常驻|办事处)",
]
_AIRLINE_PATTERNS = [
    r"(国航|中国国航|东航|中国东方航空|南航|中国南方航空|海航|海南航空|川航|四川航空|厦航|吉祥航空|春秋航空)",
    r"(早班机|晚班机|直飞|不转机|靠窗|走道|头等舱|商务舱|经济舱)",
]
_HOTEL_PATTERNS = [
    r"(万豪|希尔顿|洲际|凯悦|香格里拉|亚朵|全季|汉庭|桔子|如家|锦江)",
    r"(靠近地铁|紧邻商圈|带早餐|大床房|双床房|无烟房|行政酒廊|五星级)",
]
_BUSINESS_PATTERNS = [
    r"(华东|华南|华北|西南|华中|西北|东北)(?:区|大区|区域)?(?:销售|订单|业绩|指标|营收|成本)",
    r"(研发部|销售部|市场部|财务部|人事部|运营部)(?:数据|订单|预算|开支)",
]


def extract_user_traits_and_graph(
    session: Session,
    user_id: int,
    user_query: str,
    agent_reply: str = "",
    conversation_id: str = "",
) -> list[UserMemoryRecord]:
    """在每次对话后，动态提取用户特征并更新长期记忆与知识图谱关系。"""
    text = f"{user_query}\n{agent_reply}"
    extracted_memories: list[tuple[str, str, str]] = []  # (type, key, value)
    graph_edges: list[tuple[str, str, str]] = []  # (source, relation, target)

    # 1. 抽取常驻/出发城市
    for pattern in _CITY_PATTERNS:
        match = re.search(pattern, user_query)
        if match:
            raw_city = match.group(1).replace("市", "").strip()
            city = re.sub(r"(?:常驻|出发|出差|办公|居住|人|办事处)$", "", raw_city).strip()
            if len(city) >= 2 and city not in ("我们", "公司", "大家", "之后", "今天", "明天"):
                extracted_memories.append(("trait", "home_city", f"常驻/偏好出发城市：{city}"))
                graph_edges.append(("当前用户", "LIVES_IN", city))
                break

    # 2. 抽取航司偏好与出行习惯
    for pattern in _AIRLINE_PATTERNS:
        matches = re.findall(pattern, text)
        for m in matches:
            if any(k in m for k in ("航", "航空")):
                extracted_memories.append(("preference", "preferred_airline", f"偏好航空公司：{m}"))
                graph_edges.append(("当前用户", "PREFERS_AIRLINE", m))
            else:
                extracted_memories.append(("preference", "flight_habit", f"乘机习惯：{m}"))
                graph_edges.append(("当前用户", "HABIT", m))

    # 3. 抽取酒店偏好与住宿要求
    for pattern in _HOTEL_PATTERNS:
        matches = re.findall(pattern, text)
        for m in matches:
            if any(
                k in m for k in ("万豪", "希尔顿", "洲际", "凯悦", "亚朵", "全季", "汉庭", "桔子")
            ):
                extracted_memories.append(("preference", "preferred_hotel", f"偏好酒店品牌：{m}"))
                graph_edges.append(("当前用户", "PREFERS_HOTEL", m))
            else:
                extracted_memories.append(("preference", "hotel_habit", f"住宿习惯：{m}"))
                graph_edges.append(("当前用户", "HABIT", m))

    # 4. 抽取业务关注点
    for pattern in _BUSINESS_PATTERNS:
        matches = re.findall(pattern, text)
        for m in matches:
            extracted_memories.append(("topic", "business_focus", f"关注业务指标：{m}"))
            graph_edges.append(("当前用户", "FOCUSES_ON", m))

    # 5. 抽取约束限制
    budget_match = re.search(r"(?:预算|标准|上限|不超过|不能超过)(\d+)(?:元|块)", text)
    if budget_match:
        limit = budget_match.group(1)
        extracted_memories.append(
            ("restriction", "budget_limit", f"单笔/差旅预算上限：不超过{limit}元")
        )
        graph_edges.append(("当前用户", "RESTRICTED_BY", f"预算≤{limit}元"))

    created_records: list[UserMemoryRecord] = []

    # 持久化特征记忆（去重 Upsert）
    for m_type, key, val in extracted_memories:
        existing = session.execute(
            select(UserMemoryRecord).where(
                UserMemoryRecord.user_id == user_id,
                UserMemoryRecord.key == key,
            )
        ).scalar_one_or_none()

        if existing:
            existing.value = val
            existing.confidence = min(existing.confidence + 0.1, 1.0)
            existing.source_session_id = conversation_id
            created_records.append(existing)
        else:
            rec = UserMemoryRecord(
                user_id=user_id,
                memory_type=m_type,
                key=key,
                value=val,
                confidence=0.9,
                source_session_id=conversation_id,
            )
            session.add(rec)
            created_records.append(rec)

    # 持久化知识图谱三元组（权重累加）
    for src, rel, tgt in graph_edges:
        edge = session.execute(
            select(UserGraphEdge).where(
                UserGraphEdge.user_id == user_id,
                UserGraphEdge.source_node == src,
                UserGraphEdge.relation == rel,
                UserGraphEdge.target_node == tgt,
            )
        ).scalar_one_or_none()

        if edge:
            edge.weight += 1.0
        else:
            new_edge = UserGraphEdge(
                user_id=user_id,
                source_node=src,
                relation=rel,
                target_node=tgt,
                weight=1.0,
            )
            session.add(new_edge)

    session.commit()
    return created_records


def get_user_persona_prompt(session: Session, user_id: int) -> str:
    """生成该用户的长期记忆与知识图谱 Prompt 上下文。"""
    memories = (
        session.execute(
            select(UserMemoryRecord)
            .where(UserMemoryRecord.user_id == user_id)
            .order_by(UserMemoryRecord.id.desc())
        )
        .scalars()
        .all()
    )

    edges = (
        session.execute(
            select(UserGraphEdge)
            .where(UserGraphEdge.user_id == user_id)
            .order_by(UserGraphEdge.weight.desc())
        )
        .scalars()
        .all()
    )

    if not memories and not edges:
        return ""

    lines = ["【用户长期记忆与知识图谱画像】"]
    for m in memories:
        lines.append(f"• [{m.memory_type.upper()}] {m.value}")

    if edges:
        lines.append("\n【用户实体关系网络】")
        graph_strs = [f"({e.source_node}) -[{e.relation}]-> ({e.target_node})" for e in edges[:8]]
        lines.append(" · ".join(graph_strs))

    lines.append(
        "💡 提示：以上为该用户的专属画像特性。在规划行程、预订航班酒店或分析业务数据时，请默认融入这些偏好为用户进行贴合定制。"
    )
    return "\n".join(lines).strip()


def list_user_memories(session: Session, user_id: int) -> list[UserMemoryRecord]:
    return list(
        session.execute(
            select(UserMemoryRecord)
            .where(UserMemoryRecord.user_id == user_id)
            .order_by(UserMemoryRecord.id.desc())
        )
        .scalars()
        .all()
    )


def list_user_graph_edges(session: Session, user_id: int) -> list[UserGraphEdge]:
    return list(
        session.execute(
            select(UserGraphEdge)
            .where(UserGraphEdge.user_id == user_id)
            .order_by(UserGraphEdge.weight.desc())
        )
        .scalars()
        .all()
    )


def add_user_memory(
    session: Session,
    user_id: int,
    memory_type: str,
    key: str,
    value: str,
) -> UserMemoryRecord:
    rec = UserMemoryRecord(
        user_id=user_id,
        memory_type=memory_type,
        key=key,
        value=value,
        confidence=1.0,
    )
    session.add(rec)
    session.commit()
    return rec


def delete_user_memory(session: Session, user_id: int, memory_id: int) -> bool:
    rec = session.execute(
        select(UserMemoryRecord).where(
            UserMemoryRecord.id == memory_id,
            UserMemoryRecord.user_id == user_id,
        )
    ).scalar_one_or_none()
    if rec:
        session.delete(rec)
        session.commit()
        return True
    return False


def clear_user_memories_and_graph(session: Session, user_id: int) -> None:
    session.execute(delete(UserMemoryRecord).where(UserMemoryRecord.user_id == user_id))
    session.execute(delete(UserGraphEdge).where(UserGraphEdge.user_id == user_id))
    session.commit()
