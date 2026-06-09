import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel


ROOT_DIR = Path(__file__).resolve().parents[3]
ENV_PATH = ROOT_DIR / ".env"
RUNS_DIR = ROOT_DIR / "runs"
EXPORTS_DIR = ROOT_DIR / "exports"
EVENTS_DIR = ROOT_DIR / "events"


def _path_from_env(name: str, default: Path) -> Path:
    value = os.getenv(name)
    if not value:
        return default

    return Path(value).expanduser()


def load_env_file() -> None:
    if not ENV_PATH.exists():
        return

    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), _normalize_env_value(value.strip()))


def _normalize_env_value(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]

    return value


class Settings(BaseModel):
    openai_api_key: str | None
    openai_model: str
    langfuse_public_key: str | None
    langfuse_secret_key: str | None
    langfuse_host: str
    next_public_api_base_url: str
    runs_dir: Path
    exports_dir: Path
    events_dir: Path

    @property
    def openai_enabled(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def langfuse_enabled(self) -> bool:
        return bool(self.langfuse_public_key and self.langfuse_secret_key)


@lru_cache
def get_settings() -> Settings:
    load_env_file()

    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-5.4"),
        langfuse_public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
        langfuse_secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
        langfuse_host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
        next_public_api_base_url=os.getenv(
            "NEXT_PUBLIC_API_BASE_URL",
            "http://localhost:8000",
        ),
        runs_dir=_path_from_env("A2A_RUNS_DIR", RUNS_DIR),
        exports_dir=_path_from_env("A2A_EXPORTS_DIR", EXPORTS_DIR),
        events_dir=_path_from_env("A2A_EVENTS_DIR", EVENTS_DIR),
    )
