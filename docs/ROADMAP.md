# SecureStream roadmap

This file is the single source of truth for what we are building, in what order,
and how we work. Anyone who clones the repo (on any machine, human or tool) should
be able to pick up the next feature from here without any other context.

Last updated: 2026-11-28 (F0 and F1 done).

---

## 1. The product

**Secure, traceable video links for companies.** Send a confidential video to anyone,
inside or outside your company: every viewer is identified, every view is measured,
and a leaked copy can be traced back to the person who leaked it.

- **Senders** are company employees. They sign in with their company's own login
  (SSO via OIDC, routed by email domain). Every company's data is isolated from every
  other company.
- **Recipients** get their own short link, verify their email with a one-time code,
  and watch with a moving watermark showing their email and the time. Senders set
  expiry and view limits, can revoke, and see who watched and how far.
- **Business tier: leak tracing.** Two subtly marked renditions of each video; each
  viewer's playlist mixes 4-second segments in a pattern unique to them, so a leaked
  clip can be decoded back to one recipient.
- **Plans** (Free, Pro, Business) are paid through **Paddle**, in sandbox mode for now.
- Video is transcoded to adaptive HLS and only ever served from private storage.

Why this and not plain internal video hosting: see [ADR 0001](adr/0001-product-secure-video-links.md).

Scope of the current round: build the complete product **locally** (services, video
pipeline, frontend, billing in test mode), ready to deploy. Deploying to a cloud
(AWS/Azure/GCP free tiers) is a later, separate round.

## 2. Target architecture

```
Browser (React app)
   │  HTTPS
   ▼
api-gateway (FastAPI) ── verifies access tokens (RS256 via JWKS), rate limits per
   │                     tenant/plan, routes by path prefix, request ids
   ├── /auth/*        → auth (FastAPI)          companies, users, SSO, tokens, roles,
   │                                            billing (plans, subscriptions, Paddle)
   └── /api/media/*   → media-service (TS)      videos, uploads, share links, playback

media-service ──(transactional outbox + relay)──► Kafka ──► video-processor (TS, FFmpeg)
Object storage: SeaweedFS in dev (S3 API), S3 later. Private buckets only.
Postgres: auth-postgres and media-postgres. Redis: rate limits.
Keycloak: dev only, acts as the identity provider of the sample companies.
```

Decisions behind this are in [`docs/adr/`](adr/):

| ADR | Decision |
|---|---|
| [0001](adr/0001-product-secure-video-links.md) | Product: secure, traceable video links |
| [0002](adr/0002-service-trust-and-token-signing.md) | RS256 access tokens + JWKS; gateway forwards the user's token; every service verifies it; opaque rotating refresh tokens |
| [0003](adr/0003-user-identity-in-media-data.md) | Media stores `company_id` + `uploader_id` + a display snapshot; no user projection |
| [0004](adr/0004-event-pipeline-outbox-and-kafka.md) | Transactional outbox + small relay to Kafka; no Debezium; processor never touches a database |
| [0005](adr/0005-playback-security.md) | media-service serves playlists rewritten with short-lived presigned segment URLs; playback token in the query string |
| [0006](adr/0006-billing-placement-and-provider.md) | Billing lives in `auth`; Paddle behind a provider interface |

## 3. Feature plan

Each feature lands on `main` as a few focused commits once it works (see section 5).
Do them in this order; the "needs" column is the hard dependency.

| # | Feature | Needs | Status |
|---|---|---|---|
| F0 | Repo foundation | — | **Done** |
| F1 | Import StreamFlow code | F0 | **Done** |
| F2 | Fix known bugs | F1 | Next |
| F3a | Auth: asymmetric tokens, refresh rotation, logout | F2 | |
| F3b | Gateway: routing and trust | F3a | |
| F4 | Media service | F3b | |
| F5 | Outbox and hardened processor | F4 | |
| F6 | Adaptive streaming | F5 | |
| F7 | Secure playback and share links | F6 | |
| F7b | Leak tracing (first to cut if short on time) | F7 | |
| F8 | Roles, onboarding, admin | F3a | |
| F9 | Frontend (product UI) | F7, F8 | |
| F10 | Billing with Paddle (sandbox) | F8, F9 | |
| F11 | Observability | F5 | |
| F12 | Security hardening | all | |
| F13 | Production readiness (still local) | all | |

