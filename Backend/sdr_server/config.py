from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    host: str = os.environ.get("RF_SDR_HOST", "127.0.0.1")
    port: int = int(os.environ.get("RF_SDR_PORT", "8787"))
    serial: str | None = os.environ.get("RF_SDR_SERIAL") or None
    gain: str = os.environ.get("RF_SDR_GAIN", "28.0")
    force_mock: bool = _env_flag("RF_SDR_MOCK", False)
    sample_rate_hz: float = float(os.environ.get("RF_SDR_SAMPLE_RATE", "2048000"))


settings = Settings()
