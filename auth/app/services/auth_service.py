from authlib.integrations.httpx_client import AsyncOAuth2Client
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.db_models import Company
from app.schemas.auth_schemas import OIDCClaims
from app.repositories.repository import (
    create_refresh_token_record,
    get_refresh_token_by_jti,
)
from joserfc import jwt as joserfc_jwt
from datetime import datetime, timedelta, timezone
import jwt
from app.core.config import settings
import uuid

async def build_authorization_url(company: Company, redirect_uri: str, state: str) -> str:
    async with httpx.AsyncClient() as http_client:
        discovery = await http_client.get(
            f"{company.oidc_issuer_url}/.well-known/openid-configuration"
        )
    auth_endpoint = discovery.json()["authorization_endpoint"]

    oauth_client = AsyncOAuth2Client(client_id=company.oidc_client_id)
    url, _ = oauth_client.create_authorization_url(
        auth_endpoint, redirect_uri=redirect_uri, state=state, scope="openid email profile"
    )
    return url

async def exchange_code_for_claims(company: Company, code: str, redirect_uri: str) -> OIDCClaims:
    async with httpx.AsyncClient() as http_client:
        discovery = await http_client.get(
            f"{company.oidc_issuer_url}/.well-known/openid-configuration"
        )
        token_endpoint = discovery.json()["token_endpoint"]
        jwks_uri = discovery.json()["jwks_uri"]

        token_response = await http_client.post(
            token_endpoint,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": company.oidc_client_id,
                "client_secret": company.oidc_client_secret,
            },
        )
        token_response.raise_for_status()
        tokens = token_response.json()

        jwks_response = await http_client.get(jwks_uri)
        jwks = jwks_response.json()

    claims = joserfc_jwt.decode(tokens["id_token"], jwks)
    claims.validate()

    return OIDCClaims(**claims.claims)

def create_access_token(user_id: int, company_id: int) -> str:
    payload = {
        "user_id": user_id,
        "company_id": company_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

async def create_refresh_token(db: AsyncSession, user_id: int, company_id: int) -> str:
    jti = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await create_refresh_token_record(db, jti, user_id, expires_at)

    payload = {
        "user_id": user_id,
        "company_id": company_id,
        "type": "refresh",
        "jti": jti,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

async def handle_refresh(db: AsyncSession, refresh_token: str) -> str:
    try:
        payload = jwt.decode(refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise ValueError("Refresh token expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid refresh token")

    if payload.get("type") != "refresh":
        raise ValueError("Wrong token type")

    stored = await get_refresh_token_by_jti(db, payload["jti"])

    if stored is None or stored.revoked:
        raise ValueError("Refresh token revoked or unknown")

    return create_access_token(payload["user_id"], payload["company_id"])