### F0. Repo foundation (done)
Per-service lint, type check and tests; `/health` and `/ready` everywhere; compose
with pinned images and healthchecks; Makefile; `.env.example` files; gitleaks in CI
and pre-commit; compose smoke test in CI; README and ADRs.

### F1. Import StreamFlow (done)
Plain copy from StreamFlow commit `3d081f3` (no history), no behaviour changes. See
[`reference/streamflow/IMPORT.md`](reference/streamflow/IMPORT.md) for where each
piece landed. Added the `companya` dev tenant, Kafka with topics, SeaweedFS with
private buckets.

### F2. Fix known bugs
Fix the bugs in section 4 marked **F2**, one commit per bug, each with a test or a
reproduction note. Start with the SSO callback: nothing works end to end without it.
Also add CI workflows for `frontend/` and `video-processor/` once they build.

### F3a. Auth: tokens
- Access tokens signed RS256 with a `kid`; JWKS at `/auth/.well-known/jwks.json`.
- Claims: `iss`, `aud`, `sub`, `cid` (company), `role`, `plan`, `jti`, `iat`, `exp`; 10-minute lifetime.
- Refresh tokens become opaque random strings stored hashed, rotated on every use, reuse
  detection (reusing one revokes the family). Logout endpoint.
- OIDC callback redirects to the frontend instead of returning JSON; cookies `Secure`
  outside dev; `oauth_state` cleared.
- Migration path: gateway accepts old HS256 tokens for one access-token lifetime behind a flag.

### F3b. Gateway
- Route by prefix: `/auth/*` → auth, `/api/media/*` → media-service.
- Forward the user's token (ADR 0002); never trust or forward client identity headers.
- Per-tenant and per-plan rate limits; decide and document fail-open vs fail-closed when Redis is down.
- Request id generated or propagated, structured JSON logs.
- Shared connection pool, explicit timeouts, clear 502/504; stream bodies; keep multiple
  `Set-Cookie` headers; don't forward `content-encoding` after decompression; CORS preflight.
- Only gateway, frontend, storage and dev Keycloak publish host ports (move the OIDC callback behind the gateway).
- Tests: routing, spoofed headers, expired/wrong-type/wrong-audience tokens, rate limits.

### F4. Media service
Port `media-service/streamflow-core-backend/` into `media-service/src/` (then delete it):
Prisma schema with `company_id` on every table (videos, share links, recipients,
outbox), one shared Prisma client, zod validation on every route, verify tokens via
JWKS (no Keycloak, no header trust), upload init/complete with content-type and size
limits (presigned POST or multipart; server stores the storage key), list/search/
paginate within the company, edit title/description, delete with storage cleanup,
view counts. Cross-tenant tests that must fail to read another company's data.

### F5. Outbox and hardened processor
Implement ADR 0004. Processor: idempotent (skip if already ready; deterministic output
keys), retries with backoff, `video.dlq` with a reason, graceful SIGTERM shutdown,
temp-file cleanup on every path, ffprobe validation, duration stored, status
`uploaded → processing → ready | failed` reported via events. Use
`@confluentinc/kafka-javascript` and spawn ffmpeg directly (fluent-ffmpeg is deprecated).

### F6. Adaptive streaming
HLS ladder (360p/720p/1080p, skipping renditions above the source; never upscale),
aligned keyframes, master playlist, poster/thumbnails, configurable segment length.
Measure transcode time per minute of video and record it in `docs/RESUME_FACTS.md`.

### F7. Secure playback and share links
Implement ADR 0005. Private buckets, playback authorised per user and company,
short-lived URLs. Share links: per-recipient short link, email one-time code,
viewer token scoped to that link, expiry, view limit, revoke, no download button,
moving watermark (email + time) in the player, playback heartbeats to Kafka for
analytics. Email in dev through Mailpit. Tests: another tenant, an anonymous user and
a revoked recipient cannot fetch playlists or segments.

