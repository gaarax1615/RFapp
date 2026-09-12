from __future__ import annotations

import base64
import ctypes
import logging
import threading
import time
from collections import deque

import numpy as np

from sdr_server.config import settings
from sdr_server.devices import list_rtl_devices, load_librtlsdr
from sdr_server.dsp import (
    am_audio,
    hop_axis,
    iq_buffer_alive,
    iq_from_u8,
    nfm_audio,
    power_db,
    use_wfm,
    wfm_audio,
)
from sdr_server.hops import clamp_sweep_range, hop_centers_hz, useful_bandwidth_hz
from sdr_server.sources.base import CaptureConfig, CaptureStatus, SpectrumCapture

log = logging.getLogger("sdr_server")

FFT_SWEEP = 2048
FFT_PARK = 4096
SWEEP_AVERAGES = 1
PARK_AVERAGES = 4
SETTLE_SWEEP_S = 0.012
SETTLE_PARK_S = 0.03
DISCARD_SWEEP = 4096
DISCARD_PARK = 8192
READ_RETRIES = 2
EMPTY_DB = -95.0
DECAY_DB = 0.04
GARBAGE_DROP_DB = 10.0
# ~32 ms de radio a 2.048 MS/s. Tiene que cubrir demod+WS; si no, el altavoz se queda sin data.
LISTEN_IQ = 65536
AUDIO_NFM_HZ = 16000
AUDIO_WFM_HZ = 16000
RECOVER_COOLDOWN_S = 4.0
AUDIO_QUEUE_MAX = 12


class RtlSdrDev(ctypes.Structure):
    pass


