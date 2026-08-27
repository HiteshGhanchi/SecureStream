# SecureStream Auth Service

The `auth` module is a standalone FastAPI service that acts as SecureStream's multi-tenant SSO broker.

Each company registers an OIDC-compatible identity provider (IdP), such as Keycloak, Google Workspace, Okta, or another OIDC provider. SecureStream routes a login to the correct IdP using the user's email domain. After the IdP authenticates the user, this service verifies the IdP identity and issues SecureStream's own access and refresh tokens for application sessions.

SAML is intentionally out of scope. OIDC is the supported federation protocol.

## Responsibilities

- Map an email domain to a registered company and its OIDC configuration.
- Discover each company's OIDC endpoints dynamically.
- Redirect users to their company's IdP.
- Verify the callback state before contacting the database or IdP.
- Exchange the authorization code for tokens.
- Verify the IdP `id_token` with the IdP's JWKS.
- JIT-provision users inside the correct company tenant.
- Issue SecureStream access and refresh JWTs.
- Persist refresh-token JTIs so refresh sessions can be revoked.

Other services will eventually trust SecureStream access tokens through an API gateway. Access-token verification middleware is intentionally not part of this module.

## Endpoints

All routes are prefixed with `/auth`.

### `POST /auth/login-init`

Starts login for an email address.

Request body:

```json
{
  "email": "user@example.com"
}
```

Behavior:

1. Pydantic validates the email using `EmailStr`.
2. The email domain is looked up in the `companies` table.
3. An unknown domain returns HTTP `404`.
4. The service fetches the company's OIDC discovery document from:
   `{oidc_issuer_url}/.well-known/openid-configuration`.
5. The discovered `authorization_endpoint` is used to build the IdP URL.
6. A random state value containing the company ID is placed in an `oauth_state` httpOnly cookie.
7. The redirect URL is returned as JSON.

Response shape:

```json
{
  "redirect_url": "https://idp.example.com/authorize?..."
}
```

The state cookie is `httpOnly`, `SameSite=Lax`, and expires after 600 seconds.

### `GET /auth/callback`

Receives the browser redirect from the IdP after successful authentication.

Expected query parameters:

- `code`: short-lived, single-use authorization code.
- `state`: the state value sent during login initiation.

The callback first compares the query-string state with the `oauth_state` cookie. A missing or mismatched value returns HTTP `400` before any database or IdP call is made.

After state validation, the service:

1. Recovers the company ID from state and loads the company.
2. Exchanges the authorization code at the discovered `token_endpoint`.
3. Sends `grant_type`, `code`, the exact same `redirect_uri`, client ID, and client secret.
4. Fetches the discovered `jwks_uri` and verifies the IdP `id_token` signature.
5. Validates the resulting `sub`, `email`, and `email_verified` claims through `OIDCClaims`.
6. Finds or creates the user using `(company_id, email)`.
7. Issues a SecureStream access JWT and refresh JWT.
8. Stores the refresh-token JTI in the database before returning the JWT.

The access token is returned in the JSON response. The refresh token is set as an httpOnly cookie.

### `POST /auth/refresh`

Uses the `refresh_token` httpOnly cookie to issue a new access token.

The service independently handles these rejection cases:

- Missing cookie.
- Expired JWT.
- Invalid signature or malformed JWT.
- Wrong token type.
- Unknown JTI.
- Revoked JTI.

A valid JWT is not sufficient by itself: its JTI must exist in `refresh_tokens` and must not be revoked.

Response shape:

```json
{
  "access_token": "<new SecureStream access JWT>"
}
```

## OIDC Flow

OIDC is an identity layer built on OAuth 2.0. The browser-facing authorization step and the server-facing token exchange are separate:

1. SecureStream sends the user to the IdP authorization endpoint.
2. The user authenticates at the IdP.
3. The IdP redirects back with a short-lived authorization `code` and the original `state`.
4. SecureStream sends the code directly to the IdP token endpoint.
5. The IdP returns an `id_token` and usually an access token.
6. SecureStream uses the `id_token` for identity, after signature verification.