### F7b. Leak tracing (Business tier)
Two marked renditions per traced video; per-viewer segment pattern in the playlist
rewrite; a detection tool that decodes a leaked clip to a viewer id. Doubles storage
and transcoding for traced videos only.

### F8. Roles, onboarding and admin
Roles per company: owner/admin, creator, viewer (stored in auth, carried in the
token). Self-serve onboarding: the owner signs up by email magic link, registers the
company and email domain, proves domain ownership with a DNS TXT record (dev can
simulate DNS), connects their OIDC IdP. Free-plan users may use magic-link login
until SSO is connected. Encrypt `oidc_client_secret` at rest (envelope encryption,
documented key rotation). Invite users, change roles, deactivate users. CSRF
protection for cookie-based endpoints.

### F9. Frontend
Build on StreamFlow's React app as one product:
- Public: landing page (product, plans and pricing, security story), sign in by email
  that starts the SSO flow (no keycloak-js; the app talks to `/auth/*`).
- App: links and viewer analytics, library (grid, search, filters, status, processing
  progress), upload (drag and drop, multipart progress), watch page (hls.js, quality
  switcher, poster, watermark), video settings, sharing, profile.
- Recipient view: email code screen, watch page.
- Admin: company settings, domain verification, IdP settings, users and roles, usage
  and plan, billing.
- Access token in memory, refresh via httpOnly cookie, automatic refresh, logout everywhere.
- Accessibility basics, responsive, loading and error states.
- Playwright end to end: sign in through dev Keycloak, upload a small video, wait for
  ready, play it, share it, open the link as a recipient.

### F10. Billing (Paddle sandbox)
Plans as data with limits (storage GB, transcode minutes/month, seats, active links,
max upload size, leak tracing), enforced in media-service with clear UI errors. Usage
counters per company per month. Paddle checkout and subscriptions, webhook endpoint
with signature verification and idempotency, states (trialing, active, past due,
cancelled), plan changes, invoices view. Multi-currency prices; Paddle handles tax/VAT
as merchant of record. No real payments this round. Write down (as a note, not code)
what Paddle needs before accepting live payments, with links.

### F11. Observability
Request ids end to end, structured logs everywhere, Prometheus metrics (per-route
rate/latency, transcode queue depth and duration, failures), OpenTelemetry tracing
only if it fits cleanly, optional Grafana dashboard in compose.

### F12. Security hardening
Security headers, strict CORS, input limits, dependency scanning in CI, non-root
minimal images, `docs/THREAT_MODEL.md` (assets, trust boundaries, top threats,
mitigations, out of scope, including: the watermark is a deterrent, DRM is out of
scope). Re-run the cross-tenant suite.

### F13. Production readiness (still local)
Production Dockerfiles, compose `prod` profile, database backup script, seed script for
two demo companies with sample videos, OpenAPI spec per service, `docs/ARCHITECTURE.md`
with a diagram, `docs/RUNBOOK.md`, `docs/DEPLOY_NOTES.md` (CPU/RAM per component; Kafka,
Keycloak and FFmpeg are the heavy ones). Do not deploy.

### Definition of done for this round
- `make up` starts everything; `make test` passes; CI green on `main`.
- A new company can onboard, verify its domain, connect its IdP, invite users, upload,
  transcode to multi-bitrate HLS, watch securely, and share a link with an outside
  recipient; another company cannot see any of it.
- A company can subscribe to a paid plan in sandbox; limits change; webhooks are
  verified and idempotent.
- `docs/` has ADRs, architecture, threat model, runbook, deploy notes, and
  `docs/RESUME_FACTS.md` with measured numbers only (test counts, transcode speed,
  latency of key endpoints under a small load test, number of services), each linked
  to how it was measured.

## 4. Known bugs and gaps

Found in a full review of both codebases on 2026-11-27. Tick them off as they are fixed.
"Where" is the feature that fixes it.