class RtlCapture(SpectrumCapture):
    """RTL-SDR: ventana viva si el span cabe; si no, barrido ≤20 MHz."""

    def __init__(self, sample_rate_hz: float | None = None) -> None:
        self._sample_rate = float(sample_rate_hz or settings.sample_rate_hz)
        self._lib = load_librtlsdr()
        if self._lib is None:
            raise RuntimeError(
                "No se encontró librtlsdr. En macOS: brew install librtlsdr"
            )
        self._bind()
        self._dev = ctypes.POINTER(RtlSdrDev)()
        self._opened = False
        self._config = CaptureConfig(614, 638, 2048, 25)
        self._status = CaptureStatus(
            state="disconnected",
            device_name=None,
            message="RTL-SDR detenido",
            mode="rtl-sdr",
        )
        self._power = np.full(2048, EMPTY_DB, dtype=np.float32)
        self._hop_index = 0
        self._centers_hz: list[float] = []
        self._window_sweep = np.hanning(FFT_SWEEP).astype(np.float32)
        self._window_park = np.hanning(FFT_PARK).astype(np.float32)
        self._last_center_hz = 0.0
        self._usb_fails = 0
        self._chosen_name = "RTL-SDR"
        self._chosen_serial: str | None = None
        self._listen_hz: float | None = None
        self._listen_mode = "nfm"
        self._audio_chunks: deque[np.ndarray] = deque()
        self._audio_hz = AUDIO_NFM_HZ
        self._pass_index = 0
        self._hop_meta: dict | None = None
        self._io = threading.Lock()
        self._reopen_after = 0.0
        self._last_recover = 0.0
        self._applied_gain: str | None = None

    def _bind(self) -> None:
        lib = self._lib
        assert lib is not None
        lib.rtlsdr_open.argtypes = [ctypes.POINTER(ctypes.POINTER(RtlSdrDev)), ctypes.c_uint32]
        lib.rtlsdr_open.restype = ctypes.c_int
        lib.rtlsdr_close.argtypes = [ctypes.POINTER(RtlSdrDev)]
        lib.rtlsdr_close.restype = ctypes.c_int
        lib.rtlsdr_set_sample_rate.argtypes = [ctypes.POINTER(RtlSdrDev), ctypes.c_uint32]
        lib.rtlsdr_set_sample_rate.restype = ctypes.c_int
        lib.rtlsdr_set_center_freq.argtypes = [ctypes.POINTER(RtlSdrDev), ctypes.c_uint32]
        lib.rtlsdr_set_center_freq.restype = ctypes.c_int
        lib.rtlsdr_get_center_freq.argtypes = [ctypes.POINTER(RtlSdrDev)]
        lib.rtlsdr_get_center_freq.restype = ctypes.c_uint32
        lib.rtlsdr_set_tuner_gain_mode.argtypes = [ctypes.POINTER(RtlSdrDev), ctypes.c_int]
        lib.rtlsdr_set_tuner_gain_mode.restype = ctypes.c_int
        lib.rtlsdr_set_tuner_gain.argtypes = [ctypes.POINTER(RtlSdrDev), ctypes.c_int]
        lib.rtlsdr_set_tuner_gain.restype = ctypes.c_int
        lib.rtlsdr_set_agc_mode.argtypes = [ctypes.POINTER(RtlSdrDev), ctypes.c_int]
        lib.rtlsdr_set_agc_mode.restype = ctypes.c_int
        lib.rtlsdr_reset_buffer.argtypes = [ctypes.POINTER(RtlSdrDev)]
        lib.rtlsdr_reset_buffer.restype = ctypes.c_int
        lib.rtlsdr_read_sync.argtypes = [
            ctypes.POINTER(RtlSdrDev),
            ctypes.c_void_p,
            ctypes.c_int,
            ctypes.POINTER(ctypes.c_int),
        ]
        lib.rtlsdr_read_sync.restype = ctypes.c_int
        lib.rtlsdr_get_index_by_serial.argtypes = [ctypes.c_char_p]
        lib.rtlsdr_get_index_by_serial.restype = ctypes.c_int
        lib.rtlsdr_get_tuner_gains.argtypes = [ctypes.POINTER(RtlSdrDev), ctypes.POINTER(ctypes.c_int)]
        lib.rtlsdr_get_tuner_gains.restype = ctypes.c_int

    def open(self, config: CaptureConfig) -> CaptureStatus:
        with self._io:
            self._close_unlocked()
            self._open_unlocked(config)
            return self._configure_unlocked(config)

    def configure(self, config: CaptureConfig) -> CaptureStatus:
        with self._io:
            return self._configure_unlocked(config)

    def _configure_unlocked(self, config: CaptureConfig) -> CaptureStatus:
        start, end = clamp_sweep_range(config.start_mhz, config.end_mhz)
        same_range = (
            abs(self._config.start_mhz - start) < 1e-4
            and abs(self._config.end_mhz - end) < 1e-4
            and self._power.size == config.bin_count
        )
        self._config = CaptureConfig(
            start,
            end,
            config.bin_count,
            config.update_rate_hz,
            serial=config.serial,
            gain=config.gain,
        )
        config = self._config
        useful = useful_bandwidth_hz(self._sample_rate)
        self._centers_hz = hop_centers_hz(
            config.start_mhz * 1e6,
            config.end_mhz * 1e6,
            useful,
        )
        if not same_range:
            self._listen_hz = None
            self._audio_chunks.clear()
            self._power = np.full(config.bin_count, EMPTY_DB, dtype=np.float32)
            self._hop_index = 0
            self._pass_index = 0
            self._last_center_hz = 0.0
            self._hop_meta = None
        if self._listen_hz is not None:
            self._centers_hz = [self._listen_hz]
        if self._opened:
            self._apply_gain(config.gain or settings.gain, force=False)
        hops = len(self._centers_hz)
        span = max(0.0, config.end_mhz - config.start_mhz)
        if hops <= 1:
            sweep_note = "ventana"
        else:
            sweep_note = f"barrido {hops} hops · {span:.0f} MHz"
        self._status = CaptureStatus(
            state="connected",
            device_name=self._chosen_name,
            message=(
                f"RTL-SDR · {sweep_note} · {self._sample_rate/1e6:.3f} MS/s"
            ),
            serial=self._chosen_serial,
            mode="rtl-sdr",
        )
        return self._status

    def set_listen(
        self,
        center_mhz: float | None,
        span_mhz: float = 0.2,
        demod: str = "nfm",
    ) -> None:
        with self._io:
            if center_mhz is None:
                self._listen_hz = None
                self._listen_mode = "nfm"
                self._audio_chunks.clear()
                self._audio_hz = AUDIO_NFM_HZ
                useful = useful_bandwidth_hz(self._sample_rate)
                self._centers_hz = hop_centers_hz(
                    self._config.start_mhz * 1e6,
                    self._config.end_mhz * 1e6,
                    useful,
                )
                self._hop_index = 0
                self._last_center_hz = 0.0
                return
            mode = (demod or "nfm").lower()
            if mode == "auto":
                mode = "wfm" if use_wfm(float(center_mhz), float(span_mhz)) else "nfm"
            if mode not in {"nfm", "wfm", "am"}:
                mode = "nfm"
            self._listen_hz = float(center_mhz) * 1e6
            self._listen_mode = mode
            self._audio_hz = AUDIO_WFM_HZ if mode == "wfm" else AUDIO_NFM_HZ
            self._centers_hz = [self._listen_hz]
            self._hop_index = 0
            self._last_center_hz = 0.0

    def is_listening(self) -> bool:
        return self._listen_hz is not None

    def hop_meta(self):
        with self._io:
            return dict(self._hop_meta) if self._hop_meta else None

    def take_audio(self):
        with self._io:
            if not self._audio_chunks:
                return None
            pcm = self._audio_chunks.popleft()
            rate = self._audio_hz
        if pcm is None or pcm.size == 0:
            return None
        i16 = np.clip(pcm * 20000.0, -32767, 32767).astype(np.int16)
        return {
            "type": "audio",
            "sampleRate": rate,
            "pcm": base64.b64encode(i16.tobytes()).decode("ascii"),
        }

    def _push_audio(self, pcm: np.ndarray) -> None:
        if pcm is None or pcm.size == 0:
            return
        self._audio_chunks.append(pcm)
        while len(self._audio_chunks) > AUDIO_QUEUE_MAX:
            self._audio_chunks.popleft()

    def next_frame(self) -> tuple[int, np.ndarray]:
        with self._io:
            return self._next_frame_locked()

    def close(self) -> None:
        with self._io:
            self._close_unlocked()
        self._status = CaptureStatus(
            state="disconnected",
            device_name=None,
            message="RTL-SDR detenido",
            mode="rtl-sdr",
        )

    def status(self) -> CaptureStatus:
        return self._status

    def _open_unlocked(self, config: CaptureConfig) -> None:
        devices = list_rtl_devices()
        if not devices:
            raise RuntimeError("No hay ningún RTL-SDR conectado")

        index = devices[0].index
        chosen = devices[0]
        serial = config.serial or settings.serial
        if serial:
            idx = self._lib.rtlsdr_get_index_by_serial(serial.encode("utf-8"))
            if idx < 0:
                raise RuntimeError(f"No se encontró RTL-SDR con serial {serial}")
            index = idx
            chosen = next((d for d in devices if d.index == index), devices[0])

        rc = self._lib.rtlsdr_open(ctypes.byref(self._dev), index)
        if rc != 0:
            raise RuntimeError(f"rtlsdr_open falló ({rc}). ¿El dongle está en uso?")

        self._opened = True
        self._chosen_name = chosen.name
        self._chosen_serial = chosen.serial
        if self._lib.rtlsdr_set_sample_rate(self._dev, int(self._sample_rate)) != 0:
            self._close_unlocked()
            raise RuntimeError("No se pudo fijar la tasa de muestreo")

        self._applied_gain = None
        self._apply_gain(config.gain or settings.gain, force=True)
        self._lib.rtlsdr_reset_buffer(self._dev)
        time.sleep(0.08)
        self._usb_fails = 0

    def _close_unlocked(self) -> None:
        if self._opened:
            try:
                self._lib.rtlsdr_close(self._dev)
            except Exception:
                pass
            self._opened = False
            self._last_center_hz = 0.0
            self._applied_gain = None
            self._dev = ctypes.POINTER(RtlSdrDev)()

    def _next_frame_locked(self) -> tuple[int, np.ndarray]:
        if not self._opened:
            self._try_reopen()
            time.sleep(0.05)
            return int(time.time() * 1000), self._power.copy()
        if not self._centers_hz:
            time.sleep(0.05)
            return int(time.time() * 1000), self._power.copy()

        listening = self._listen_hz is not None
        parked = listening or len(self._centers_hz) == 1
        hop_i = self._hop_index
        hop_n = len(self._centers_hz)
        center = self._centers_hz[hop_i]

        if abs(center - self._last_center_hz) > 1.0:
            if not self._tune(center, parked=parked):
                if not listening:
                    self._advance_hop(hop_i, hop_n)
                return int(time.time() * 1000), self._power.copy()

        if listening:
            iq = self._read_iq(LISTEN_IQ)
            if iq is None:
                self._note_usb_fail()
                return int(time.time() * 1000), self._power.copy()
            self._usb_fails = 0
            # Misma IQ → espectro vivo (zona sintonizada) + audio. Sin lectura extra.
            if iq.size >= FFT_PARK:
                psd = power_db(iq[:FFT_PARK], self._window_park).astype(np.float32)
                self._stamp_hop(
                    center,
                    psd,
                    live=True,
                    hop_i=0,
                    hop_n=1,
                )
            if self._listen_mode == "wfm":
                pcm = wfm_audio(iq, self._sample_rate, AUDIO_WFM_HZ)
            elif self._listen_mode == "am":
                pcm = am_audio(iq, self._sample_rate, AUDIO_NFM_HZ)
            else:
                pcm = nfm_audio(iq, self._sample_rate, AUDIO_NFM_HZ)
            self._push_audio(pcm)
            return int(time.time() * 1000), self._power.copy()

        fft_n = FFT_PARK if parked else FFT_SWEEP
        window = self._window_park if parked else self._window_sweep
        averages = PARK_AVERAGES if parked else SWEEP_AVERAGES
        acc = np.zeros(fft_n, dtype=np.float64)
        got = 0
        for _ in range(averages):
            chunk = self._read_iq(fft_n)
            if chunk is None:
                break
            acc += power_db(chunk, window)
            got += 1
        if got == 0:
            self._note_usb_fail()
            if not listening:
                self._advance_hop(hop_i, hop_n)
            return int(time.time() * 1000), self._power.copy()

        self._usb_fails = 0
        psd = (acc / got).astype(np.float32)
        self._stamp_hop(center, psd, live=parked, hop_i=hop_i, hop_n=hop_n)
        self._advance_hop(hop_i, hop_n)
        return int(time.time() * 1000), self._power.copy()

    def _tune(self, center_hz: float, *, parked: bool) -> bool:
        rc = self._lib.rtlsdr_set_center_freq(self._dev, int(center_hz))
        if rc != 0:
            self._note_usb_fail()
            return False
        time.sleep(SETTLE_PARK_S if parked else SETTLE_SWEEP_S)
        self._lib.rtlsdr_reset_buffer(self._dev)
        self._read_iq(
            DISCARD_PARK if parked else DISCARD_SWEEP,
            keep=False,
            require_alive=False,
        )
        self._last_center_hz = center_hz
        return True

    def _advance_hop(self, hop_i: int, hop_n: int) -> None:
        if hop_n <= 0:
            return
        self._hop_index = (hop_i + 1) % hop_n
        if hop_n > 1 and self._hop_index == 0:
            self._pass_index += 1

    def _note_usb_fail(self) -> None:
        self._usb_fails += 1
        if self._usb_fails >= 20:
            self._recover()

    def _read_iq(
        self,
        n_iq: int,
        *,
        keep: bool = True,
        require_alive: bool = False,
    ) -> np.ndarray | None:
        buf_len = n_iq * 2
        for _ in range(READ_RETRIES):
            raw = (ctypes.c_uint8 * buf_len)()
            n_read = ctypes.c_int(0)
            rc = self._lib.rtlsdr_read_sync(
                self._dev, raw, buf_len, ctypes.byref(n_read)
            )
            if rc != 0 or n_read.value < buf_len:
                time.sleep(0.003)
                continue
            samples = np.frombuffer(raw, dtype=np.uint8, count=n_read.value)
            if require_alive and not iq_buffer_alive(samples):
                time.sleep(0.003)
                continue
            if not keep:
                return samples
            iq = iq_from_u8(samples)
            if iq.size < n_iq:
                continue
            return iq
        return None

    def _try_reopen(self) -> None:
        now = time.monotonic()
        if now < self._reopen_after:
            return
        try:
            self._close_unlocked()
            self._open_unlocked(self._config)
            self._power[:] = EMPTY_DB
            self._hop_index = 0
            self._last_center_hz = 0.0
            self._configure_unlocked(self._config)
            log.info("RTL-SDR reconectado")
        except Exception as exc:
            self._reopen_after = now + 1.5
            self._status = CaptureStatus(
                state="error",
                device_name=None,
                message=f"Dongle caído — reconectando ({exc})",
                serial=self._chosen_serial,
                mode="rtl-sdr",
            )

    def _recover(self) -> None:
        now = time.monotonic()
        if now - self._last_recover < RECOVER_COOLDOWN_S:
            self._usb_fails = 0
            return
        self._last_recover = now
        log.warning("RTL-SDR USB inestable — reabriendo el dongle")
        try:
            self._close_unlocked()
            time.sleep(0.25)
            self._open_unlocked(self._config)
            self._power[:] = EMPTY_DB
            self._hop_index = 0
            self._last_center_hz = 0.0
            self._reopen_after = 0.0
            self._configure_unlocked(self._config)
            self._usb_fails = 0
            log.info("RTL-SDR reabierto tras fallo USB")
        except Exception:
            log.exception("No se pudo reabrir el RTL-SDR")
            self._usb_fails = 0
            self._reopen_after = time.monotonic() + 1.5
            self._status = CaptureStatus(
                state="error",
                device_name=None,
                message="Dongle USB caído — reconectando",
                serial=self._chosen_serial,
                mode="rtl-sdr",
            )

    def _apply_gain(self, gain: str, *, force: bool = False) -> None:
        if not self._opened:
            return
        if not force and self._applied_gain == gain:
            return
        if gain.strip().lower() in {"auto", "agc"}:
            self._lib.rtlsdr_set_tuner_gain_mode(self._dev, 0)
            self._lib.rtlsdr_set_agc_mode(self._dev, 1)
            self._applied_gain = gain
            return
        try:
            db = float(gain)
        except ValueError:
            db = 28.0
        self._lib.rtlsdr_set_agc_mode(self._dev, 0)
        self._lib.rtlsdr_set_tuner_gain_mode(self._dev, 1)
        tenths = self._nearest_gain_tenths(db)
        self._lib.rtlsdr_set_tuner_gain(self._dev, tenths)
        self._applied_gain = gain

    def _nearest_gain_tenths(self, db: float) -> int:
        count = int(self._lib.rtlsdr_get_tuner_gains(self._dev, None))
        if count <= 0:
            return int(round(db * 10))
        arr = (ctypes.c_int * count)()
        self._lib.rtlsdr_get_tuner_gains(self._dev, arr)
        target = db * 10.0
        return min(list(arr), key=lambda g: abs(g - target))

    def _stamp_hop(
        self,
        center_hz: float,
        psd: np.ndarray,
        *,
        live: bool,
        hop_i: int,
        hop_n: int,
    ) -> None:
        cfg = self._config
        start_hz = cfg.start_mhz * 1e6
        end_hz = cfg.end_mhz * 1e6
        span = max(1.0, end_hz - start_hz)
        freqs, keep = hop_axis(center_hz, self._sample_rate, psd.size)
        src_f = freqs[keep]
        src_p = psd[keep]
        if src_f.size < 8:
            return

        hop_start = float(src_f[0])
        hop_end = float(src_f[-1])
        bins = self._power.size
        lo = int(np.floor((hop_start - start_hz) / span * bins))
        hi = int(np.ceil((hop_end - start_hz) / span * bins))
        lo = max(0, lo)
        hi = min(bins, hi)
        if hi - lo < 2:
            return

        dest_freq = start_hz + (np.arange(lo, hi) + 0.5) * (span / bins)
        mapped = np.interp(dest_freq, src_f, src_p).astype(np.float32)
        if live:
            self._power[lo:hi] = mapped
        else:
            prev = self._power[lo:hi]
            plausible = mapped >= (prev - GARBAGE_DROP_DB)
            faded = prev - DECAY_DB
            self._power[lo:hi] = np.where(
                plausible,
                np.maximum(faded, mapped),
                prev,
            )
        self._hop_meta = {
            "hopStartMhz": hop_start / 1e6,
            "hopEndMhz": hop_end / 1e6,
            "hopIndex": hop_i,
            "hopCount": hop_n,
            "passIndex": self._pass_index,
        }
