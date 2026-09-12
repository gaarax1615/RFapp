from __future__ import annotations

import numpy as np


def iq_from_u8(raw: np.ndarray) -> np.ndarray:
    samples = (raw.astype(np.float32) - 127.5) / 127.5
    return samples[0::2] + 1j * samples[1::2]


def iq_buffer_alive(raw_u8: np.ndarray) -> bool:
    """USB/PLL colgado suele devolver un buffer casi constante (todo ~127)."""
    if raw_u8.size < 64:
        return False
    return float(np.std(raw_u8.astype(np.float32))) >= 1.5


def power_db(iq: np.ndarray, window: np.ndarray) -> np.ndarray:
    """PSD en dBFS, normalizada (ruido de un RTL ~ -70 a -90)."""
    n = int(window.size)
    x = np.asarray(iq[:n], dtype=np.complex64)
    x = x - np.mean(x)
    spec = np.fft.fftshift(np.fft.fft(x * window, n=n))
    scale = float(n) * float(np.sum(np.square(window)))
    psd = (np.abs(spec) ** 2) / max(scale, 1e-20)
    return (10.0 * np.log10(psd + 1e-20)).astype(np.float32)


def hop_axis(
    center_hz: float,
    sample_rate_hz: float,
    n_fft: int,
    edge_fraction: float = 0.12,
) -> tuple[np.ndarray, slice]:
    """Frecuencias de cada bin FFT y slice sin bordes ni DC."""
    freqs = center_hz + np.fft.fftshift(np.fft.fftfreq(n_fft, 1.0 / sample_rate_hz))
    edge = max(1, int(n_fft * edge_fraction))
    dc = n_fft // 2
    keep = np.ones(n_fft, dtype=bool)
    keep[:edge] = False
    keep[-edge:] = False
    keep[dc - 2 : dc + 3] = False
    return freqs, keep


def _lowpass(taps: int, cutoff_frac: float) -> np.ndarray:
    n = np.arange(taps, dtype=np.float64)
    mid = (taps - 1) / 2.0
    h = np.sinc(2.0 * cutoff_frac * (n - mid))
    h *= np.hamming(taps)
    s = float(np.sum(h))
    return (h / s) if s else h


def decimate(x: np.ndarray, factor: int, taps: int = 47) -> np.ndarray:
    """FIR (calidad). Para audio en vivo usa decimate_fast."""
    if factor <= 1:
        return x
    h = _lowpass(taps, 0.45 / factor)
    y = np.convolve(x, h, mode="same")
    return y[::factor]


def decimate_fast(x: np.ndarray, factor: int) -> np.ndarray:
    """Media por bloques: suficientemente bueno para FM y cabe en tiempo real."""
    if factor <= 1:
        return x
    n = (x.size // factor) * factor
    if n <= 0:
        return x[:0]
    return x[:n].reshape(-1, factor).mean(axis=1)


def fm_demod(iq: np.ndarray) -> np.ndarray:
    """Discriminador FM (el mismo 'ruido' que GQRX/SDR# en NFM)."""
    if iq.size < 2:
        return np.zeros(0, dtype=np.float32)
    d = iq[1:] * np.conj(iq[:-1])
    return np.angle(d).astype(np.float32)


def nfm_audio(iq: np.ndarray, sample_rate_hz: float, audio_hz: int = 16000) -> np.ndarray:
    """NFM a 16 kHz, sin squelch — se oye el hiss real del SDR."""
    if iq.size < 64:
        return np.zeros(0, dtype=np.float32)
    stage = max(1, int(round(sample_rate_hz / 256_000.0)))
    x = decimate_fast(iq, stage)
    audio = fm_demod(x)
    fs = sample_rate_hz / stage
    stage2 = max(1, int(round(fs / float(audio_hz))))
    audio = decimate_fast(audio, stage2)
    audio = audio - float(np.mean(audio))
    return np.clip(audio * 0.55, -1.0, 1.0).astype(np.float32)


def wfm_audio(iq: np.ndarray, sample_rate_hz: float, audio_hz: int = 16000) -> np.ndarray:
    """FM comercial (~200 kHz) a 16 kHz (ligero, continuo)."""
    if iq.size < 64:
        return np.zeros(0, dtype=np.float32)
    stage = max(1, int(round(sample_rate_hz / 200_000.0)))
    x = decimate_fast(iq, stage)
    audio = fm_demod(x)
    fs = sample_rate_hz / stage
    stage2 = max(1, int(round(fs / float(audio_hz))))
    audio = decimate_fast(audio, stage2)
    audio = audio - float(np.mean(audio))
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    gain = 0.35 / peak if peak > 1e-4 else 0.35
    return np.clip(audio * gain, -1.0, 1.0).astype(np.float32)


def am_audio(iq: np.ndarray, sample_rate_hz: float, audio_hz: int = 16000) -> np.ndarray:
    """AM por envolvente, a 16 kHz."""
    if iq.size < 64:
        return np.zeros(0, dtype=np.float32)
    mag = np.abs(iq).astype(np.float32)
    mag = mag - float(np.mean(mag))
    stage = max(1, int(round(sample_rate_hz / float(audio_hz))))
    audio = decimate_fast(mag, stage)
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    gain = 0.45 / peak if peak > 1e-4 else 0.45
    return np.clip(audio * gain, -1.0, 1.0).astype(np.float32)


def use_wfm(center_mhz: float, span_mhz: float) -> bool:
    """FM broadcast o una zona ancha: WFM. Petacas: NFM."""
    if 76.0 <= center_mhz <= 108.5:
        return True
    return span_mhz >= 0.5
