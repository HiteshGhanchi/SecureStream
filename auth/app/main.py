from fastapi import FastAPI

from app.routers.auth_router import router as auth_router

app = FastAPI(title="SecureStream Auth Service")

app.include_router(auth_router)