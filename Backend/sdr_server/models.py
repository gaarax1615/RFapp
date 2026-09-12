from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from sdr_server.hops import clamp_sweep_range

PreferDevice = Literal["auto", "rtl-sdr", "hackrf", "mock"]


class SpectrumConfigIn(BaseModel):
    start_frequency_mhz: float = Field(alias="startFrequencyMhz", default=614)
    end_frequency_mhz: float = Field(alias="endFrequencyMhz", default=638)
    bin_count: int = Field(alias="binCount", default=2048, ge=64, le=16384)
    update_rate_hz: float = Field(alias="updateRateHz", default=25, gt=0, le=60)
    prefer_device: Optional[PreferDevice] = Field(alias="preferDevice", default="auto")
    serial: Optional[str] = None
    gain: Optional[str] = None

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _cap_sweep_span(self) -> SpectrumConfigIn:
        start, end = clamp_sweep_range(
            self.start_frequency_mhz,
            self.end_frequency_mhz,
        )
        self.start_frequency_mhz = start
        self.end_frequency_mhz = end
        return self


class ClientMessage(BaseModel):
    type: Literal["start", "stop", "config", "listen", "listenStop"]
    start_frequency_mhz: Optional[float] = Field(alias="startFrequencyMhz", default=None)
    end_frequency_mhz: Optional[float] = Field(alias="endFrequencyMhz", default=None)
    bin_count: Optional[int] = Field(alias="binCount", default=None)
    update_rate_hz: Optional[float] = Field(alias="updateRateHz", default=None)
    prefer_device: Optional[PreferDevice] = Field(alias="preferDevice", default=None)
    serial: Optional[str] = None
    gain: Optional[str] = None
    demod: Optional[Literal["nfm", "wfm", "am", "auto"]] = None

    model_config = {"populate_by_name": True}


class DeviceInfo(BaseModel):
    index: int
    driver: str
    vendor: Optional[str] = None
    product: Optional[str] = None
    serial: Optional[str] = None
    name: str


def frame_payload(
    *,
    timestamp_ms: int,
    start_mhz: float,
    end_mhz: float,
    power_db: list[float],
    hop_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    bins = max(1, len(power_db))
    payload: dict[str, Any] = {
        "type": "frame",
        "timestamp": timestamp_ms,
        "startFrequencyMhz": start_mhz,
        "endFrequencyMhz": end_mhz,
        "binWidthMhz": (end_mhz - start_mhz) / bins,
        "powerDb": power_db,
    }
    if hop_meta:
        payload.update(hop_meta)
    return payload


def audio_payload(*, sample_rate: int, pcm_b64: str) -> dict[str, Any]:
    return {
        "type": "audio",
        "sampleRate": sample_rate,
        "pcm": pcm_b64,
    }


def status_payload(
    *,
    state: str,
    device_name: Optional[str],
    message: Optional[str] = None,
    serial: Optional[str] = None,
    mode: Optional[str] = None,
) -> dict[str, Any]:
    return {
        "type": "status",
        "state": state,
        "deviceName": device_name,
        "message": message,
        "serial": serial,
        "mode": mode,
    }
