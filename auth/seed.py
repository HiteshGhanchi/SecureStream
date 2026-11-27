import asyncio

from sqlalchemy import select

from app.core.db import async_session_factory, engine
from app.models.db_models import Company

# Dev-only tenants, each backed by a realm in keycloak/import/.
# The client secrets only work against the local Keycloak.
DEV_COMPANIES = [
    {
        "domain": "companya.com",
        "oidc_issuer_url": "http://localhost:8080/realms/companya",
        "oidc_client_id": "securestream-auth",
        "oidc_client_secret": "dev-only-companya-secret-do-not-use-in-prod",  # noqa: S105
    },
    {
        "domain": "companyb.com",
        "oidc_issuer_url": "http://localhost:8080/realms/companyb",
        "oidc_client_id": "securestream-auth",
        "oidc_client_secret": "dev-only-fixed-secret-do-not-use-in-prod",  # noqa: S105
    },
]


async def seed() -> None:
    async with async_session_factory() as session:
        for data in DEV_COMPANIES:
            result = await session.execute(select(Company).where(Company.domain == data["domain"]))
            if result.scalar_one_or_none() is not None:
                print(f"Company '{data['domain']}' already exists, nothing to seed.")
                continue
            session.add(Company(**data))
            print(f"Seeded company '{data['domain']}'.")
        await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
