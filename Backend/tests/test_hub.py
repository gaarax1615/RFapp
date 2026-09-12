from sdr_server.hub import _same_capture
from sdr_server.models import SpectrumConfigIn


def test_same_capture_ignores_second_identical_start():
    a = SpectrumConfigIn(
        startFrequencyMhz=614,
        endFrequencyMhz=638,
        binCount=2048,
        preferDevice="rtl-sdr",
        gain="28.0",
    )
    b = SpectrumConfigIn(
        startFrequencyMhz=614,
        endFrequencyMhz=638,
        binCount=2048,
        preferDevice="rtl-sdr",
        gain="28.0",
    )
    assert _same_capture(a, b) is True


def test_same_capture_detects_range_change():
    a = SpectrumConfigIn(startFrequencyMhz=614, endFrequencyMhz=638)
    b = SpectrumConfigIn(startFrequencyMhz=88, endFrequencyMhz=108)
    assert _same_capture(a, b) is False
