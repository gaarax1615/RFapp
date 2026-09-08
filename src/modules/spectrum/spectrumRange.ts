export const SPECTRUM_PAD = {
  top: 72,
  right: 18,
  bottom: 44,
  left: 58,
} as const

export const MIN_SPAN_MHZ = 1
export const ABS_MIN_MHZ = 1
export const ABS_MAX_MHZ = 6000
export const FULL_UHF = { startMhz: 470, endMhz: 698 } as const

export function clampRange(
  startMhz: number,
  endMhz: number,
): { startMhz: number; endMhz: number } | null {
  if (!Number.isFinite(startMhz) || !Number.isFinite(endMhz)) return null
  let start = Math.max(ABS_MIN_MHZ, Math.min(ABS_MAX_MHZ, startMhz))
  let end = Math.max(ABS_MIN_MHZ, Math.min(ABS_MAX_MHZ, endMhz))
  if (start > end) [start, end] = [end, start]
  if (end - start < MIN_SPAN_MHZ) {
    const mid = (start + end) / 2
    start = mid - MIN_SPAN_MHZ / 2
    end = mid + MIN_SPAN_MHZ / 2
  }
  start = Math.max(ABS_MIN_MHZ, start)
  end = Math.min(ABS_MAX_MHZ, end)
  if (end - start < MIN_SPAN_MHZ) return null
  return {
    startMhz: +start.toFixed(4),
    endMhz: +end.toFixed(4),
  }
}

/** factor < 1 zooms in, > 1 zooms out. Anchor stays under cursor. */
export function zoomAround(
  centerMhz: number,
  startMhz: number,
  endMhz: number,
  factor: number,
): { startMhz: number; endMhz: number } | null {
  const span = endMhz - startMhz
  const newSpan = Math.max(MIN_SPAN_MHZ, span * factor)
  const t = span > 0 ? (centerMhz - startMhz) / span : 0.5
  const nextStart = centerMhz - newSpan * t
  const nextEnd = centerMhz + newSpan * (1 - t)
  return clampRange(nextStart, nextEnd)
}

export function plotWidth(cssWidth: number): number {
  return cssWidth - SPECTRUM_PAD.left - SPECTRUM_PAD.right
}

export function xToFrequencyMhz(
  x: number,
  cssWidth: number,
  startMhz: number,
  endMhz: number,
): number | null {
  const w = plotWidth(cssWidth)
  if (w <= 0) return null
  const t = (x - SPECTRUM_PAD.left) / w
  if (t < 0 || t > 1) return null
  return startMhz + t * (endMhz - startMhz)
}

export function frequencyToX(
  frequencyMhz: number,
  cssWidth: number,
  startMhz: number,
  endMhz: number,
): number | null {
  const span = endMhz - startMhz
  const w = plotWidth(cssWidth)
  if (span <= 0 || w <= 0) return null
  if (frequencyMhz < startMhz || frequencyMhz > endMhz) return null
  return SPECTRUM_PAD.left + ((frequencyMhz - startMhz) / span) * w
}
