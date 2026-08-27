# 常用开发命令。Windows 可用 `make <target>`（装 GNU Make）或直接复制命令执行。
.PHONY: install dev lint format typecheck test check infra run

install:          ## 安装依赖（含 dev）
	pip install -e ".[dev]"

infra:            ## 启动本地基础设施
	docker compose up -d

run:              ## 启动应用（开发模式，热重载）
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8010


lint:             ## ruff 检查
	ruff check app tests

format:           ## ruff 格式化
	ruff format app tests

typecheck:        ## mypy 类型检查
	mypy app

test:             ## 运行测试
	pytest

check: lint typecheck test  ## 提交前全套检查
