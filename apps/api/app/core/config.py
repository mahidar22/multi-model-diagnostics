from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    app_name: str = "Research Decision Support Prototype"
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    data_dir: Path = Path(".local-data")
    max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1_024, le=100 * 1024 * 1024)
    max_artifacts_per_case: int = Field(default=5, ge=1, le=50)
    retention_days: int = Field(default=30, ge=1, le=3_650)
    users_json: str = '{"demo-researcher":"local-research-demo-token"}'
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    rag_enabled: bool = False
    rag_corpus_dir: Path = Path("rag/corpus/approved")
    model_manifest_file: str = "ml/manifests/synthetic-tabular-demo-v1.json"

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def private_data_root(self) -> Path:
        path = self.data_dir
        return path if path.is_absolute() else PROJECT_ROOT / path

    @property
    def manifest_path(self) -> Path:
        path = Path(self.model_manifest_file)
        return path if path.is_absolute() else PROJECT_ROOT / path

    @property
    def rag_root(self) -> Path:
        path = self.rag_corpus_dir
        return path if path.is_absolute() else PROJECT_ROOT / path

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def user_tokens(self) -> dict[str, str]:
        import json

        try:
            parsed = json.loads(self.users_json)
        except (TypeError, json.JSONDecodeError) as exc:
            raise RuntimeError("RESEARCH_USERS_JSON must be a JSON object of actor IDs to tokens.") from exc
        if not isinstance(parsed, dict) or not parsed:
            raise RuntimeError("RESEARCH_USERS_JSON must contain at least one actor and token.")
        if any(not isinstance(actor, str) or not isinstance(token, str) or not actor or not token for actor, token in parsed.items()):
            raise RuntimeError("RESEARCH_USERS_JSON entries must be non-empty strings.")
        return parsed


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
