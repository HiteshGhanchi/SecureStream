from app.proxy import forwarded_headers
from app.security import is_public_path


def test_configured_login_endpoints_are_public() -> None:
    assert is_public_path("auth/login-init") is True
    assert is_public_path("/auth/callback") is True
    assert is_public_path("auth/refresh") is True


def test_other_endpoints_are_not_public() -> None:
    assert is_public_path("media/videos") is False
    assert is_public_path("auth/login-init/extra") is False


def test_anonymous_requests_never_carry_identity_headers() -> None:
    headers = forwarded_headers(
        {"X-User-Id": "attacker", "X-Company-Id": "attacker-company", "Cookie": "refresh_token=abc"},
        None,
    )

    assert "X-User-Id" not in headers
    assert "X-Company-Id" not in headers
    assert headers["Cookie"] == "refresh_token=abc"
