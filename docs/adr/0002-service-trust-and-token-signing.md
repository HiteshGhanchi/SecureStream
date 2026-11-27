# ADR 0002: Service-to-service trust and token signing

- Status: accepted
- Date: 2026-11-27

## Context

Auth issues HS256 access and refresh tokens with one shared secret. The gateway
verifies them with that same secret, so it could also mint tokens. The gateway
injects `X-User-Id` / `X-Company-Id`; any service that trusted those headers could
be impersonated by anything that reaches it directly (auth is published on host
port 8000 today). More services (media, processor) will need to verify identity.

## Options

1. Gateway forwards the user's access token; every service verifies it.
2. Gateway mints a short-lived internal token signed with a key only it holds.
3. Network isolation plus trusted headers.

Each pairs with moving from HS256 to an asymmetric algorithm, so services can verify but not mint.

## Decision

Option 1 with RS256.

- Auth holds the private key and publishes a JWKS at `/auth/.well-known/jwks.json` (keys identified by `kid`; two keys during rotation).
- Access token claims: `iss`, `aud` (list of services), `sub` (user id), `cid` (company id), `role`, `plan`, `jti`, `iat`, `exp`. Lifetime 10 minutes.
- The gateway verifies and forwards the original token; each service verifies it again (`iss`, `aud`, `exp`, algorithm pinned). No service trusts identity headers.
- Refresh tokens become opaque random strings stored hashed, rotated on every use, with reuse detection (a reused token revokes the whole family).
- Only the gateway, frontend, object storage and dev Keycloak publish host ports.
- Migration: for one access-token lifetime the gateway also accepts HS256 tokens behind a flag; then that path is deleted.

RS256 over EdDSA: universally supported by JWT libraries and managed gateways; size and speed differences do not matter at our volume.

## Consequences

- Option 2 rejected: makes the gateway a second token issuer with its own key to protect, for little gain over `aud` checks.
- Option 3 rejected as the only control: one misconfigured port or SSRF breaks all isolation.
- Every service needs a small JWKS-caching verifier (PyJWT `PyJWKClient` in Python, `jose` in TypeScript).
- Short access tokens bound revocation delay to 10 minutes.
- Implemented in F3a (auth) and F3b (gateway).
