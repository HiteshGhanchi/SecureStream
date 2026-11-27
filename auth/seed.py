import asyncio

from sqlalchemy import select

from app.core.db import async_session_factory, engine
from app.models.db_models import Company

COMPANY_DOMAIN = "companyb.com"


async def seed() -> None:
    async with async_session_factory() as session:
        result = await session.execute(select(Company).where(Company.domain == COMPANY_DOMAIN))
        if result.scalar_one_or_none() is not None:
            print(f"Company '{COMPANY_DOMAIN}' already exists, nothing to seed.")
        else:
            session.add(
                Company(
                    domain=COMPANY_DOMAIN,
                    oidc_issuer_url="http://localhost:8080/realms/companyb",
                    oidc_client_id="securestream-auth",
                    oidc_client_secret="dev-only-fixed-secret-do-not-use-in-prod",  # noqa: S106 (dev seed)
                )
            )
            await session.commit()
            print(f"Seeded company '{COMPANY_DOMAIN}'.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
