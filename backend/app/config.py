from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent


class Settings(BaseSettings):
    # backend/.env is found no matter which directory the server is started from; real env vars win.
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    # Vertex AI / Gemini (required)
    google_application_credentials: str | None = None
    gcp_project: str = "ticm-qa"
    gcp_location: str = "global"
    gemini_model: str = "gemini-2.5-flash"
    llm_max_retries: int = 3
    # Parallel Gemini calls per instance, and per deck while generating slides
    max_concurrent_llm: int = 16
    slide_concurrency: int = 6

    # Optional services (each degrades gracefully when unavailable)
    unsplash_access_key: str | None = None
    pexels_api_key: str | None = None
    # Imagen model + region. Set IMAGE_MODEL=gemini-2.5-flash-image to use Gemini image generation instead.
    image_model: str = "imagen-4.0-fast-generate-001"
    image_location: str = "us-central1"
    enable_image_generation: bool = True
    enable_grounding: bool = True

    # Storage (SQLite + cached/uploaded images)
    data_dir: Path = BACKEND_DIR / "data"
    max_prompt_chars: int = 8000
    max_versions_per_deck: int = 50

    # Frontend integration
    # Where headless Chromium opens /print/{id} for PDF export (the deployed frontend).
    frontend_url: str = "http://localhost:5173"
    # Comma-separated browser origins allowed to call the API directly (not needed behind a reverse proxy).
    cors_origins: str = "http://localhost:5173"
    # Optional: serve a built frontend (frontend/dist) from this API for single-process setups. Empty = API only.
    frontend_dist_dir: Path | None = None

    @property
    def db_path(self) -> Path:
        return self.data_dir / "aira.db"

    @property
    def media_dir(self) -> Path:
        return self.data_dir / "media"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
