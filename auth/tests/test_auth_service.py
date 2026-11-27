from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import parse_qs, urlparse

import jwt as pyjwt
import pytest

from app.core.config import settings
from app.models.db_models import RefreshToken
from app.schemas.auth_schemas import OIDCClaims
from app.services import auth_service
from tests.helpers import make_test_refresh_token


def make_company():
    company = MagicMock()
    company.oidc_issuer_url = "https://issuer.example.com"
    company.oidc_client_id = "client-id"
    company.oidc_client_secret = "client-secret"
    return company


def make_response(json_data):
    response = MagicMock()
    response.json.return_value = json_data
    return response


@pytest.mark.asyncio
async def test_handle_refresh_valid_token():
    fake_jti = "test-jti-123"
    fake_token = make_test_refresh_token(user_id=1, company_id=2, jti=fake_jti)

    fake_stored = RefreshToken(
        jti=fake_jti,
        user_id=1,
        revoked=False,
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )

    mock_db = AsyncMock()

    with patch.object(auth_service, "get_refresh_token_by_jti", new=AsyncMock(return_value=fake_stored)):
        new_access_token = await auth_service.handle_refresh(mock_db, fake_token)

    assert new_access_token is not None


@pytest.mark.asyncio
async def test_handle_refresh_expired_token():
    fake_token = make_test_refresh_token(user_id=1, company_id=2, jti="test-jti-expired", expired=True)

    mock_db = AsyncMock()

    with pytest.raises(ValueError, match="expired"):
        await auth_service.handle_refresh(mock_db, fake_token)


@pytest.mark.asyncio
async def test_handle_refresh_revoked_token():
    fake_jti = "test-jti-revoked"
    fake_token = make_test_refresh_token(user_id=1, company_id=2, jti=fake_jti)

    fake_stored = RefreshToken(
        jti=fake_jti,
        user_id=1,
        revoked=True,
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )

    mock_db = AsyncMock()

    with pytest.raises(ValueError, match="revoked"):
        with patch.object(auth_service, "get_refresh_token_by_jti", new=AsyncMock(return_value=fake_stored)):
            await auth_service.handle_refresh(mock_db, fake_token)


@pytest.mark.asyncio
async def test_handle_refresh_unknown_jti():
    fake_token = make_test_refresh_token(user_id=1, company_id=2, jti="test-jti-unknown")

    mock_db = AsyncMock()

    with pytest.raises(ValueError, match="revoked or unknown"):
        with patch.object(auth_service, "get_refresh_token_by_jti", new=AsyncMock(return_value=None)):
            await auth_service.handle_refresh(mock_db, fake_token)


def test_create_access_token_contains_expected_payload():
    token = auth_service.create_access_token(user_id=11, company_id=22)
    payload = pyjwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])

    assert payload["user_id"] == 11
    assert payload["company_id"] == 22
    assert payload["type"] == "access"
    assert payload["exp"] > datetime.now(UTC).timestamp()


@pytest.mark.asyncio
async def test_create_refresh_token_persists_matching_record():
    mock_db = MagicMock()
    mock_db.flush = AsyncMock()
    token = await auth_service.create_refresh_token(mock_db, user_id=11, company_id=22)
    payload = pyjwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])

    assert payload["type"] == "refresh"
    assert isinstance(payload["jti"], str)
    assert payload["jti"]
    assert 6.9 < (payload["exp"] - datetime.now(UTC).timestamp()) / 86400 < 7.1
    mock_db.add.assert_called_once()
    stored = mock_db.add.call_args.args[0]
    assert isinstance(stored, RefreshToken)
    assert stored.jti == payload["jti"]
    assert stored.user_id == 11
    mock_db.flush.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_build_authorization_url_contains_query_parameters():
    company = make_company()
    client = MagicMock()
    client.get = AsyncMock(
        return_value=make_response(
            {
                "authorization_endpoint": "https://issuer.example.com/authorize",
            }
        )
    )

    with patch("app.services.auth_service.httpx.AsyncClient") as async_client:
        async_client.return_value.__aenter__ = AsyncMock(return_value=client)
        async_client.return_value.__aexit__ = AsyncMock(return_value=None)
        url = await auth_service.build_authorization_url(
            company, "https://app.example.com/callback", "state-123"
        )

    query = parse_qs(urlparse(url).query)
    assert url.startswith("https://issuer.example.com/authorize")
    assert query["redirect_uri"] == ["https://app.example.com/callback"]
    assert query["state"] == ["state-123"]


@pytest.mark.asyncio
async def test_exchange_code_for_claims_returns_claims():
    company = make_company()
    discovery = make_response(
        {
            "token_endpoint": "https://issuer.example.com/token",
            "jwks_uri": "https://issuer.example.com/jwks",
        }
    )
    token_response = make_response({"id_token": "fake-id-token"})
    jwks_response = make_response({"keys": []})
    client = MagicMock()
    client.get = AsyncMock(side_effect=[discovery, jwks_response])
    client.post = AsyncMock(return_value=token_response)
    decoded_claims = MagicMock()
    decoded_claims.claims = {"sub": "subject-1", "email": "user@example.com", "email_verified": True}

    with (
        patch("app.services.auth_service.httpx.AsyncClient") as async_client,
        patch.object(auth_service.joserfc_jwt, "decode", return_value=decoded_claims),
    ):
        async_client.return_value.__aenter__ = AsyncMock(return_value=client)
        async_client.return_value.__aexit__ = AsyncMock(return_value=None)
        result = await auth_service.exchange_code_for_claims(
            company, "code-123", "https://app.example.com/callback"
        )

    assert isinstance(result, OIDCClaims)
    assert result.sub == "subject-1"
    assert result.email == "user@example.com"
    assert result.email_verified is True
    decoded_claims.validate.assert_called_once_with()


@pytest.mark.asyncio
async def test_exchange_code_for_claims_propagates_token_error():
    company = make_company()
    discovery = make_response(
        {
            "token_endpoint": "https://issuer.example.com/token",
            "jwks_uri": "https://issuer.example.com/jwks",
        }
    )
    token_response = make_response({})
    token_response.raise_for_status.side_effect = RuntimeError("token request failed")
    client = MagicMock()
    client.get = AsyncMock(return_value=discovery)
    client.post = AsyncMock(return_value=token_response)

    with patch("app.services.auth_service.httpx.AsyncClient") as async_client:
        async_client.return_value.__aenter__ = AsyncMock(return_value=client)
        async_client.return_value.__aexit__ = AsyncMock(return_value=None)
        with pytest.raises(RuntimeError, match="token request failed"):
            await auth_service.exchange_code_for_claims(
                company, "code-123", "https://app.example.com/callback"
            )
