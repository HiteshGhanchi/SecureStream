# SecureStream

Secure, traceable video links for companies. Send a confidential video to anyone,
inside or outside your company: every viewer is identified, every view is measured,
and a leaked copy can be traced back to the person who leaked it.

> Status: early development (feature F0, repository foundation). The product
> direction and key technical decisions are recorded in [`docs/adr/`](docs/adr/).

## What's in this repo

| Folder | Service | Stack | State |
|---|---|---|---|
| [`auth/`](auth/AUTH_README.md) | Companies, users, SSO broker (OIDC per email domain), tokens | Python, FastAPI, SQLAlchemy, Alembic | Working; SSO callback bug fixed in F2 |
| [`api-gateway/`](api-gateway/API_README.md) | Token check, rate limits, routing | Python, FastAPI, Redis | Working; single upstream until F3 |
| `media-service/` | Videos, uploads, share links, playback | TypeScript, Express, Prisma | Skeleton (`/health`, `/ready`) until F4 |
| `keycloak/` | Dev-only identity provider for sample tenant companies | Keycloak | Realm `companyb` |

Planned (later features): `video-processor/` (FFmpeg HLS worker), `frontend/` (React app),
both ported from StreamFlow in F1.

## Quick start

Requirements: Docker with Compose v2, Python 3.12, Node 22+, `make`.

```bash
make setup      # per-service virtualenvs + npm install (needed for tests and lint)
make up         # build and start everything; waits until all services are healthy
make test       # unit tests, then integration tests against the compose databases
make lint       # ruff + mypy (Python), eslint + tsc (TypeScript)
make help       # every command
```

`make up` works without a `.env` file: every setting has a dev-only default in
[`docker-compose.yml`](docker-compose.yml). To override one (for example a host port
already in use on your machine), copy [`.env.example`](.env.example) to `.env`:

```bash
AUTH_DB_PORT=55432 make up
make test AUTH_DB_PORT=55432
```

### Local endpoints

| URL | What |
|---|---|
| http://localhost:8001 | API gateway (the only API entry point once F3 lands) |
| http://localhost:8000 | Auth service (published only until F3 moves the OIDC callback behind the gateway) |
| http://localhost:8080 | Keycloak admin (dev credentials `admin` / `admin`) |
| localhost:5432 / 5433 | auth-postgres / media-postgres |

Sample tenant: email domain `companyb.com`, user `testuser@companyb.com` in the
Keycloak realm `companyb`. All credentials in this repo are dev-only.

## How we work

- Work lands directly on `main` when a feature or bug fix is done: small, focused commits with clear messages, linear history (no merge commits).
- Run `make lint` and `make test` before pushing; CI runs on every push to `main`.
- Database changes only through migrations (Alembic in `auth/`, Prisma Migrate in `media-service/`).
- Every row of tenant data carries `company_id` and every query filters by it.
- Secrets never enter git: `.env.example` files only, gitleaks in CI and as a pre-commit hook (`make hooks`).
- Decisions go in [`docs/adr/`](docs/adr/) (context, options, decision, consequences).

## CI

Each service has its own workflow with path filters (`.github/workflows/`): lint, type check,
tests (integration tests use real Postgres/Redis service containers), plus a full-history
gitleaks scan and a compose smoke test that starts the whole stack and waits for every healthcheck.