### Auth
- [ ] **SSO callback can never succeed** (F2). `auth_service.py` passes the raw JWKS dict to
  `joserfc.jwt.decode`, which raises `ValueError("Invalid key")` (returned as 404); then
  `claims.validate()` doesn't exist on joserfc's `Token`. Unit tests mock both calls. Fix:
  import the JWKS as a `KeySet`, validate `iss`, `aud`, `exp` with a claims registry, add
  nonce and PKCE, require `email_verified`, key users by `(issuer, sub)`. Marked `KNOWN BUG` in the code.
- [ ] IdP HTTP errors (token endpoint, discovery) surface as 500; discovery and JWKS are
  fetched on every login with no caching or timeout (F2).
- [ ] Callback returns JSON to the browser instead of redirecting to the app; cookies lack
  `Secure`; `oauth_state` cookie never cleared; no logout; refresh doesn't check the user is active (F3a).
- [ ] HS256 shared secret signs access and refresh tokens (F3a, ADR 0002).
- [ ] `oidc_client_secret` stored in plain text (F8).
- [ ] `login-init` 404 reveals which email domains are customers (F8, minor).
- [ ] Integration tests use `create_all`/`drop_all`, so they don't test migrations (CI does run them up/down/up) (F2).
- [ ] `users.manager_id` and `is_master_account` are unused; no role column (F8).
- [ ] Compose uses an `extra_hosts: localhost` hack so the issuer URL works in the container;
  replace with `KC_HOSTNAME` plus a backchannel URL (F2/F3).
- [ ] Docker image runs the seed and `--reload` on every start (dev only; F13 adds a prod image).

### API gateway (all F3b)
- [ ] New HTTP client per request; default 5 s timeout; slow upstreams give 500 not 504, down upstreams 500 not 502.
- [ ] Buffers whole request and response bodies.
- [ ] Collapses multiple `Set-Cookie` headers into one.
- [ ] Forwards `content-encoding` after httpx decompressed the body.
- [ ] CORS preflight `OPTIONS` gets 401.
- [ ] Redis down → every request 500.
- [ ] Single upstream; downstream identity-header trust model (replaced by ADR 0002).
- [ ] Duplicate `date`/`server` response headers.

### media-service / StreamFlow backend (F2 where marked, rest F4)
- [ ] Full bearer token written to logs (`middleware/auth.ts`) (F2).
- [ ] A `PrismaClient` per file (3 pools) (F2).
- [ ] JWT check has no `iss`/`aud` validation (removed in F4).
- [ ] `upload/complete` trusts a client-supplied `fileKey`; storage key never saved; no size or content-type limit (F4).
- [ ] JIT user upsert on every request, everyone becomes `creator`, global unique email (removed in F4).
- [ ] `Dockerfile.prod` fetches unpinned `prisma`/`tsx` at build/run time; port 3000 vs 3001 mismatch (F4).
- [ ] Debug endpoint `/api/test`; hot-reloaded `config.json` whose values are unused (F4).
- [ ] 3 high npm advisories via the Prisma CLI's `effect` dependency (GHSA-7589-6fvf-x4pw); recheck in F4.

### video-processor (F2 where marked, rest F5/F6)
- [ ] Reads `process.env.DATABASE_URL_None` (typo) (F2).
- [ ] Writes a hard-coded `http://localhost:9000/...` HLS URL (F2).
- [ ] `Dockerfile.prod` runs `node src/index.js`, which doesn't exist (no build step); `/app/temp` not writable as `node` (F2).
- [ ] Env var names differ from the backend, with silent defaults (`admin`/`password`, wrong bucket names) (F2).
- [ ] Not in compose (F2 or F5).
- [ ] Errors swallowed and offset committed: failed videos stay `uploaded` forever; no retries, DLQ or idempotency (F5).
- [ ] Rebuilds the raw object key from the title (breaks when titles are editable) (F4/F5).
- [ ] Only SIGINT handled; Docker sends SIGTERM (F5).
- [ ] Long transcodes exceed the KafkaJS session timeout → rebalances and duplicate work (F5).
- [ ] `baseline` profile at level 3.0 is too low for 720p; upscales small sources (F6).
- [ ] `fluent-ffmpeg` deprecated; both `ffmpeg-static` and system ffmpeg bundled (F5).
- [ ] KafkaJS unmaintained since Feb 2023 (F5: switch client).

