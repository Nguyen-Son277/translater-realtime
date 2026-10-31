from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

LANGUAGES = {
    "vi": "Tiếng Việt",
    "en": "English",
    "ja": "日本語",
    "ko": "한국어",
    "zh": "中文",
    "fr": "Français",
    "de": "Deutsch",
    "es": "Español",
}

LANGUAGE_NAMES = {
    "vi": "Vietnamese", "en": "English", "ja": "Japanese", "ko": "Korean",
    "zh": "Simplified Chinese", "fr": "French", "de": "German", "es": "Spanish",
}


WS_PING_INTERVAL = 10.0
WS_PONG_DEADLINE = 30.0


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/app.db"
    cookie_secure: bool = False
    session_days: int = Field(default=7, ge=1, le=30)
    allowed_origins: str = ""
    auth_rate_limit: int = Field(default=60, ge=1)
    ws_ping_interval: float = Field(default=10.0, ge=0.01, le=60.0)
    ws_pong_deadline: float = Field(default=30.0, ge=0.01, le=120.0)
    translation_base_url: str = ""
    translation_model: str = ""
    translation_api_key: str = ""
    translation_timeout: float = Field(default=45, ge=1, le=300)
    translation_concurrency: int = Field(default=2, ge=1, le=8)
    translation_queue_size: int = Field(default=32, ge=1, le=128)
    speech_enabled: bool = True
    speech_backend: Literal["nemotron", "whisper"] = "nemotron"
    speech_model: str = "nvidia/nemotron-3.5-asr-streaming-0.6b"
    speech_device: str = "cpu"
    speech_cpu_threads: int = Field(default=4, ge=1, le=64)
    speech_download_root: str = "./models"
    whisper_model: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_cpu_threads: int = Field(default=4, ge=1, le=64)
    whisper_download_root: str = "./models"
    speech_silence_ms: int = Field(default=400, ge=200, le=2000, multiple_of=20)
    speech_max_segment_ms: int = Field(default=4000, ge=1000, le=10000, multiple_of=20)
    speech_preview_ms: int = Field(default=1000, ge=400, le=5000, multiple_of=20)
    language_confidence: float = Field(default=0.60, ge=0, le=1)
    audio_queue_size: int = Field(default=4, ge=1, le=16)

    @property
    def trusted_origins(self) -> set[str]:
        return {origin.strip().rstrip("/") for origin in self.allowed_origins.split(",") if origin.strip()}

    def prepare_directories(self) -> None:
        if self.database_url.startswith("sqlite:///") and ":memory:" not in self.database_url:
            Path(self.database_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
        if self.speech_enabled:
            root = (self.speech_download_root if self.speech_backend == "nemotron"
                    else self.whisper_download_root)
            Path(root).mkdir(parents=True, exist_ok=True)
