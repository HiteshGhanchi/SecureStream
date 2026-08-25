import os

os.environ.setdefault("JWT_SECRET", "test-secret")

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.security import verify_access_token


def token(**claims: object) -> str:
    return jwt.encode(
        {
            "user_id": 1,
            "company_id": 2,
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            **claims,
        },
        "test-secret",
        algorithm="HS256",
    )


def test_verify_access_token_returns_identity() -> None:
    identity = verify_access_token(token())
    assert identity.user_id == 1
    assert identity.company_id == 2


def test_verify_access_token_rejects_wrong_type() -> None:
    with pytest.raises(HTTPException, match="Wrong token type"):
        verify_access_token(token(type="refresh"))


def test_verify_access_token_rejects_expired_token() -> None:
    expired = jwt.encode(
        {"user_id": 1, "company_id": 2, "type": "access", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        "test-secret",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException, match="expired"):
        verify_access_token(expired)
