from collections.abc import Mapping

import httpx
from fastapi import Request
from starlette.responses import Response

from app.core.config import settings
from app.security import GatewayIdentity

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}


def forwarded_headers(headers: Mapping[str, str], identity: GatewayIdentity | None) -> dict[str, str]:
    result = {
        key: value
        for key, value in headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
        and key.lower() not in {"host", "authorization", "x-user-id", "x-company-id"}
    }
    if identity is not None:
        result["X-User-Id"] = str(identity.user_id)
        result["X-Company-Id"] = str(identity.company_id)
    return result


async def forward_request(request: Request, identity: GatewayIdentity | None, path: str) -> Response:
    target_url = f"{settings.auth_service_url.rstrip('/')}/{path}"
    query_string = request.url.query
    if query_string:
        target_url = f"{target_url}?{query_string}"

    async with httpx.AsyncClient() as client:
        upstream = await client.request(
            request.method,
            target_url,
            content=await request.body(),
            headers=forwarded_headers(request.headers, identity),
        )

    response_headers = {
        key: value for key, value in upstream.headers.items() if key.lower() not in HOP_BY_HOP_HEADERS
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
