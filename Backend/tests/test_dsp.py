import numpy as np

from sdr_server.dsp import (
    am_audio,
    fm_demod,
    hop_axis,
    iq_buffer_alive,
    iq_from_u8,
    nfm_audio,
    power_db,
    use_wfm,
    wfm_audio,
)


def test_tone_rises_above_noise():
    n = 4096
    t = np.arange(n)
    tone = 0.25 * np.exp(1j * 2 * np.pi * 200 * t / n)
    window = np.hanning(n).astype(np.float32)
    psd = power_db(tone.astype(np.complex64), window)
    noise = np.median(psd)
    peak = float(np.max(psd))
    assert peak > noise + 20


def test_dead_usb_buffer_is_rejected():
    assert iq_buffer_alive(np.full(4096, 127, dtype=np.uint8)) is False
    noisy = np.random.randint(90, 160, size=4096, dtype=np.uint8)
    assert iq_buffer_alive(noisy) is True


def test_u8_iq_roundtrip_length():
    raw = np.full(16, 127, dtype=np.uint8)
    raw[0::2] = 200
    iq = iq_from_u8(raw)
    assert iq.size == 8


def test_fm_demod_has_energy():
    n = 4096
    t = np.arange(n)
    # FM simple: desviación de fase
    phase = 0.8 * np.sin(2 * np.pi * 40 * t / n)
    iq = np.exp(1j * phase).astype(np.complex64)
    audio = fm_demod(iq)
    assert audio.size == n - 1
    assert float(np.max(np.abs(audio))) > 0.02


def test_wfm_picks_broadcast_band():
    assert use_wfm(99.3125, 0.2) is True
    assert use_wfm(520.0, 0.2) is False
    assert use_wfm(520.0, 0.6) is True


def test_am_audio_has_samples():
    n = 8192
    t = np.arange(n)
    tone = (0.4 + 0.3 * np.sin(2 * np.pi * 40 * t / n)) * np.exp(
        1j * 2 * np.pi * 200 * t / n
    )
    audio = am_audio(tone.astype(np.complex64), 2.048e6, 16000)
    assert audio.size > 20


def test_wfm_audio_has_samples():
    n = 8192
    t = np.arange(n)
    phase = 1.2 * np.sin(2 * np.pi * 80 * t / n)
    iq = np.exp(1j * phase).astype(np.complex64)
    audio = wfm_audio(iq, 2.048e6, 48000)
    assert audio.size > 20
    assert float(np.max(np.abs(audio))) > 0.02


def test_nfm_audio_duration_matches_iq_time():
    """Si producimos menos audio que el tiempo de radio, el altavoz se queda sin data."""
    sr = 2.048e6
    n_iq = 65536
    iq = (np.random.randn(n_iq) + 1j * np.random.randn(n_iq)).astype(np.complex64) * 0.1
    audio = nfm_audio(iq, sr, 16000)
    radio_s = n_iq / sr
    audio_s = audio.size / 16000.0
    assert audio_s > radio_s * 0.85
    assert audio_s < radio_s * 1.15


def test_hop_axis_drops_edges():
    freqs, keep = hop_axis(100e6, 2.048e6, 4096)
    assert freqs.size == 4096
    assert keep.sum() < 4096
    assert keep[0] == False
    assert keep[-1] == False
