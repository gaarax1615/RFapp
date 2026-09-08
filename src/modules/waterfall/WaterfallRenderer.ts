import type { SpectrumFrame } from '@/types/spectrum'

export interface WaterfallRenderOptions {
  minDb: number
  maxDb: number
  rowHeight: number
}

/**
 * Scrolling RF waterfall — modern teal/amber colormap.
 */
export class WaterfallRenderer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private buffer: ImageData | null = null
  private options: WaterfallRenderOptions = {
    minDb: -110,
    maxDb: -25,
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

    if (
      this.canvas.width !== Math.floor(w * dpr) ||
      this.canvas.height !== Math.floor(h * dpr)
    ) {
      this.resize(w, h)
    }

    const ctx = this.ctx
    const pixelW = Math.floor(w * dpr)
    const pixelH = Math.floor(h * dpr)
    const rowH = Math.max(1, Math.round(this.options.rowHeight * dpr))

    if (this.buffer && this.buffer.width === pixelW && this.buffer.height === pixelH) {
      ctx.putImageData(this.buffer, 0, rowH)
    } else {
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, pixelW, pixelH)
    }

    const row = ctx.createImageData(pixelW, rowH)
    const bins = frame.powerDb.length
    const { minDb, maxDb } = this.options

    for (let x = 0; x < pixelW; x++) {
      const bin = Math.min(bins - 1, Math.floor((x / pixelW) * bins))
      const db = frame.powerDb[bin] ?? minDb
      const t = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)))
      const [r, g, b] = heatColor(t)
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

/** Modern RF waterfall: deep navy → teal → lime → amber → white */
function heatColor(t: number): [number, number, number] {
  const stops: [number, number, number, number][] = [
    [0.0, 8, 12, 22],
    [0.15, 15, 23, 42],
    [0.3, 12, 74, 110],
    [0.45, 15, 118, 110],
    [0.6, 45, 180, 140],
    [0.72, 132, 204, 22],
    [0.85, 250, 204, 21],
    [0.93, 251, 146, 60],
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
