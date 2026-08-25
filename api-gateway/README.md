# SecureStream API Gateway

The API gateway is a standalone FastAPI service in front of SecureStream backend services.

It currently:

- Verifies `Authorization: Bearer <access-token>` using the same JWT settings as auth-service.
- Requires `type == "access"` and valid `user_id`, `company_id`, and expiry claims.
- Removes client-supplied authorization and identity headers.
- Adds trusted `X-User-Id` and `X-Company-Id` headers before forwarding.
- Applies a Redis-backed sliding-window rate limit per `(company_id, user_id)`.
- Forwards requests to the configured upstream service.

Business authorization remains in the downstream service. The gateway does not query PostgreSQL.

## Local development

```bash
docker compose up --build
```

Gateway API docs are available at `http://localhost:8001/docs` and its health endpoint is `http://localhost:8001/health`.

Run gateway unit tests without Redis:

```bash
cd api-gateway
pytest -q
```

## Sliding-window rate limiting

Redis stores one sorted set per identity. Each request is inserted with its timestamp as the score. A Lua script atomically removes entries older than the configured window, checks the current count, and inserts the new request only when capacity remains. This avoids race conditions between separate cleanup, count, and insert commands and works consistently across multiple gateway replicas.

The current default is 60 requests per 60 seconds. Configure it with `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW_SECONDS`.

## Configuration

```dotenv
JWT_SECRET=local-development-secret
JWT_ALGORITHM=HS256
REDIS_URL=redis://localhost:6379/0
AUTH_SERVICE_URL=http://localhost:8000
RATE_LIMIT_REQUESTS=60
RATE_LIMIT_WINDOW_SECONDS=60
PUBLIC_PATHS=["/auth/login-init","/auth/callback","/auth/refresh"]
TRUSTED_PROXIES=[]
```

Inside Docker Compose, use `redis://redis:6379/0` and `http://auth:8000`; `localhost` refers to the gateway container itself.

`PUBLIC_PATHS` are matched exactly and skip token verification, so unauthenticated clients can reach the login endpoints. They are still rate limited, keyed by client IP instead of user.

`TRUSTED_PROXIES` lists the IPs or CIDR ranges allowed to assert a client IP through `X-Forwarded-For`. When empty, the header is ignored and the direct peer address is used, which is correct for local development. Behind a load balancer it must list the balancer's ranges, otherwise every anonymous request shares one rate-limit bucket.

## Signing keys

The gateway verifies tokens minted by auth-service. `HS256` is symmetric, so both services must be configured with the identical `JWT_SECRET` or verification fails.

The tradeoff is that a symmetric key lets every service holding it mint tokens, not only verify them. This is acceptable while auth-service and the gateway are the only holders. Before a third service needs verification, migrate to `RS256`: auth-service keeps the private key and signs, other services fetch only the public key and can verify but never issue. That change is limited to `create_access_token` in auth-service and `verify_access_token` here.
