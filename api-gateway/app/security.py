from dataclasses import dataclass
from ipaddress import ip_address, ip_network

import jwt
from fastapi import HTTPException, Request, status

from app.core.config import settings


@dataclass(frozen=True)
class GatewayIdentity:
    user_id: int
    company_id: int


def verify_access_token(token: str) -> GatewayIdentity:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc

    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong token type")

    try:
        return GatewayIdentity(
            user_id=int(payload["user_id"]),
            company_id=int(payload["company_id"]),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access claims") from exc


def is_public_path(path: str) -> bool:
    normalized = "/" + path.strip("/")
    return any(normalized == public.rstrip("/") for public in settings.public_paths)


def get_identity(request: Request) -> GatewayIdentity:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    return verify_access_token(token)


def _is_trusted_proxy(host: str) -> bool:
    try:
        candidate = ip_address(host)
    except ValueError:
        return False
    for trusted in settings.trusted_proxies:
        try:
            if candidate in ip_network(trusted, strict=False):
                return True
        except ValueError:
            continue
    return False


def get_client_ip(request: Request) -> str:
    peer = request.client.host if request.client else None
    if peer is None:
        return "unknown"
    if not _is_trusted_proxy(peer):
        return peer

    forwarded = request.headers.get("x-forwarded-for", "")
    # Walk right-to-left so a client-supplied prefix cannot spoof the originating IP.
    for hop in reversed([entry.strip() for entry in forwarded.split(",") if entry.strip()]):
        if not _is_trusted_proxy(hop):
            try:
                ip_address(hop)
            except ValueError:
                return "unknown"
            return hop
    return peer
