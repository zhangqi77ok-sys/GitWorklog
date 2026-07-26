"""会话持久化 service 测试。"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.platform.session import service


def test_create_and_get_conversation(db_session: Session) -> None:
    conv = service.get_or_create_conversation(db_session, user_id=1)
    assert conv.conversation_id
    # 再次用同 id 应取到同一会话
    again = service.get_or_create_conversation(db_session, 1, conv.conversation_id)
    assert again.id == conv.id


def test_append_and_list_messages(db_session: Session) -> None:
    conv = service.get_or_create_conversation(db_session, user_id=1)
    service.append_message(db_session, conv.conversation_id, "user", "你好")
    service.append_message(db_session, conv.conversation_id, "assistant", "你好，我能帮你查数据")
    msgs = service.get_messages(db_session, conv.conversation_id)
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[1].role == "assistant"


def test_list_conversations_isolated_by_user(db_session: Session) -> None:
    service.get_or_create_conversation(db_session, user_id=1)
    service.get_or_create_conversation(db_session, user_id=2)
    assert len(service.list_conversations(db_session, 1)) == 1
    assert len(service.list_conversations(db_session, 2)) == 1


def test_rename(db_session: Session) -> None:
    conv = service.get_or_create_conversation(db_session, user_id=1)
    service.rename_conversation(db_session, conv.conversation_id, "销售分析")
    convs = service.list_conversations(db_session, 1)
    assert convs[0].title == "销售分析"
