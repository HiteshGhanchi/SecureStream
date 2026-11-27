from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_is_always_ok() -> None:
    assert client.get("/health").json() == {"status": "ok"}


def test_ready_ok_when_redis_answers() -> None:
    with patch("app.main.redis.ping", new=AsyncMock(return_value=True)):
        response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["redis"] == "up"


def test_ready_returns_503_when_redis_is_down() -> None:
    with patch("app.main.redis.ping", new=AsyncMock(side_effect=ConnectionError("down"))):
        response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["redis"] == "down"