### frontend (F2 makes it build; F9 rebuilds it)
- [ ] `npm run build` fails with 8 TypeScript errors: imports from `./contexts/` (folder is `context/`),
  undefined `initializeApp()`, two type-only imports, wrong props in `DashboardPage` and `VideoWatchPage` (F2).
- [ ] `/api/config` gives the browser `http://keycloak:8080` (container hostname) (F2).
- [ ] Vite proxy targets `localhost` inside the container (F2).
- [ ] Pages (Landing, Dashboard, Watch, Profile) aren't wired into `App.tsx`; Keycloak token never refreshed (F9).
- [ ] Public HLS bucket in the old setup (fixed by design: buckets are private; playback in F7).

### Already fixed
- [x] media-postgres port clash and shared volume (F0).
- [x] Committed `media-service/dist/` and `strict-ssl=false` in `.npmrc` (F0).
- [x] Unpinned images; MinIO replaced by SeaweedFS since MinIO no longer publishes images (F0, F1).
- [x] No secret scanning (gitleaks in CI and pre-commit, F0).

## 5. How we work

### Git
- Work in this repository only. StreamFlow (https://github.com/HiteshGhanchi/StreamFlow)
  is a read-only source; never push to it.
- **No pull requests.** When a feature or a bug fix is done and `make lint` and
  `make test` pass locally, commit and push straight to `main`. CI runs on every push.
  Keep history linear (no merge commits).
- Commit messages: **one line, past tense, plain words, no prefix, no body, no trailers**.
  Examples: "Added Dockerfile and .dockerignore to the auth module",
  "Fixed media-postgres port and volume in compose". No co-author lines and no mention
  of AI or tools anywhere in commits or files.
- Several small commits per feature are better than one large one (for example one per bug in F2).
- Pushing: the `origin` remote is HTTPS. If your machine has no GitHub HTTPS login,
  push over SSH: `git push git@github.com:HiteshGhanchi/SecureStream.git main`.
- Never commit secrets, `.env` files, build output or `node_modules`. Only `.env.example`
  files. Install the hooks once with `make hooks` (gitleaks, ruff, whitespace).

### Engineering rules
- Each service: typed config validated at start-up, structured JSON logs with a request
  id, `/health` and `/ready`, unit tests, integration tests against real Postgres/Redis/
  Kafka via compose, lint and type check in CI.
- Database changes only through migrations (Alembic in `auth/`, Prisma Migrate in `media-service/`).
- Every row of tenant data carries `company_id` and every query filters by it. Write
  tests that try to read another company's data and must fail.
- Prefer boring, well-known libraries. Check current versions and docs before adding
  anything; cite sources in ADRs. Pin image tags (never `latest`).
- Record decisions in `docs/adr/` (one short file each: context, options, decision,
  consequences). Update this roadmap when a feature finishes or a plan changes.
- Be direct: if a planned item turns out wrong or not worth it, say so and write down why.

### Setting up on a new machine
```bash
git clone git@github.com:HiteshGhanchi/SecureStream.git && cd SecureStream
make setup          # Python virtualenvs + npm install
make up             # starts the stack, waits for every healthcheck
make lint && make test
```
Needs Docker with Compose v2, Python 3.12, Node 22+, `make`. If a host port is taken
(for example a local Postgres on 5432), override it: `AUTH_DB_PORT=55432 make up` and
`make test AUTH_DB_PORT=55432` (all overridable ports are in `.env.example`).

### Decisions already made
- Product: secure video links (ADR 0001). Name: SecureStream (check trademark before selling).
- Payments: Paddle, sandbox only this round.
- Events: Kafka, via outbox + relay; Debezium dropped.
- StreamFlow import: plain copy with a provenance note (no history).
- Dev object storage: SeaweedFS.
- TypeScript 6 in `media-service` (typescript-eslint does not support TS 7 yet).

### Still open
- Plan prices and currencies (decide in F10).
- Whether to keep Kafka in the cloud round or swap to a managed queue / Postgres (decide in the deploy round; code stays behind an interface).
