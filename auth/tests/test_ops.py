from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class _FailingEngine:
    def connect(self):
        raise ConnectionError("database unreachable")


def test_health_is_always_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_returns_503_when_database_is_down() -> None:
    with patch("app.main.engine", _FailingEngine()):
        response = client.get("/ready")
    assert response.status_code == 503
    assert response.json()["database"] == "down"
