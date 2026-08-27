"""用户/角色/部门 ORM 模型（合并 dodo 的 sys_* 与 gogo 的用户档案）。

- sys_user / sys_role / sys_dept：权限主模型（源自 dodo，更完整）
- sys_user_role / sys_user_dept：多对多关联（用户可多角色、多部门）
- user_profile：档案，合并 gogo 的差旅偏好字段
"""

from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, SoftDeleteMixin, TimestampMixin


class SysUser(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "sys_user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password: Mapped[str] = mapped_column(String(255))  # bcrypt 哈希
    nickname: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[int] = mapped_column(default=1)  # 1 启用 0 停用


class SysRole(Base, TimestampMixin):
    __tablename__ = "sys_role"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True)  # 如 admin
    name: Mapped[str] = mapped_column(String(64))
    data_scope: Mapped[int] = mapped_column(default=1)  # 见 DataScope


class SysDept(Base, TimestampMixin):
    __tablename__ = "sys_dept"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64))
    parent_id: Mapped[int] = mapped_column(default=0)  # 0 为根


class SysUserRole(Base):
    __tablename__ = "sys_user_role"

    user_id: Mapped[int] = mapped_column(ForeignKey("sys_user.id"), primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("sys_role.id"), primary_key=True)


class SysUserDept(Base):
    __tablename__ = "sys_user_dept"

    user_id: Mapped[int] = mapped_column(ForeignKey("sys_user.id"), primary_key=True)
    dept_id: Mapped[int] = mapped_column(ForeignKey("sys_dept.id"), primary_key=True)


class UserProfile(Base, TimestampMixin):
    """用户档案：dodo 基础字段 + gogo 差旅偏好。"""

    __tablename__ = "user_profile"

    user_id: Mapped[int] = mapped_column(ForeignKey("sys_user.id"), primary_key=True)
    # gogo 差旅偏好
    home_city: Mapped[str] = mapped_column(String(64), default="")  # 常驻城市
    job_level: Mapped[str] = mapped_column(String(32), default="")  # 职级
    id_card: Mapped[str] = mapped_column(String(64), default="")  # 证件（脱敏存储由上层保证）
    flight_pref: Mapped[str] = mapped_column(String(255), default="")  # 航班偏好
