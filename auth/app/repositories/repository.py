from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Company, RefreshToken, User


async def get_company_by_domain(db: AsyncSession, domain: str) -> Company | None:
    result = await db.execute(select(Company).where(Company.domain == domain))
    return result.scalar_one_or_none()


async def get_company_by_id(db: AsyncSession, company_id: int) -> Company | None:
    result = await db.execute(select(Company).where(Company.id == company_id))
    return result.scalar_one_or_none()


async def get_or_create_user(db: AsyncSession, company_id: int, email: str) -> User:
    result = await db.execute(
        select(User).where(User.company_id == company_id, User.email == email)
    )
    user = result.scalar_one_or_none()

    if user is not None:
        return user

    user = User(company_id=company_id, email=email)
    db.add(user)
    await db.flush()
    return user


async def create_refresh_token_record(
    db: AsyncSession, jti: str, user_id: int, expires_at
) -> RefreshToken:
    refresh_token = RefreshToken(jti=jti, user_id=user_id, expires_at=expires_at)
    db.add(refresh_token)
    await db.flush()
    return refresh_token


async def get_refresh_token_by_jti(
    db: AsyncSession, jti: str
) -> RefreshToken | None:
    result = await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
    return result.scalar_one_or_none()
