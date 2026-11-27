import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.db_models import Base


@pytest.fixture
async def db():
    """
    Fixture providing a fresh AsyncSession for integration tests.

    For each test:
    1. Creates tables (if not exist)
    2. Yields a session
    3. Rolls back all changes after the test completes (isolation, not data protection)

    This fixture should only be used with a real ephemeral Postgres database
    (e.g., in CI with a service container), never against production data.
    """
    # Create async engine
    engine = create_async_engine(settings.database_url, echo=False)

    # Create sessionmaker
    async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    # Create all tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Yield a session for the test
    async with async_session_factory() as session:
        yield session

    # Rollback ensures isolation between tests
    await session.rollback()

    # Clean up: drop all tables and close engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()
