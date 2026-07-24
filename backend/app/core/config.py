"""
Application configuration.

Centralizes all environment-driven settings in one place so the rest of the
codebase never reads os.environ directly. This keeps configuration testable
and makes it obvious what the app depends on from its environment.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # General
    APP_NAME: str = "ExcelAI"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # API
    API_V1_PREFIX: str = "/api/v1"

    # CORS - comma-separated origins in the environment, e.g.
    # CORS_ORIGINS=http://localhost:3000,https://app.example.com
    CORS_ORIGINS: str = "http://localhost:3000"

    # Storage
    # Where uploaded/processed workbooks live on disk for this milestone.
    # This is a local-disk placeholder; it will be replaced by cloud
    # storage in a later milestone without changing calling code, since
    # only this setting (and the storage service that reads it) will change.
    STORAGE_DIR: Path = Path(__file__).resolve().parents[3] / "storage"

    # Upload
    MAX_UPLOAD_SIZE_MB: int = 25
    ALLOWED_UPLOAD_EXTENSIONS: tuple[str, ...] = (".xlsx",)

    # AI (Phase 3) -- provider-agnostic by design, see app/ai/provider.py.
    # Switching providers is meant to be a pure env-var change, never a
    # business-logic edit.
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-latest"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor so we parse the environment only once."""
    return Settings()
