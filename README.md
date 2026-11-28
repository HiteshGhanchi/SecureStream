# SecureStream

Secure, traceable video links for companies. Send a confidential video to anyone,
inside or outside your company: every viewer is identified, every view is measured,
and a leaked copy can be traced back to the person who leaked it.

> Status: early development (F0 and F1 done). **Start with [`docs/ROADMAP.md`](docs/ROADMAP.md)**:
> the product, the feature plan and its status, known bugs, and how we work.
> Key technical decisions are in [`docs/adr/`](docs/adr/).

## What's in this repo

| Folder | Service | Stack | State |
|---|---|---|---|
| [`auth/`](auth/AUTH_README.md) | Companies, users, SSO broker (OIDC per email domain), tokens | Python, FastAPI, SQLAlchemy, Alembic | Working; SSO callback bug fixed in F2 |
| [`api-gateway/`](api-gateway/API_README.md) | Token check, rate limits, routing | Python, FastAPI, Redis | Working; single upstream until F3 |
| `media-service/` | Videos, uploads, share links, playback | TypeScript, Express, Prisma | Skeleton (`/health`, `/ready`) until F4 |
| `media-service/streamflow-core-backend/` | StreamFlow's backend, copied as is | TypeScript, Express, Prisma | Ported into `media-service/src/` in F4, then removed |
| `video-processor/` | FFmpeg HLS worker (from StreamFlow) | TypeScript, Kafka | Copied as is; fixed in F2, hardened in F5 |
| `frontend/` | React app (from StreamFlow) | React, Vite, hls.js | Copied as is; does not build until F2 |
| `keycloak/` | Dev-only identity provider for sample tenant companies | Keycloak | Realms `companya`, `companyb` |
| `infra/` | Dev infrastructure config (object storage credentials) | SeaweedFS | Dev only |

Where the StreamFlow code came from: [`docs/reference/streamflow/IMPORT.md`](docs/reference/streamflow/IMPORT.md).

Shared infrastructure in compose: Postgres (one per service), Redis (rate limits), Kafka
(events, ADR 0004), S3-compatible object storage (SeaweedFS, private buckets `securestream-raw`
and `securestream-media`).

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
| localhost:9092 | Kafka (containers use `kafka:9094`) |
| http://localhost:8333 | S3 API (dev key in `infra/seaweedfs/s3.json`; anonymous access is denied) |

Sample tenants (all passwords `TestPassword123!`, dev-only):

| Company | Email domain | Users | Keycloak realm |
|---|---|---|---|
| Company A | `companya.com` | `alice@companya.com`, `bob@companya.com` | `companya` |
| Company B | `companyb.com` | `testuser@companyb.com` | `companyb` |

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
