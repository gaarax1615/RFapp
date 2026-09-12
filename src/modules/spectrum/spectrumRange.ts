export const SPECTRUM_PAD = {
  top: 80,
  right: 16,
  bottom: 6,
  left: 52,
} as const

/** Escala de amplitud por defecto (sensibilidad 50). */
export const SPECTRUM_DB = {
  minDb: -110,
  maxDb: -20,
} as const

/** 0 = menos sensible · 100 = más sensible. El span vertical se mantiene. */
export const RTA_SENSITIVITY = {
  min: 0,
  max: 100,
  default: 50,
  spanDb: 90,
  minDbLeast: -80,
  minDbMost: -140,
} as const

export function clampRtaSensitivity(value: number): number {
  if (!Number.isFinite(value)) return RTA_SENSITIVITY.default
  return Math.min(RTA_SENSITIVITY.max, Math.max(RTA_SENSITIVITY.min, Math.round(value)))
}

/** Ventana dB según sensibilidad. Más sensibilidad baja el piso y acerca las señales débiles. */
export function rtaDbWindow(sensitivity: number): { minDb: number; maxDb: number } {
  const t = clampRtaSensitivity(sensitivity) / 100
  const minDb =
    RTA_SENSITIVITY.minDbLeast +
    t * (RTA_SENSITIVITY.minDbMost - RTA_SENSITIVITY.minDbLeast)
  return { minDb, maxDb: minDb + RTA_SENSITIVITY.spanDb }
}

export const MIN_SPAN_MHZ = 1
/** Ancho en el que el RTL se queda parado (~2 MHz de IQ): lectura en tiempo real. */
export const LIVE_WINDOW_MHZ = 1.6
/** El RTL barre este tramo a saltos; bandas de kit (BLX) caben en ≤40 MHz. */
export const MAX_SPAN_MHZ = 40
export const ABS_MIN_MHZ = 1
export const ABS_MAX_MHZ = 6000
export const FULL_UHF = { startMhz: 470, endMhz: 698 } as const
export const DEFAULT_SWEEP = { startMhz: 614, endMhz: 638 } as const

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
  if (end - start > MAX_SPAN_MHZ) {
    const mid = (start + end) / 2
    start = mid - MAX_SPAN_MHZ / 2
    end = mid + MAX_SPAN_MHZ / 2
  }
  start = Math.max(ABS_MIN_MHZ, start)
  end = Math.min(ABS_MAX_MHZ, end)
  if (end - start > MAX_SPAN_MHZ) {
    if (start <= ABS_MIN_MHZ) end = start + MAX_SPAN_MHZ
    else if (end >= ABS_MAX_MHZ) start = end - MAX_SPAN_MHZ
  }
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
  const newSpan = Math.min(MAX_SPAN_MHZ, Math.max(MIN_SPAN_MHZ, span * factor))
  const t = span > 0 ? (centerMhz - startMhz) / span : 0.5
  const nextStart = centerMhz - newSpan * t
  const nextEnd = centerMhz + newSpan * (1 - t)
  return clampRange(nextStart, nextEnd)
}

export function plotWidth(cssWidth: number): number {
  return cssWidth - SPECTRUM_PAD.left - SPECTRUM_PAD.right
}

/** Límites del recuadro de traza en píxeles de dispositivo — RTA y cascada. */
export function plotPixelBounds(cssWidth: number, dpr: number) {
  const pixelW = Math.max(1, Math.floor(cssWidth * dpr))
  const leftPx = Math.round(SPECTRUM_PAD.left * dpr)
  const rightPx = Math.round(SPECTRUM_PAD.right * dpr)
  const plotPx = Math.max(1, pixelW - leftPx - rightPx)
  return { pixelW, leftPx, rightPx, plotPx }
}

export function frequencyTickStepMhz(spanMhz: number): number {
  if (spanMhz > 150) return 50
  if (spanMhz > 60) return 20
  if (spanMhz > 20) return 10
  if (spanMhz > 8) return 5
  if (spanMhz > 3) return 1
  return 0.5
}

export function frequencyTicks(
  startMhz: number,
  endMhz: number,
): { mhz: number; t: number }[] {
  const span = endMhz - startMhz
  if (span <= 0) return []
  const step = frequencyTickStepMhz(span)
  const ticks: { mhz: number; t: number }[] = []
  const first = Math.ceil(startMhz / step) * step
  for (let mhz = first; mhz <= endMhz + 1e-9; mhz += step) {
    ticks.push({ mhz: +mhz.toFixed(4), t: (mhz - startMhz) / span })
  }
  return ticks
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
