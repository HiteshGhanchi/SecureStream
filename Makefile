# SecureStream developer commands. Run `make help` for the list.
SHELL := /bin/bash
PY_SERVICES := auth api-gateway
COMPOSE := docker compose

# Integration tests reach the compose Postgres on the host port.
AUTH_DB_PORT ?= 5432
AUTH_TEST_DB := postgresql+asyncpg://postgres:postgres@localhost:$(AUTH_DB_PORT)/securestream_auth_test

.DEFAULT_GOAL := help
.PHONY: help setup up down reset logs ps test test-unit test-integration lint fmt hooks

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

setup: ## Create per-service virtualenvs and install Node dependencies
	@for s in $(PY_SERVICES); do \
		echo "==> $$s"; python3 -m venv $$s/.venv && $$s/.venv/bin/pip install -q -r $$s/requirements-dev.txt; \
	done
	cd media-service && npm ci --ignore-scripts

up: ## Build and start the stack, wait until every service is healthy
	$(COMPOSE) up -d --build --wait --wait-timeout 300
	@$(COMPOSE) ps --format 'table {{.Service}}\t{{.Status}}'

down: ## Stop the stack (keeps data volumes)
	$(COMPOSE) down

reset: ## Stop the stack and delete its data volumes
	$(COMPOSE) down -v

logs: ## Follow logs of all services
	$(COMPOSE) logs -f

ps: ## Show service status
	$(COMPOSE) ps

test: test-unit test-integration ## Run all tests (integration needs `make up`)

test-unit: ## Unit tests for every service (no containers needed)
	cd auth && JWT_SECRET=test DATABASE_URL=$(AUTH_TEST_DB) OIDC_REDIRECT_BASE_URL=http://localhost:8000 \
		.venv/bin/pytest -q -m "not integration"
	cd api-gateway && .venv/bin/pytest -q
	cd media-service && npm test

test-integration: ## Integration tests against the compose databases
	$(COMPOSE) exec -T auth-postgres psql -U postgres -tc \
		"SELECT 1 FROM pg_database WHERE datname='securestream_auth_test'" | grep -q 1 || \
		$(COMPOSE) exec -T auth-postgres psql -U postgres -c "CREATE DATABASE securestream_auth_test"
	cd auth && JWT_SECRET=test DATABASE_URL=$(AUTH_TEST_DB) OIDC_REDIRECT_BASE_URL=http://localhost:8000 \
		.venv/bin/alembic upgrade head && \
		JWT_SECRET=test DATABASE_URL=$(AUTH_TEST_DB) OIDC_REDIRECT_BASE_URL=http://localhost:8000 \
		.venv/bin/pytest -q -m integration

lint: ## Lint and type check every service
	@for s in $(PY_SERVICES); do \
		echo "==> $$s"; (cd $$s && .venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/mypy app) || exit 1; \
	done
	cd media-service && npm run lint && npm run typecheck

fmt: ## Auto-format Python code
	@for s in $(PY_SERVICES); do (cd $$s && .venv/bin/ruff check --fix . && .venv/bin/ruff format .); done

hooks: ## Install the pre-commit hooks (gitleaks, ruff, whitespace)
	pip install --user pre-commit && pre-commit install
