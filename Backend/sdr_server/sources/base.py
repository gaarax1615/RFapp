from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import numpy as np


@dataclass
class CaptureConfig:
    start_mhz: float
    end_mhz: float
    bin_count: int
    update_rate_hz: float
    serial: str | None = None
    gain: str = "auto"


@dataclass
class CaptureStatus:
    state: str
    device_name: str | None
    message: str
    serial: str | None = None
    mode: str = "mock"


class SpectrumCapture(ABC):
    @abstractmethod
    def open(self, config: CaptureConfig) -> CaptureStatus:
        """Prepara el hardware o el generador."""

    @abstractmethod
    def configure(self, config: CaptureConfig) -> CaptureStatus:
        """Cambia rango / ganancia sin cerrar si es posible."""

    @abstractmethod
    def next_frame(self) -> tuple[int, np.ndarray]:
        """Devuelve (timestamp_ms, power_db float32). Bloqueante."""

    @abstractmethod
    def close(self) -> None:
        """Libera el dispositivo."""

    @abstractmethod
    def status(self) -> CaptureStatus:
        """Estado actual."""

    def set_listen(
        self,
        center_mhz: float | None,
        span_mhz: float = 0.2,
        demod: str = "nfm",
    ) -> None:
        """Sintoniza audio. None = vuelve al barrido."""

    def is_listening(self) -> bool:
        return False

    def take_audio(self):
        """Chunk de audio int16 o None."""
        return None

    def hop_meta(self) -> dict[str, Any] | None:
        """Datos del hop actual para que la cascada sobreescriba, no se reinicie."""
        return None