The IdP's access token is not SecureStream's access token. It would only be needed if SecureStream had to call an IdP API on the user's behalf. SecureStream instead creates its own application tokens.

### Client ID and client secret

The `client_id` identifies the registered SecureStream client at a company's IdP. The `client_secret` proves that the server exchanging the authorization code is the legitimate confidential client. The secret is used only in the server-to-server token exchange and must never be placed in a browser URL or committed to source control.

### ID-token verification

Decoding a JWT only reveals its payload. It does not prove that the IdP issued or signed it. The service therefore obtains the IdP's real JWKS through OIDC discovery and passes those keys to `joserfc` for signature verification and claim validation before constructing the typed `OIDCClaims` model.

## Token Model

SecureStream creates two JWT types using the configured signing secret:

### Access token

- Short-lived; configured by `ACCESS_TOKEN_EXPIRE_MINUTES` and defaults to 30 minutes.
- Claims: `user_id`, `company_id`, `type: access`, and `exp`.
- Returned in the response body.
- Intended for an `Authorization: Bearer` header when calling other services.

### Refresh token

- Long-lived; currently 7 days.
- Claims: `user_id`, `company_id`, `type: refresh`, `jti`, and `exp`.
- Stored in an httpOnly cookie.
- Its JTI is persisted in `refresh_tokens` before the JWT is returned.

The database record is what makes revocation possible. A signed, unexpired refresh JWT with an unknown or revoked JTI is rejected.

## Multi-Tenancy and Provisioning

`Company` stores the tenant's domain and OIDC settings. `User` stores the SecureStream-side identity for that tenant.

User lookups always use both `company_id` and `email`. The database also enforces this with the composite unique constraint `uq_user_company_email`. The first successful login automatically creates the user; there is no separate signup step.

The IdP authenticates identity but does not know SecureStream's application hierarchy. Fields such as `manager_id` are SecureStream-owned data and are initially left null during JIT provisioning. They can be managed later by application administration logic.

## Layering

The module follows these boundaries:

- `app/routers/auth_router.py`: HTTP concerns, dependency injection, cookies, response shaping, and status codes.
- `app/services/auth_service.py`: OIDC orchestration, token creation and verification, and login provisioning flow.
- `app/repositories/repository.py`: all SQLAlchemy queries and database persistence helpers.
- `app/models/db_models.py`: SQLAlchemy table mappings and constraints.
- `app/schemas/auth_schemas.py`: runtime-validated request, response, and OIDC claim models.
- `app/core/config.py`: typed environment configuration.
- `migrations/`: versioned Alembic schema changes.

Keeping queries in repositories means the router does not need to know how data is stored, and keeping OIDC/token orchestration in the service makes the HTTP layer thin.

## Configuration

Settings are loaded once through `pydantic-settings` in `app/core/config.py`. Environment variables are preferred in CI and deployment; a local `.env` file is supported.

Required settings:

```dotenv
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/securestream
JWT_SECRET=replace-with-a-local-secret
OIDC_REDIRECT_BASE_URL=http://localhost:8000
```

Optional settings:

