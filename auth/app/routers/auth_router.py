import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.config import settings
from app.schemas.auth_schemas import LoginInitRequest, LoginInitResponse
from app.services.auth_service import build_authorization_url, exchange_code_for_claims, create_access_token, create_refresh_token, handle_refresh
from app.repositories.repository import get_company_by_domain, get_company_by_id, get_or_create_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login-init", response_model=LoginInitResponse)
async def login_init(
    request: LoginInitRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    domain = request.email.split("@")[1]
    company = await get_company_by_domain(db, domain)
    if company is None:
        raise HTTPException(status_code=404, detail=f"No company registered for domain: {domain}")

    random_part = secrets.token_urlsafe(32)
    state = f"{random_part}:{company.id}"
    redirect_uri = f"{settings.oidc_redirect_base_url}/auth/callback"

    redirect_url = await build_authorization_url(company, redirect_uri, state)

    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        max_age=600,
        samesite="lax",
    )

    return LoginInitResponse(redirect_url=redirect_url)

@router.get("/callback")
async def callback(
    code: str,
    state: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    cookie_state = request.cookies.get("oauth_state")
    if cookie_state is None or cookie_state != state:
        raise HTTPException(status_code=400, detail="State mismatch or missing")

    try:
        _, company_id_str = state.split(":")
        company_id = int(company_id_str)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Malformed state")

    company = await get_company_by_id(db, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")

    redirect_uri = f"{settings.oidc_redirect_base_url}/auth/callback"
    claims = await exchange_code_for_claims(company, code, redirect_uri)

    user = await get_or_create_user(db, company.id, claims.email)
    await db.commit()

    access_token = create_access_token(user.id, company.id)
    refresh_token = await create_refresh_token(db, user.id, company.id)
    await db.commit()

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=7 * 24 * 60 * 60,
        samesite="lax",
    )

    return {"access_token": access_token, "user_id": user.id, "email": user.email}

@router.post("/refresh")
async def refresh(request: Request, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token is None:
        raise HTTPException(status_code=401, detail="No refresh token")

    try:
        new_access_token = await handle_refresh(db, refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    return {"access_token": new_access_token}