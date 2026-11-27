import time
import uuid

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app.core.config import settings
from app.proxy import forward_request
from app.rate_limit import SlidingWindowRateLimiter
from app.security import GatewayIdentity, get_client_ip, get_identity, is_public_path

app = FastAPI(title="SecureStream API Gateway")
redis = Redis.from_url(settings.redis_url, decode_responses=True)
rate_limiter = SlidingWindowRateLimiter(
    redis,
    requests=settings.rate_limit_requests,
    window_seconds=settings.rate_limit_window_seconds,
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness: the process is up and serving requests."""
    return {"status": "ok"}


@app.get("/ready")
async def ready() -> JSONResponse:
    """Readiness: Redis (rate limiting) is reachable."""
    try:
        await redis.ping()
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable", "redis": "down"})
    return JSONResponse(content={"status": "ok", "redis": "up"})


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def gateway(request: Request, path: str):
    identity: GatewayIdentity | None = None
    if is_public_path(path):
        limiter_key = f"gateway:rate:anonymous:{get_client_ip(request)}"
    else:
        identity = get_identity(request)
        limiter_key = f"gateway:rate:{identity.company_id}:{identity.user_id}"

    allowed = await rate_limiter.allow(limiter_key, time.time(), str(uuid.uuid4()))
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded"},
        )

    return await forward_request(request, identity, path)
