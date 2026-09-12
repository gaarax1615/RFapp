from __future__ import annotations

# El RTL ~2 MHz instantáneos; bandas BLX/kit caben en ≤40 MHz.
MAX_SWEEP_SPAN_MHZ = 40.0


def clamp_sweep_range(start_mhz: float, end_mhz: float) -> tuple[float, float]:
    """Recorta a un tramo continuo de como máximo 40 MHz."""
    start = float(start_mhz)
    end = float(end_mhz)
    if start > end:
        start, end = end, start
    span = end - start
    if span <= MAX_SWEEP_SPAN_MHZ:
        return start, end
    mid = (start + end) / 2.0
    half = MAX_SWEEP_SPAN_MHZ / 2.0
    return mid - half, mid + half


def useful_bandwidth_hz(sample_rate_hz: float, edge_fraction: float = 0.15) -> float:
    """Ancho usable por hop, recortando bordes del filtro anti-alias."""
    return sample_rate_hz * (1.0 - edge_fraction)


def hop_centers_hz(
    start_hz: float,
    end_hz: float,
    useful_bw_hz: float,
) -> list[float]:
    """Centros de sintonía para cubrir [start_hz, end_hz]."""
    if end_hz <= start_hz:
        raise ValueError("end_hz debe ser mayor que start_hz")
    if useful_bw_hz <= 0:
        raise ValueError("useful_bw_hz debe ser positivo")

    span = end_hz - start_hz
    if span <= useful_bw_hz:
        return [(start_hz + end_hz) / 2.0]

    centers: list[float] = []
    half = useful_bw_hz / 2.0
    f = start_hz + half
    while f + half < end_hz + 1.0:
        centers.append(f)
        f += useful_bw_hz
        if len(centers) > 512:
            break

    last_needed = end_hz - half
    if not centers or centers[-1] < last_needed - 1.0:
        centers.append(max(start_hz + half, last_needed))
    return centers
