from unittest.mock import patch

from starlette.datastructures import Address, Headers

from app.security import get_client_ip


class FakeRequest:
    def __init__(self, peer: str | None, headers: dict[str, str] | None = None) -> None:
        self.client = Address(peer, 0) if peer else None
        self.headers = Headers(headers or {})


def trusted(*networks: str):
    return patch("app.security.settings.trusted_proxies", list(networks))


def test_untrusted_peer_ignores_forwarded_header() -> None:
    request = FakeRequest("203.0.113.9", {"X-Forwarded-For": "1.2.3.4"})
    with trusted("10.0.0.0/8"):
        assert get_client_ip(request) == "203.0.113.9"


def test_trusted_proxy_uses_rightmost_untrusted_hop() -> None:
    request = FakeRequest("10.1.2.3", {"X-Forwarded-For": "1.2.3.4, 203.0.113.7, 10.1.2.3"})
    with trusted("10.0.0.0/8"):
        assert get_client_ip(request) == "203.0.113.7"


def test_spoofed_prefix_cannot_override_real_client() -> None:
    request = FakeRequest("10.1.2.3", {"X-Forwarded-For": "9.9.9.9, 198.51.100.4"})
    with trusted("10.0.0.0/8"):
        assert get_client_ip(request) == "198.51.100.4"


def test_trusted_proxy_without_forwarded_header_falls_back_to_peer() -> None:
    with trusted("10.0.0.0/8"):
        assert get_client_ip(FakeRequest("10.1.2.3")) == "10.1.2.3"


def test_no_trusted_proxies_configured_uses_peer() -> None:
    request = FakeRequest("10.1.2.3", {"X-Forwarded-For": "1.2.3.4"})
    with trusted():
        assert get_client_ip(request) == "10.1.2.3"


def test_missing_client_returns_unknown() -> None:
    assert get_client_ip(FakeRequest(None)) == "unknown"
