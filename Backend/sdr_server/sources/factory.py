from __future__ import annotations

from typing import Optional

from sdr_server.config import settings
from sdr_server.devices import list_rtl_devices
from sdr_server.models import PreferDevice
from sdr_server.sources.base import SpectrumCapture
from sdr_server.sources.mock import MockCapture


def create_capture(
    prefer_device: Optional[PreferDevice] = "auto",
    *,
    force_mock: Optional[bool] = None,
) -> SpectrumCapture:
    mock = settings.force_mock if force_mock is None else force_mock
    prefer = prefer_device or "auto"

    if mock or prefer == "mock":
        return MockCapture()

    if prefer == "hackrf":
        raise RuntimeError("HackRF todavía no está implementado en el backend local")

    devices = list_rtl_devices()
    if prefer == "rtl-sdr" and not devices:
        raise RuntimeError(
            "No hay RTL-SDR. Conecta el dongle o usa Backend local (modo prueba)."
        )

    if devices:
        from sdr_server.sources.rtl import RtlCapture

        return RtlCapture()

    if prefer == "rtl-sdr":
        raise RuntimeError("librtlsdr no está disponible o no hay dongle")

    return MockCapture()


__all__ = ["create_capture"]
