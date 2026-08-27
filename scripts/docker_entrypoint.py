"""Docker 容器启动入口：等待数据库就绪 -> 执行建表与种子数据 -> 启动 Uvicorn 服务。"""

from __future__ import annotations

import subprocess
import sys
import time

from scripts.init_db import main as init_db_main

from app.core.db import get_engine


def wait_for_db(max_retries: int = 30, delay: int = 2) -> bool:
    print("[docker-entrypoint] 等待数据库连接就绪...")
    engine = get_engine()
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as _:
                print("[docker-entrypoint] 数据库连接成功！")
                return True
        except Exception as e:
            print(
                f"[docker-entrypoint] 尝试连接数据库 ({attempt}/{max_retries}) 暂未就绪: {e}，将在 {delay}s 后重试..."
            )
            time.sleep(delay)
    print("[docker-entrypoint] 数据库连接超时，尝试继续...")
    return False


def run() -> None:
    wait_for_db()
    print("[docker-entrypoint] 正在初始化数据库表与演示账号...")
    try:
        sys.argv = ["init_db.py", "--seed"]
        init_db_main()
    except Exception as e:
        print(f"[docker-entrypoint] 初始化数据库异常: {e}")

    from app.core.config import settings

    host = settings.app.host
    port = str(settings.app.port)
    print(f"[docker-entrypoint] 正在启动 Uvicorn 服务 ({host}:{port})...")
    subprocess.run(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            host,
            "--port",
            port,
        ]
    )


if __name__ == "__main__":
    run()
