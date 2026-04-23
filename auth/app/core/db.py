from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession
from typing import AsyncGenerator

engine = create_async_engine(settings.database_url)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session: # 1. opens a new Session
        yield session # 2. hands it out, PAUSES here
    # 3. nothing written here yet — but this is where execution resumes