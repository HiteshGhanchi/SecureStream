import pytest
from datetime import datetime, timedelta, timezone
from app.models.db_models import Company, User, RefreshToken
from app.repositories.repository import (
    get_company_by_domain,
    get_company_by_id,
    get_or_create_user,
    create_refresh_token_record,
    get_refresh_token_by_jti,
)

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_get_company_by_domain_returns_existing_company(db):
    """Test that we can insert and retrieve a company by domain."""
    company = Company(
        domain="example.com",
        oidc_issuer_url="https://issuer.example.com",
        oidc_client_id="client-123",
        oidc_client_secret="secret-456",
    )
    db.add(company)
    await db.flush()

    result = await get_company_by_domain(db, "example.com")

    assert result is not None
    assert result.id == company.id
    assert result.domain == "example.com"
    assert result.oidc_issuer_url == "https://issuer.example.com"
    assert result.oidc_client_id == "client-123"
    assert result.oidc_client_secret == "secret-456"


@pytest.mark.asyncio
async def test_get_company_by_domain_returns_none_for_unknown_domain(db):
    """Test that unknown domain returns None."""
    result = await get_company_by_domain(db, "nonexistent.com")
    assert result is None


@pytest.mark.asyncio
async def test_get_company_by_id_returns_existing_company(db):
    """Test that we can insert and retrieve a company by ID."""
    company = Company(
        domain="test.com",
        oidc_issuer_url="https://issuer.test.com",
        oidc_client_id="test-client",
        oidc_client_secret="test-secret",
    )
    db.add(company)
    await db.flush()

    result = await get_company_by_id(db, company.id)

    assert result is not None
    assert result.id == company.id
    assert result.domain == "test.com"


@pytest.mark.asyncio
async def test_get_company_by_id_returns_none_for_unknown_id(db):
    """Test that unknown company ID returns None."""
    result = await get_company_by_id(db, 9999)
    assert result is None


@pytest.mark.asyncio
async def test_get_or_create_user_creates_new_user(db):
    """Test that get_or_create_user creates a user on first call."""
    company = Company(
        domain="create.com",
        oidc_issuer_url="https://issuer.create.com",
        oidc_client_id="create-client",
        oidc_client_secret="create-secret",
    )
    db.add(company)
    await db.flush()

    user = await get_or_create_user(db, company.id, "newuser@create.com")

    assert user is not None
    assert user.id is not None
    assert user.company_id == company.id
    assert user.email == "newuser@create.com"


@pytest.mark.asyncio
async def test_get_or_create_user_returns_existing_user(db):
    """
    Test that get_or_create_user returns the same user when called twice
    with the same (company_id, email) — proves the composite unique constraint
    and find-or-create logic against real Postgres.
    """
    company = Company(
        domain="duplicate.com",
        oidc_issuer_url="https://issuer.duplicate.com",
        oidc_client_id="dup-client",
        oidc_client_secret="dup-secret",
    )
    db.add(company)
    await db.flush()

    # First call creates the user
    user1 = await get_or_create_user(db, company.id, "existing@duplicate.com")
    await db.flush()

    # Second call should return the same user
    user2 = await get_or_create_user(db, company.id, "existing@duplicate.com")
    await db.flush()

    assert user1.id == user2.id
    assert user1.email == user2.email
    assert user1.company_id == user2.company_id


@pytest.mark.asyncio
async def test_create_refresh_token_record_and_get_by_jti(db):
    """Test that we can insert and retrieve a refresh token record by jti."""
    company = Company(
        domain="token.com",
        oidc_issuer_url="https://issuer.token.com",
        oidc_client_id="token-client",
        oidc_client_secret="token-secret",
    )
    db.add(company)
    await db.flush()

    user = await get_or_create_user(db, company.id, "tokenuser@token.com")
    await db.flush()

    jti = "test-jti-12345"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    record = await create_refresh_token_record(db, jti, user.id, expires_at)
    await db.flush()

    result = await get_refresh_token_by_jti(db, jti)

    assert result is not None
    assert result.id == record.id
    assert result.jti == jti
    assert result.user_id == user.id
    assert result.revoked is False
    assert result.expires_at == expires_at


@pytest.mark.asyncio
async def test_get_refresh_token_by_jti_returns_none_for_unknown_jti(db):
    """Test that unknown jti returns None."""
    result = await get_refresh_token_by_jti(db, "unknown-jti-xyz")
    assert result is None


@pytest.mark.asyncio
async def test_revoked_refresh_token_is_readable(db):
    """
    Test that a revoked refresh token record can be read and its revoked
    status is correctly set to True.
    """
    company = Company(
        domain="revoked.com",
        oidc_issuer_url="https://issuer.revoked.com",
        oidc_client_id="revoked-client",
        oidc_client_secret="revoked-secret",
    )
    db.add(company)
    await db.flush()

    user = await get_or_create_user(db, company.id, "revokeduser@revoked.com")
    await db.flush()

    jti = "revoked-jti-999"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    # Create a refresh token record
    record = await create_refresh_token_record(db, jti, user.id, expires_at)
    await db.flush()

    # Manually set revoked to True (simulating revocation)
    record.revoked = True
    await db.flush()

    # Retrieve and verify revoked status
    result = await get_refresh_token_by_jti(db, jti)

    assert result is not None
    assert result.jti == jti
    assert result.revoked is True
