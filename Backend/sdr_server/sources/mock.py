from __future__ import annotations

import math
import time

import numpy as np

from sdr_server.sources.base import CaptureConfig, CaptureStatus, SpectrumCapture

_CARRIERS = (
    (518.5, -41.0, 0.22, "digital", 0.7, 0.2),
    (526.2, -44.0, 0.20, "digital", 0.9, 1.1),
    (542.3, -38.0, 0.18, "narrow", 1.2, 2.4),
    (556.75, -52.0, 0.16, "narrow", 0.5, 0.8),
    (580.1, -36.0, 0.35, "digital", 0.4, 3.0),
    (488.0, -58.0, 5.5, "wide", 0.15, 0.5),
    (512.0, -55.0, 5.8, "wide", 0.12, 1.7),
    (605.0, -62.0, 0.08, "spur", 2.5, 4.2),
    (620.25, -48.0, 0.25, "digital", 0.6, 2.1),
    (650.0, -68.0, 0.05, "spur", 3.0, 0.3),
    (674.0, -57.0, 4.0, "wide", 0.1, 5.5),
)

_NOISE_BANDS = (
    (470.0, 500.0, 4.0),
    (600.0, 650.0, 6.0),
    (680.0, 698.0, 3.0),
)


class MockCapture(SpectrumCapture):
    """Generador local para probar el pipe sin dongle."""

    def __init__(self) -> None:
        self._config = CaptureConfig(614, 638, 2048, 25)
        self._baseline: np.ndarray | None = None
        self._status = CaptureStatus(
            state="disconnected",
            device_name=None,
            message="Fuente de prueba detenida",
            mode="mock",
        )
        self._interference_until = 0.0
        self._interference_center = 0.0

    def open(self, config: CaptureConfig) -> CaptureStatus:
        return self.configure(config)

    def configure(self, config: CaptureConfig) -> CaptureStatus:
        self._config = config
        self._seed_baseline()
        self._status = CaptureStatus(
            state="simulated",
            device_name="Generador de espectro (Python)",
            message="Sin dongle — espectro de prueba por WebSocket",
            mode="mock",
        )
        return self._status

    def next_frame(self) -> tuple[int, np.ndarray]:
        interval = max(0.016, 1.0 / self._config.update_rate_hz)
        time.sleep(interval)
        now_ms = int(time.time() * 1000)
        t = now_ms / 1000.0
        cfg = self._config
        n = cfg.bin_count
        start, end = cfg.start_mhz, cfg.end_mhz
        bw = (end - start) / n
        power = np.empty(n, dtype=np.float32)
        baseline = self._baseline if self._baseline is not None else np.zeros(n)
        noise_floor = -96.0 + math.sin(t * 0.15) * 1.2

        if np.random.random() < 0.012:
            self._interference_until = now_ms + 1800 + np.random.random() * 3200
            self._interference_center = start + np.random.random() * (end - start)

        freqs = start + np.arange(n, dtype=np.float64) * bw
        rayleigh = -10.0 * np.log10(-np.log(np.clip(np.random.random(n), 1e-9, 1.0)))
        power[:] = (
            noise_floor
            + baseline
            + np.minimum(12.0, rayleigh)
            - 5.0
            + (np.random.random(n) - 0.5) * 0.8
        )

        for b0, b1, lift in _NOISE_BANDS:
            mask = (freqs >= b0) & (freqs <= b1)
            if not np.any(mask):
                continue
            edge = np.minimum((freqs - b0) / 1.5, (b1 - freqs) / 1.5)
            power[mask] += lift * np.clip(edge[mask], 0, 1) + (np.random.random(int(mask.sum())) - 0.5)

        for freq, peak, half_bw, shape, fade_hz, phase in _CARRIERS:
            fade = math.sin(t * fade_hz + phase) * 1.8 + math.sin(t * fade_hz * 2.7 + phase) * 0.6
            peak_now = peak + fade
            contrib = _shape_contribution(freqs, freq, half_bw, shape, peak_now)
            power = np.maximum(power, contrib)

        if now_ms < self._interference_until:
            dx = np.abs(freqs - self._interference_center)
            burst_mask = dx < 1.2
            if np.any(burst_mask):
                burst = (
                    -26.0
                    - (dx[burst_mask] / 1.2) * 35.0
                    + np.sin(t * 40.0 + freqs[burst_mask]) * 3.0
                    + (np.random.random(int(burst_mask.sum())) - 0.5) * 4.0
                )
                power[burst_mask] = np.maximum(power[burst_mask], burst)

        return now_ms, power

    def close(self) -> None:
        self._status = CaptureStatus(
            state="disconnected",
            device_name=None,
            message="Fuente de prueba detenida",
            mode="mock",
        )

    def status(self) -> CaptureStatus:
        return self._status

    def _seed_baseline(self) -> None:
        n = self._config.bin_count
        start, end = self._config.start_mhz, self._config.end_mhz
        walk = 0.0
        baseline = np.empty(n, dtype=np.float32)
        for i in range(n):
            walk += (np.random.random() - 0.5) * 0.35
            walk *= 0.98
            freq = start + (i / n) * (end - start)
            if freq < start + 8:
                roll = ((freq - start) / 8) * 8 - 8
            elif freq > end - 8:
                roll = ((end - freq) / 8) * 8 - 8
            else:
                roll = 0.0
            baseline[i] = walk + roll
        self._baseline = baseline


def _shape_contribution(
    freqs: np.ndarray,
    center: float,
    half_bw: float,
    shape: str,
    peak_db: float,
) -> np.ndarray:
    dx = freqs - center
    half = half_bw / 2.0
    out = np.full(freqs.shape, -160.0, dtype=np.float32)

    if shape == "digital":
        flat = half * 0.55
        abs_dx = np.abs(dx)
        core = abs_dx <= flat
        out[core] = peak_db + (np.random.random(int(core.sum())) - 0.5) * 1.2
        skirt = (abs_dx - flat) / (half * 1.8)
        skirt_mask = (~core) & (skirt <= 4)
        out[skirt_mask] = peak_db - 6.0 - (skirt[skirt_mask] ** 2) * 18.0
        return out

    if shape == "wide":
        abs_dx = np.abs(dx)
        core = abs_dx <= half
        ripple = np.sin(dx[core] * 8.0) * 1.5
        out[core] = peak_db - 2.0 + ripple + (np.random.random(int(core.sum())) - 0.5) * 2.0
        skirt = (abs_dx - half) / 0.8
        skirt_mask = (~core) & (skirt <= 5)
        out[skirt_mask] = peak_db - 8.0 - skirt[skirt_mask] * 12.0
        return out

    if shape == "spur":
        sigma = max(0.02, half)
        g = np.exp(-0.5 * (dx / sigma) ** 2)
        mask = g >= 0.001
        out[mask] = peak_db + 10.0 * np.log10(g[mask])
        return out

    sigma = max(0.04, half * 0.7)
    g = 1.0 / (1.0 + (dx / sigma) ** 2)
    mask = g >= 0.002
    out[mask] = peak_db + 10.0 * np.log10(g[mask]) + 3.0
    return out
