from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    redis_url: str = "redis://localhost:6379/0"
    auth_service_url: str = "http://localhost:8000"
    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60
    public_paths: list[str] = ["/auth/login-init", "/auth/callback", "/auth/refresh"]
    trusted_proxies: list[str] = []


settings = Settings()
