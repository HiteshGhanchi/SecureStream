from redis.asyncio import Redis

SLIDING_WINDOW_SCRIPT = """
local now = tonumber(ARGV[1])
local window_start = now - tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local request_id = ARGV[4]

redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, window_start)
local current = redis.call('ZCARD', KEYS[1])
if current >= limit then
    return {0, current}
end

redis.call('ZADD', KEYS[1], now, request_id)
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return {1, current + 1}
"""


class SlidingWindowRateLimiter:
    def __init__(self, redis: Redis, requests: int, window_seconds: int) -> None:
        self.redis = redis
        self.requests = requests
        self.window_seconds = window_seconds
        self._script = redis.register_script(SLIDING_WINDOW_SCRIPT)

    async def allow(self, key: str, now: float, request_id: str) -> bool:
        result = await self._script(
            keys=[key],
            args=[now, self.window_seconds, self.requests, request_id],
        )
        return bool(result[0])
