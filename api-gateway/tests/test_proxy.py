from app.proxy import forwarded_headers
from app.security import GatewayIdentity


def test_forwarded_headers_replace_client_identity_headers() -> None:
    headers = forwarded_headers(
        {
            "authorization": "Bearer ignored-upstream",
            "X-User-Id": "attacker",
            "X-Company-Id": "attacker-company",
            "Accept": "application/json",
        },
        GatewayIdentity(user_id=7, company_id=9),
    )

    assert "authorization" not in {key.lower() for key in headers}
    assert headers["X-User-Id"] == "7"
    assert headers["X-Company-Id"] == "9"
    assert headers["Accept"] == "application/json"
