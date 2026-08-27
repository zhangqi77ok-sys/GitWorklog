FROM python:3.12-slim

WORKDIR /app

# 环境变量设置
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# 安装 uv 高性能包管理器
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# 复制项目依赖描述
COPY pyproject.toml README.md ./

# 使用 uv 高速安装依赖
RUN uv pip install --system --no-cache -e .

# 复制应用源代码、脚本及资源
COPY app/ ./app/
COPY scripts/ ./scripts/
COPY skills/ ./skills/
COPY docs/ ./docs/

# 暴露 FastAPI HTTP 服务端口
EXPOSE 8010

# 默认启动容器入口

CMD ["python", "scripts/docker_entrypoint.py"]
