import type { SpectrumFrame } from '@/types/spectrum'
import { SPECTRUM_DB, plotPixelBounds } from '@/modules/spectrum/spectrumRange'

export interface WaterfallRenderOptions {
  minDb: number
  maxDb: number
  rowHeight: number
}

/**
 * Cascada continua (estilo SDR++):
 * - Línea en borrador (intensidad): cada hop actualiza solo su franja.
 * - Scroll cada ~45 ms con la línea completa → no se congela.
 * - Muestreo lineal entre bins → sin bloques rectangulares.
 */
export class WaterfallRenderer {
  private options: WaterfallRenderOptions = {
    minDb: SPECTRUM_DB.minDb,
    maxDb: SPECTRUM_DB.maxDb,
    rowHeight: 1,
  }
  private scaleMin = SPECTRUM_DB.minDb
  private scaleMax = SPECTRUM_DB.maxDb
  private buffer: ImageData | null = null
  private cssW = 0
  private cssH = 0
  private lastRangeKey = ''
  private lastScrollAt = 0
  /** Intensidad 0..1 por pixel del plot (fila en construcción). */
  private draft: Float32Array | null = null
  private draftPlotPx = 0

  setOptions(partial: Partial<WaterfallRenderOptions>): void {
    this.options = { ...this.options, ...partial }
  }

  reset(): void {
    this.buffer = null
    this.lastRangeKey = ''
    this.lastScrollAt = 0
    this.draft = null
    this.draftPlotPx = 0
    this.scaleMin = this.options.minDb
    this.scaleMax = this.options.maxDb
  }

  attach(_canvas: HTMLCanvasElement): void {
    /* buffer-first */
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.ensureSize(cssWidth, cssHeight)
  }

  ensureSize(cssWidth: number, cssHeight: number): void {
    const w = Math.max(1, Math.floor(cssWidth))
    const h = Math.max(1, Math.floor(cssHeight))
    if (w === this.cssW && h === this.cssH && this.buffer) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const next = new ImageData(
      Math.max(1, Math.floor(w * dpr)),
      Math.max(1, Math.floor(h * dpr)),
    )
    fillNavy(next)
    if (this.buffer) copyHistory(this.buffer, next)
    this.buffer = next
    this.cssW = w
    this.cssH = h
    this.ensureDraft(dpr)
  }

