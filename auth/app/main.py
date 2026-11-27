from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.db import engine
from app.routers.auth_router import router as auth_router

app = FastAPI(title="SecureStream Auth Service")

app.include_router(auth_router)


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    """Liveness: the process is up and serving requests."""
    return {"status": "ok"}


@app.get("/ready", tags=["ops"])
async def ready() -> JSONResponse:
    """Readiness: dependencies (Postgres) are reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "down"})
    return JSONResponse(content={"status": "ok", "database": "up"})
