import type { SpectrumFrame } from '@/types/spectrum'
import { SPECTRUM_DB, plotPixelBounds } from '@/modules/spectrum/spectrumRange'

export interface WaterfallRenderOptions {
  minDb: number
  maxDb: number
  rowHeight: number
}

/**
 * Cascada alineada al RTA: mismo recuadro en X, mismos bins, misma escala dB.
 */
export class WaterfallRenderer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private buffer: ImageData | null = null
  private options: WaterfallRenderOptions = {
    minDb: SPECTRUM_DB.minDb,
    maxDb: SPECTRUM_DB.maxDb,
    rowHeight: 2,
  }

  setOptions(partial: Partial<WaterfallRenderOptions>): void {
    this.options = { ...this.options, ...partial }
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })
    this.buffer = null
  }

  resize(cssWidth: number, cssHeight: number): void {
    if (!this.canvas || !this.ctx) return
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.max(1, Math.floor(cssWidth * dpr))
    this.canvas.height = Math.max(1, Math.floor(cssHeight * dpr))
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.buffer = null
  }

  pushFrame(frame: SpectrumFrame, cssWidth: number, cssHeight: number): void {
    if (!this.ctx || !this.canvas) return
    const w = Math.max(1, Math.floor(cssWidth))
    const h = Math.max(1, Math.floor(cssHeight))
    const dpr = window.devicePixelRatio || 1
    const { pixelW, leftPx, plotPx } = plotPixelBounds(w, dpr)
    const pixelH = Math.floor(h * dpr)

    if (this.canvas.width !== pixelW || this.canvas.height !== pixelH) {
      this.resize(w, h)
    }

    const ctx = this.ctx
    const rowH = Math.max(1, Math.round(this.options.rowHeight * dpr))
    if (plotPx <= 0) return

    if (this.buffer && this.buffer.width === pixelW && this.buffer.height === pixelH) {
      ctx.putImageData(this.buffer, 0, rowH)
    } else {
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, pixelW, pixelH)
    }

    const row = ctx.createImageData(pixelW, rowH)
    const bins = frame.powerDb.length
    const lastBin = Math.max(1, bins - 1)
    const { minDb, maxDb } = this.options
    const dbSpan = maxDb - minDb || 1
    const bg: [number, number, number] = [13, 17, 23]

    for (let x = 0; x < pixelW; x++) {
      const plotX = x - leftPx
      const inPlot = plotX >= 0 && plotX < plotPx
      let r = bg[0]
      let g = bg[1]
      let b = bg[2]

      if (inPlot && bins > 0) {
        const t = plotPx === 1 ? 0 : plotX / (plotPx - 1)
        const binF = Math.max(0, Math.min(lastBin, t * lastBin))
        const i0 = Math.floor(binF)
        const i1 = Math.min(lastBin, i0 + 1)
        const frac = binF - i0
        const db0 = frame.powerDb[i0] ?? minDb
        const db1 = frame.powerDb[i1] ?? db0
        const db = db0 + (db1 - db0) * frac
        const amp = Math.max(0, Math.min(1, (db - minDb) / dbSpan))
        ;[r, g, b] = heatColor(amp)
      }

      for (let y = 0; y < rowH; y++) {
        const i = (y * pixelW + x) * 4
        row.data[i] = r
        row.data[i + 1] = g
        row.data[i + 2] = b
        row.data[i + 3] = 255
      }
    }

    ctx.putImageData(row, 0, 0)
    this.buffer = ctx.getImageData(0, 0, pixelW, pixelH)
  }
}

function heatColor(t: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0.0, 13, 17, 23],
    [0.12, 15, 23, 42],
    [0.28, 12, 74, 110],
    [0.45, 15, 118, 110],
    [0.62, 45, 180, 140],
    [0.78, 94, 234, 212],
    [0.9, 250, 204, 21],
    [1.0, 255, 255, 245],
  ]

  let i = 0
  while (i < stops.length - 1 && t > stops[i + 1]![0]) i++
  const a = stops[i]!
  const b = stops[Math.min(i + 1, stops.length - 1)]!
  const u = (t - a[0]) / (b[0] - a[0] || 1)
  return [
    Math.round(a[1] + (b[1] - a[1]) * u),
    Math.round(a[2] + (b[2] - a[2]) * u),
    Math.round(a[3] + (b[3] - a[3]) * u),
  ]
}
