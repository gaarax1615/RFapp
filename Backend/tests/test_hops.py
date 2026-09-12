from sdr_server.hops import clamp_sweep_range, hop_centers_hz, useful_bandwidth_hz


def test_single_hop_when_span_fits():
    centers = hop_centers_hz(100e6, 101e6, 2.4e6)
    assert len(centers) == 1
    assert centers[0] == 100.5e6


def test_multiple_hops_cover_uhf():
    useful = useful_bandwidth_hz(2.4e6)
    centers = hop_centers_hz(470e6, 698e6, useful)
    assert len(centers) > 80
    assert centers[0] < 472e6
    assert centers[-1] > 696e6


def test_useful_bandwidth_trims_edges():
    assert useful_bandwidth_hz(2.4e6) == 2.4e6 * 0.85


def test_clamp_sweep_keeps_forty_mhz_windows():
    assert clamp_sweep_range(614, 638) == (614.0, 638.0)
    start, end = clamp_sweep_range(470, 698)
    assert end - start == 40.0
    assert abs((start + end) / 2 - 584.0) < 0.01


def test_kit_band_needs_about_a_dozen_hops():
    useful = useful_bandwidth_hz(2.048e6)
    centers = hop_centers_hz(614e6, 638e6, useful)
    assert 10 < len(centers) < 30
