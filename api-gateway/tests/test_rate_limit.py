from unittest.mock import AsyncMock, MagicMock

import pytest

from app.rate_limit import SlidingWindowRateLimiter


@pytest.mark.asyncio
async def test_sliding_window_returns_redis_decision() -> None:
    redis = MagicMock()
    script = AsyncMock(return_value=[1, 1])
    redis.register_script.return_value = script
    limiter = SlidingWindowRateLimiter(redis, requests=2, window_seconds=60)

    assert await limiter.allow("rate-key", 1000.0, "request-1") is True
    script.assert_awaited_once()


@pytest.mark.asyncio
async def test_sliding_window_rejects_redis_decision() -> None:
    redis = MagicMock()
    redis.register_script.return_value = AsyncMock(return_value=[0, 2])
    limiter = SlidingWindowRateLimiter(redis, requests=2, window_seconds=60)

    assert await limiter.allow("rate-key", 1000.0, "request-3") is False
