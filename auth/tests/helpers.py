import jwt as pyjwt
from datetime import datetime, timedelta, timezone

from app.core.config import settings


def make_test_refresh_token(
    user_id: int,
    company_id: int,
    jti: str,
    expired: bool = False,
    secret: str | None = None,
) -> str:
    exp = datetime.now(timezone.utc) - timedelta(days=1) if expired else datetime.now(timezone.utc) + timedelta(days=7)
    payload = {
        "user_id": user_id,
        "company_id": company_id,
        "type": "refresh",
        "jti": jti,
        "exp": exp,
    }
    return pyjwt.encode(
        payload,
        settings.jwt_secret if secret is None else secret,
        algorithm=settings.jwt_algorithm,
    )


def make_test_access_token(
    user_id: int,
    company_id: int,
    expired: bool = False,
    secret: str | None = None,
) -> str:
    exp = datetime.now(timezone.utc) - timedelta(days=1) if expired else datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {
        "user_id": user_id,
        "company_id": company_id,
        "type": "access",
        "exp": exp,
    }
    return pyjwt.encode(
        payload,
        settings.jwt_secret if secret is None else secret,
        algorithm=settings.jwt_algorithm,
    )