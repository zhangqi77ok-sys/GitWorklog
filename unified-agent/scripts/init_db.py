"""初始化数据库：建所有表（可选写入演示账号）。

用法：
    PYTHONPATH=. python scripts/init_db.py           # 仅建表
    PYTHONPATH=. python scripts/init_db.py --seed     # 建表 + 演示账号

演示账号（--seed）：admin / admin123（admin 角色，ALL 数据范围）。
连接信息取自 .env（见 app/core/config.py）。
"""

from __future__ import annotations

import sys

# 导入所有模型模块，触发注册到 Base.metadata（新增模型模块时在此 import）
import app.domains.data.models
import app.domains.travel.business.models
import app.platform.session.models
import app.platform.skills.models
import app.platform.user.models  # noqa: F401
from app.core.db import Base, get_engine
from app.platform.auth.datascope import DataScope
from app.platform.auth.security import hash_password
from app.platform.user.models import SysDept, SysRole, SysUser, SysUserDept, SysUserRole


def create_all() -> None:
    engine = get_engine()
    Base.metadata.create_all(engine)
    print(f"[init_db] 建表完成，共 {len(Base.metadata.tables)} 张表")


def seed_demo() -> None:
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    engine = get_engine()
    with Session(engine) as session:
        exists = session.execute(
            select(SysUser).where(SysUser.username == "admin")
        ).scalar_one_or_none()
        if exists:
            print("[init_db] 演示账号已存在，跳过")
            return
        session.add(
            SysUser(username="admin", password=hash_password("admin123"), nickname="管理员")
        )
        session.add(SysRole(code="admin", name="管理员", data_scope=int(DataScope.ALL)))
        session.add(SysDept(name="总部", parent_id=0))
        session.flush()
        admin = session.execute(select(SysUser).where(SysUser.username == "admin")).scalar_one()
        role = session.execute(select(SysRole).where(SysRole.code == "admin")).scalar_one()
        dept = session.execute(select(SysDept).where(SysDept.name == "总部")).scalar_one()
        session.add(SysUserRole(user_id=admin.id, role_id=role.id))
        session.add(SysUserDept(user_id=admin.id, dept_id=dept.id))
        session.commit()
        print("[init_db] 演示账号已创建：admin / admin123")


def main() -> None:
    create_all()
    if "--seed" in sys.argv:
        seed_demo()


if __name__ == "__main__":
    main()