  ingest(frame: SpectrumFrame, cssWidth: number, cssHeight: number): void {
    this.ensureSize(cssWidth, cssHeight)
    const buffer = this.buffer
    if (!buffer) return

    const rangeKey = `${frame.startFrequencyMhz.toFixed(4)}:${frame.endFrequencyMhz.toFixed(4)}`
    if (rangeKey !== this.lastRangeKey) {
      this.lastRangeKey = rangeKey
      this.lastScrollAt = 0
      fillNavy(buffer)
      this.clearDraft()
    }

    this.updateScale(frame.powerDb)

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    this.ensureDraft(dpr)

    const hops = frame.hopCount ?? 1
    const parked = hops <= 1
    const hopStart = frame.hopStartMhz
    const hopEnd = frame.hopEndMhz

    if (
      !parked &&
      hopStart != null &&
      hopEnd != null &&
      Number.isFinite(hopStart) &&
      Number.isFinite(hopEnd) &&
      hopEnd > hopStart
    ) {
      this.writeDraftSpan(frame, hopStart, hopEnd)
    } else {
      this.writeDraftSpan(frame, frame.startFrequencyMhz, frame.endFrequencyMhz)
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    // Ventana fija: cada frame. Barrido: ~22 fps para que no se vea congelada.
    const minGapMs = parked ? 0 : 45
    if (minGapMs === 0 || now - this.lastScrollAt >= minGapMs) {
      this.scrollDown()
      this.paintDraftRow()
      this.lastScrollAt = now
      // En barrido no borramos el draft: la siguiente fila hereda hops ya visitados
      // (líneas verticales). En parked cada frame es fresco.
      if (parked) this.clearDraft()
    }
  }

  pushFrame(frame: SpectrumFrame, cssWidth: number, cssHeight: number): void {
    this.ingest(frame, cssWidth, cssHeight)
  }

  present(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): void {
    this.ensureSize(cssWidth, cssHeight)
    const buffer = this.buffer
    if (!buffer) return
    const dpr = window.devicePixelRatio || 1
    const pw = Math.max(1, Math.floor(cssWidth * dpr))
    const ph = Math.max(1, Math.floor(cssHeight * dpr))
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.putImageData(buffer, 0, 0)
  }

  private ensureDraft(dpr: number): void {
    const { plotPx } = plotPixelBounds(this.cssW, dpr)
    if (this.draft && this.draftPlotPx === plotPx) return
    this.draft = new Float32Array(Math.max(1, plotPx))
    this.draft.fill(-1) // -1 = aún no hay dato
    this.draftPlotPx = plotPx
  }

  private clearDraft(): void {
    if (!this.draft) return
    this.draft.fill(-1)
  }

  private writeDraftSpan(frame: SpectrumFrame, f0: number, f1: number): void {
    const draft = this.draft
    if (!draft || this.draftPlotPx <= 0) return
    const bins = frame.powerDb
    const n = bins.length
    if (n < 2) return
    const span = frame.endFrequencyMhz - frame.startFrequencyMhz
    if (span <= 0) return
    const lastBin = n - 1
    const plotPx = this.draftPlotPx
    const dbSpan = this.scaleMax - this.scaleMin || 1

    const iStart = Math.max(
      0,
      Math.floor(((f0 - frame.startFrequencyMhz) / span) * plotPx),
    )
    const iEnd = Math.min(
      plotPx - 1,
      Math.ceil(((f1 - frame.startFrequencyMhz) / span) * plotPx),
    )

    for (let i = iStart; i <= iEnd; i++) {
      const t = plotPx === 1 ? 0 : i / (plotPx - 1)
      const freq = frame.startFrequencyMhz + t * span
      if (freq < f0 || freq > f1) continue
      const binF = t * lastBin
      const i0 = Math.max(0, Math.min(lastBin - 1, Math.floor(binF)))
      const frac = binF - i0
      const a = bins[i0] ?? this.scaleMin
      const b = bins[i0 + 1] ?? a
      const db = a + (b - a) * frac
      let amp = (db - this.scaleMin) / dbSpan
      amp = Math.max(0, Math.min(1, amp))
      amp = amp ** 1.35
      draft[i] = amp
    }
  }

  private paintDraftRow(): void {
    const buffer = this.buffer
    const draft = this.draft
    if (!buffer || !draft) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const rowH = Math.max(1, Math.round(dpr))
    const { leftPx, plotPx } = plotPixelBounds(this.cssW, dpr)
    const pixelW = buffer.width
    const data = buffer.data

    for (let x = 0; x < pixelW; x++) {
      const plotX = x - leftPx
      let r = 8
      let g = 18
      let b = 72
      if (plotX >= 0 && plotX < plotPx) {
        const amp = draft[Math.min(plotPx - 1, plotX)] ?? -1
        if (amp >= 0) {
          ;[r, g, b] = smoothWaterfallColor(amp)
        }
      }
      for (let y = 0; y < rowH; y++) {
        const i = (y * pixelW + x) * 4
        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = 255
      }
    }
  }

  private scrollDown(): void {
    const buffer = this.buffer
    if (!buffer) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const rowH = Math.max(1, Math.round(dpr))
    const { width, data } = buffer
    const rowBytes = width * 4 * rowH
    if (rowBytes >= data.length) return
    data.copyWithin(rowBytes, 0, data.length - rowBytes)
  }

  private updateScale(bins: Float32Array): void {
    const sample: number[] = []
    const step = Math.max(1, Math.floor(bins.length / 360))
    for (let i = 0; i < bins.length; i += step) {
      const v = bins[i]
      if (v !== undefined && Number.isFinite(v) && v > -93) sample.push(v)
    }
    if (sample.length < 24) return
    sample.sort((a, b) => a - b)
    const p15 = sample[Math.floor(sample.length * 0.15)] ?? -85
    const p99 = sample[Math.floor(sample.length * 0.99)] ?? -40
    const lo = p15 - 2
    const hi = Math.max(p99 + 2, lo + 20)
    this.scaleMin += (lo - this.scaleMin) * 0.08
    this.scaleMax += (hi - this.scaleMax) * 0.08
  }
}

function fillNavy(image: ImageData): void {
  const d = image.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 8
    d[i + 1] = 18
    d[i + 2] = 72
    d[i + 3] = 255
  }
}

function copyHistory(from: ImageData, to: ImageData): void {
  const w = Math.min(from.width, to.width)
  const h = Math.min(from.height, to.height)
  for (let y = 0; y < h; y++) {
    const src = y * from.width * 4
    const dst = y * to.width * 4
    to.data.set(from.data.subarray(src, src + w * 4), dst)
  }
}

function smoothWaterfallColor(t: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0.0, 8, 18, 72],
    [0.08, 10, 40, 120],
    [0.18, 20, 80, 180],
    [0.3, 40, 140, 220],
    [0.42, 30, 190, 190],
    [0.52, 40, 200, 100],
    [0.62, 120, 210, 40],
    [0.72, 220, 200, 30],
    [0.82, 250, 140, 20],
    [0.92, 255, 80, 40],
    [1.0, 255, 240, 230],
  ]
  const x = Math.max(0, Math.min(1, t))
  let i = 0
  while (i < stops.length - 1 && x > stops[i + 1]![0]) i++
  const a = stops[i]!
  const b = stops[Math.min(i + 1, stops.length - 1)]!
  const u = (x - a[0]) / (b[0] - a[0] || 1)
  const s = u * u * (3 - 2 * u)
  return [
    Math.round(a[1] + (b[1] - a[1]) * s),
    Math.round(a[2] + (b[2] - a[2]) * s),
    Math.round(a[3] + (b[3] - a[3]) * s),
  ]
}