```dotenv
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Do not commit `.env` files or real client secrets.

## Async FastAPI and SQLAlchemy

FastAPI is an ASGI framework. An `async def` route runs on the event-loop thread and can serve other work whenever it reaches a cooperative `await`, such as an async HTTP request or an async database query.

Declaring a function `async` does not automatically make every operation non-blocking. A synchronous, CPU-heavy call inside an async route can still block the event loop until it finishes. For this service, async `httpx` and SQLAlchemy with `asyncpg` handle the I/O-bound work. JWT cryptographic operations are normally small enough that they do not need special offloading.

FastAPI runs ordinary `def` route functions in a worker thread. For genuinely expensive work inside an async route, an explicit thread or process offload may be appropriate. Python threads do not generally provide parallel execution for Python bytecode because of the GIL; separate processes are needed for true CPU parallelism, unless a native extension releases the GIL.

### Engine, session factory, and dependency

`create_async_engine()` creates the application's connection-pool manager. It is created once and reused. `async_sessionmaker` creates a fresh `AsyncSession` for each request. Sessions must not be shared between concurrent requests because a session tracks transaction state and pending objects.

`get_db()` uses `yield` so FastAPI can keep the session available while the route runs and then resume the dependency for cleanup. A `return` inside the `async with` block would finish the function immediately and close the session before the route could use it.

`expire_on_commit=False` keeps already-loaded ORM attributes available after commit, which is convenient when the route still needs to serialize an object after committing.

## Transactions: `flush()` and `commit()`

`session.add()` only registers an object in the SQLAlchemy session. `await session.flush()` sends pending SQL to PostgreSQL and obtains generated values such as an auto-incremented ID, but the transaction remains open and reversible.

`await session.commit()` finalizes the transaction. The changes become visible to other connections and cannot be undone with a later rollback.

Repositories use `flush()` when the caller needs generated IDs but should retain control of the larger transaction. The callback handler commits the user-provisioning work and the refresh-token record before completing the response.

A rollback cancels the current uncommitted transaction. This is why transaction boundaries matter: related writes can succeed or fail together.

## Database Migrations

Models describe the intended schema in Python. Alembic migrations are the versioned instructions that create or alter the real PostgreSQL schema.

Typical commands from the `auth/` directory:

```bash
alembic revision --autogenerate -m "describe schema change"
alembic upgrade head
```

Autogeneration writes a migration file; it does not apply it. `alembic upgrade head` applies the migration chain and records the current revision in `alembic_version`.

The migration environment uses the configured database URL and a short-lived migration engine with `NullPool`. Unlike the application server, a migration process runs briefly and does not benefit from keeping a pool of reusable connections alive.

## Testing

The test suite follows a testing pyramid:

- Unit tests are fast and isolated. They mock database and network boundaries.
- Integration tests use a real PostgreSQL service and test actual SQL, foreign keys, unique constraints, and repository behavior.
- Browser E2E testing and stress testing are intentionally outside this module's scope.

Run unit tests locally:

```bash
cd auth
pytest tests/ -v -m "not integration"
```

Run integration tests when PostgreSQL is available and configured:

```bash
cd auth
pytest tests/ -v -m integration
```

The integration marker is registered in `pytest.ini`. The repository integration tests use the `db` fixture to create an async session, exercise repository functions without mocks, and isolate each test transaction. In CI, the tests run against an ephemeral PostgreSQL service container after migrations have been applied.

Unit coverage includes:

- Access-token payload and expiry.
- Refresh-token creation and JTI persistence behavior.
- Valid, expired, revoked, and unknown-JTI refresh paths.
- Dynamic authorization URL construction.
- Successful OIDC code exchange and token-endpoint failure.

The GitHub Actions workflow runs on pushes and pull requests affecting `auth/**`. It starts PostgreSQL, runs `alembic upgrade head`, runs unit tests excluding integration tests, and then runs the integration-marked tests.

## Project Layout

```text
auth/
├── app/
│   ├── core/              # Settings, database engine, FastAPI dependencies
│   ├── models/            # SQLAlchemy models and constraints
│   ├── repositories/      # Database queries
│   ├── routers/           # HTTP endpoints
│   ├── schemas/           # Pydantic models
│   └── services/          # OIDC, provisioning, and JWT logic
├── migrations/            # Alembic migrations
├── tests/                 # Unit and integration tests
├── alembic.ini
├── pytest.ini
└── requirements.txt
```

## Out of Scope

- SAML support.
- Access-token verification middleware; that belongs in the future API gateway.
- Browser E2E automation for Keycloak login.
- Stress and load testing before multiple services exist.
