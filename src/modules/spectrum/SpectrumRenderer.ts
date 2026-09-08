import type { SpectrumFrame } from '@/types/spectrum'
import type { RfDevice } from '@/types/device'
import { SPECTRUM_PAD } from './spectrumRange'

export interface SpectrumRenderOptions {
  minDb: number
  maxDb: number
  selectedDeviceId: string | null
  devices: RfDevice[]
  peakHoldDecay: number
  showPeakHold: boolean
  showAverage: boolean
  /** Drag-zoom selection in CSS pixels (canvas coords). */
  zoomSelection: { x0: number; x1: number } | null
  /** Hover cursor frequency readout. */
  cursorMhz: number | null
}

const DEFAULT_OPTIONS: SpectrumRenderOptions = {
  minDb: -110,
  maxDb: -20,
  selectedDeviceId: null,
  devices: [],
  peakHoldDecay: 0.014,
  showPeakHold: true,
  showAverage: false,
  zoomSelection: null,
  cursorMhz: null,
}

/**
 * Modern RF coordination spectrum view:
 * filled live area, crisp line, clean grid, channel markers.
 */
export class SpectrumRenderer {
  private options: SpectrumRenderOptions = { ...DEFAULT_OPTIONS }
  private peakHold: Float32Array | null = null
  private average: Float32Array | null = null
  private avgInit = false

  setOptions(partial: Partial<SpectrumRenderOptions>): void {
    this.options = { ...this.options, ...partial }
  }

  resetTraces(): void {
    this.peakHold = null
    this.average = null
    this.avgInit = false
  }

  draw(
    ctx: CanvasRenderingContext2D,
    frame: SpectrumFrame,
    width: number,
    height: number,
  ): void {
    const dpr = window.devicePixelRatio || 1
    const w = width
    const h = height
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pad = SPECTRUM_PAD
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom
    if (plotW <= 0 || plotH <= 0) return

    this.updateHolds(frame)

    // Panel
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    // Plot well
    ctx.fillStyle = '#121820'
    ctx.fillRect(pad.left, pad.top, plotW, plotH)

    this.drawGrid(ctx, pad.left, pad.top, plotW, plotH, frame)

    if (this.options.showPeakHold && this.peakHold) {
      this.drawFilledTrace(
        ctx,
        pad.left,
        pad.top,
        plotW,
        plotH,
        this.peakHold,
        'rgba(168, 85, 247, 0.08)',
        'rgba(192, 132, 252, 0.55)',
        1,
      )
    }

    // Live filled spectrum
    this.drawFilledTrace(
      ctx,
      pad.left,
      pad.top,
      plotW,
      plotH,
      frame.powerDb,
      null,
      '#5eead4',
      1.75,
      true,
    )

    this.drawNoiseFloorHint(ctx, pad.left, pad.top, plotW, plotH, frame)
    this.drawMarkers(ctx, pad.left, pad.top, plotW, plotH, frame)
    this.drawZoomSelection(ctx, pad.left, pad.top, plotW, plotH)
    this.drawCursor(ctx, pad.left, pad.top, plotW, plotH, frame)
    this.drawAxisLabels(ctx, pad.left, pad.top, plotW, plotH, frame)
    this.drawHud(ctx, pad.left, pad.top, plotW, frame)
  }

  hitTestDevice(
    x: number,
    width: number,
    frame: SpectrumFrame,
    devices: RfDevice[],
  ): RfDevice | null {
    const padLeft = SPECTRUM_PAD.left
    const padRight = SPECTRUM_PAD.right
    const plotW = width - padLeft - padRight
    if (plotW <= 0) return null

    let best: RfDevice | null = null
    let bestDist = 18

    for (const device of devices) {
      if (!device.enabled) continue
      if (
        device.frequencyMhz < frame.startFrequencyMhz ||
        device.frequencyMhz > frame.endFrequencyMhz
      ) {
        continue
      }
      const t =
        (device.frequencyMhz - frame.startFrequencyMhz) /
        (frame.endFrequencyMhz - frame.startFrequencyMhz)
      const mx = padLeft + t * plotW
      const dist = Math.abs(x - mx)
      if (dist < bestDist) {
        bestDist = dist
        best = device
      }
    }
    return best
  }

  private updateHolds(frame: SpectrumFrame): void {
    const n = frame.powerDb.length
    if (!this.peakHold || this.peakHold.length !== n) {
      this.peakHold = new Float32Array(frame.powerDb)
      this.average = new Float32Array(frame.powerDb)
      this.avgInit = true
      return
    }

    const decay = this.options.peakHoldDecay
    for (let i = 0; i < n; i++) {
      const v = frame.powerDb[i] ?? -160
      const hold = this.peakHold[i] ?? v
      this.peakHold[i] = v > hold ? v : hold - (hold - (this.options.minDb - 5)) * decay

      if (this.average) {
        const a = this.avgInit ? (this.average[i] ?? v) : v
        this.average[i] = a * 0.9 + v * 0.1
      }
    }
    this.avgInit = true
  }

  private dbToY(db: number, y: number, h: number): number {
    const { minDb, maxDb } = this.options
    const t = (db - minDb) / (maxDb - minDb)
    return y + h - Math.max(0, Math.min(1, t)) * h
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    frame: SpectrumFrame,
  ): void {
    const { minDb, maxDb } = this.options
    const dbSpan = maxDb - minDb
    const majorDb = 10
    const span = frame.endFrequencyMhz - frame.startFrequencyMhz
    const majorMhz = span > 150 ? 50 : span > 60 ? 20 : span > 20 ? 10 : 5

    // Horizontal majors only — cleaner coordination UI
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1
    for (let db = Math.ceil(minDb / majorDb) * majorDb; db <= maxDb; db += majorDb) {
      const gy = y + ((maxDb - db) / dbSpan) * h
      ctx.beginPath()
      ctx.moveTo(x, gy)
      ctx.lineTo(x + w, gy)
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    for (
      let f = Math.ceil(frame.startFrequencyMhz / majorMhz) * majorMhz;
      f <= frame.endFrequencyMhz;
      f += majorMhz
    ) {
      const gx = x + ((f - frame.startFrequencyMhz) / span) * w
      ctx.beginPath()
      ctx.moveTo(gx, y)
      ctx.lineTo(gx, y + h)
      ctx.stroke()
    }

    // Left scale
    ctx.fillStyle = '#7a8799'
    ctx.font = '500 11px "IBM Plex Mono", monospace'
    ctx.textAlign = 'right'
    for (let db = Math.ceil(minDb / majorDb) * majorDb; db <= maxDb; db += majorDb) {
      const gy = y + ((maxDb - db) / dbSpan) * h
      ctx.fillText(`${db}`, x - 10, gy + 4)
    }

    ctx.save()
    ctx.translate(16, y + h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#5c6b7e'
    ctx.font = '10px "IBM Plex Sans", sans-serif'
    ctx.fillText('dB', 0, 0)
    ctx.restore()

    // Thin plot border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  }

  private drawFilledTrace(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    data: Float32Array,
    fillColor: string | null,
    strokeColor: string,
    lineWidth: number,
    gradientFill = false,
  ): void {
    const bins = data.length
    if (bins < 2) return

    const { minDb } = this.options
    const bottom = this.dbToY(minDb, y, h)

    ctx.beginPath()
    for (let i = 0; i < bins; i++) {
      const px = x + (i / (bins - 1)) * w
      const py = this.dbToY(data[i] ?? minDb, y, h)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }

    if (gradientFill || fillColor) {
      ctx.lineTo(x + w, bottom)
      ctx.lineTo(x, bottom)
      ctx.closePath()

      if (gradientFill) {
        const g = ctx.createLinearGradient(0, y, 0, y + h)
        g.addColorStop(0, 'rgba(45, 212, 191, 0.45)')
        g.addColorStop(0.45, 'rgba(34, 211, 238, 0.18)')
        g.addColorStop(1, 'rgba(14, 165, 233, 0.02)')
        ctx.fillStyle = g
      } else if (fillColor) {
        ctx.fillStyle = fillColor
      }
      ctx.fill()

      // Re-stroke path only (outline)
      ctx.beginPath()
      for (let i = 0; i < bins; i++) {
        const px = x + (i / (bins - 1)) * w
        const py = this.dbToY(data[i] ?? minDb, y, h)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
    }

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = lineWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  private drawNoiseFloorHint(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    frame: SpectrumFrame,
  ): void {
    // Estimate noise from lower percentiles of bins
    const sorted = Array.from(frame.powerDb).sort((a, b) => a - b)
    const idx = Math.floor(sorted.length * 0.15)
    const noise = sorted[idx] ?? -95
    const gy = this.dbToY(noise, y, h)

    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, gy)
    ctx.lineTo(x + w, gy)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)'
    ctx.font = '10px "IBM Plex Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`PR ${noise.toFixed(0)}`, x + 6, gy - 4)
  }

  private drawMarkers(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    frame: SpectrumFrame,
  ): void {
    const { devices, selectedDeviceId } = this.options
    const span = frame.endFrequencyMhz - frame.startFrequencyMhz
    if (span <= 0) return

    // Stagger labels when devices are close
    const positions: { device: RfDevice; mx: number; lane: number }[] = []
    for (const device of devices) {
      if (!device.enabled) continue
      if (
        device.frequencyMhz < frame.startFrequencyMhz ||
        device.frequencyMhz > frame.endFrequencyMhz
      ) {
        continue
      }
      const t = (device.frequencyMhz - frame.startFrequencyMhz) / span
      const mx = x + t * w
      let lane = 0
      for (const p of positions) {
        if (Math.abs(p.mx - mx) < 72) lane = Math.max(lane, p.lane + 1)
      }
      positions.push({ device, mx, lane: Math.min(lane, 2) })
    }

    for (const { device, mx, lane } of positions) {
      const selected = device.id === selectedDeviceId
      const color = selected ? '#f472b6' : '#fb923c'

      ctx.fillStyle = selected ? 'rgba(244, 114, 182, 0.12)' : 'rgba(251, 146, 60, 0.08)'
      ctx.fillRect(mx - 4, y, 8, h)

      ctx.strokeStyle = color
      ctx.lineWidth = selected ? 2.25 : 1.5
      ctx.beginPath()
      ctx.moveTo(mx, y)
      ctx.lineTo(mx, y + h)
      ctx.stroke()

      // Diamond at peak area mid-height
      const dy = y + h * 0.22
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(mx, dy - 6)
      ctx.lineTo(mx + 5, dy)
      ctx.lineTo(mx, dy + 6)
      ctx.lineTo(mx - 5, dy)
      ctx.closePath()
      ctx.fill()

      const name = device.name
      const freq = `${device.frequencyMhz.toFixed(3)}`
      ctx.font = '600 11px "IBM Plex Sans", sans-serif'
      const nameW = ctx.measureText(name).width
      ctx.font = '500 10px "IBM Plex Mono", monospace'
      const freqW = ctx.measureText(freq).width
      const pw = Math.max(nameW, freqW) + 16
      const ph = 32
      const px = Math.max(x, Math.min(x + w - pw, mx - pw / 2))
      const py = y - 34 - lane * 34

      ctx.fillStyle = selected ? 'rgba(244, 114, 182, 0.95)' : 'rgba(15, 23, 42, 0.92)'
      roundRect(ctx, px, py, pw, ph, 8)
      ctx.fill()
      if (!selected) {
        ctx.strokeStyle = color
        ctx.lineWidth = 1.25
        roundRect(ctx, px, py, pw, ph, 8)
        ctx.stroke()
      }

      // Connector from pill to marker line
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(mx, py + ph)
      ctx.lineTo(mx, y)
      ctx.stroke()

      ctx.textAlign = 'center'
      ctx.font = '600 11px "IBM Plex Sans", sans-serif'
      ctx.fillStyle = selected ? '#0f172a' : '#fdba74'
      ctx.fillText(name, px + pw / 2, py + 13)
      ctx.font = '500 10px "IBM Plex Mono", monospace'
      ctx.fillStyle = selected ? '#0f172a' : '#5eead4'
      ctx.fillText(freq, px + pw / 2, py + 26)
    }
  }

  private drawZoomSelection(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const sel = this.options.zoomSelection
    if (!sel) return
    const x0 = Math.max(x, Math.min(x + w, Math.min(sel.x0, sel.x1)))
    const x1 = Math.max(x, Math.min(x + w, Math.max(sel.x0, sel.x1)))
    if (x1 - x0 < 2) return

    ctx.fillStyle = 'rgba(94, 234, 212, 0.12)'
    ctx.fillRect(x0, y, x1 - x0, h)
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.85)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1)
  }

  private drawCursor(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    frame: SpectrumFrame,
  ): void {
    const cursor = this.options.cursorMhz
    if (cursor == null) return
    if (cursor < frame.startFrequencyMhz || cursor > frame.endFrequencyMhz) return
    const span = frame.endFrequencyMhz - frame.startFrequencyMhz
    const mx = x + ((cursor - frame.startFrequencyMhz) / span) * w

    ctx.setLineDash([3, 3])
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(mx, y)
    ctx.lineTo(mx, y + h)
    ctx.stroke()
    ctx.setLineDash([])

    const label = `${cursor.toFixed(3)} MHz`
    ctx.font = '500 10px "IBM Plex Mono", monospace'
    const tw = ctx.measureText(label).width
    const lx = Math.max(x, Math.min(x + w - tw - 10, mx + 8))
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
    roundRect(ctx, lx, y + 6, tw + 10, 16, 4)
    ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.textAlign = 'left'
    ctx.fillText(label, lx + 5, y + 17)
  }

  private drawAxisLabels(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    frame: SpectrumFrame,
  ): void {
    const span = frame.endFrequencyMhz - frame.startFrequencyMhz
    const majorMhz = span > 150 ? 50 : span > 60 ? 20 : span > 20 ? 10 : 5

    ctx.fillStyle = '#7a8799'
    ctx.font = '500 11px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'

    for (
      let f = Math.ceil(frame.startFrequencyMhz / majorMhz) * majorMhz;
      f <= frame.endFrequencyMhz;
      f += majorMhz
    ) {
      const gx = x + ((f - frame.startFrequencyMhz) / span) * w
      // Tick
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.beginPath()
      ctx.moveTo(gx, y + h)
      ctx.lineTo(gx, y + h + 5)
      ctx.stroke()
      ctx.fillText(f.toFixed(0), gx, y + h + 20)
    }

    ctx.fillStyle = '#5c6b7e'
    ctx.font = '10px "IBM Plex Sans", sans-serif'
    ctx.fillText('Frecuencia (MHz)', x + w / 2, y + h + 36)
  }

  private drawHud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    frame: SpectrumFrame,
  ): void {
    const span = frame.endFrequencyMhz - frame.startFrequencyMhz
    const rbwApprox = (span / frame.powerDb.length) * 1000

    // Legend chips
    drawChip(ctx, x, y - 28, 'VIVO', '#5eead4', '#0f172a')
    drawChip(ctx, x + 58, y - 28, 'MÁX', '#c084fc', '#0f172a')

    ctx.textAlign = 'right'
    ctx.font = '11px "IBM Plex Mono", monospace'
    ctx.fillStyle = '#7a8799'
    ctx.fillText(
      `${frame.startFrequencyMhz.toFixed(1)}–${frame.endFrequencyMhz.toFixed(1)} MHz  ·  ANCHO ${span.toFixed(span < 30 ? 2 : 0)}  ·  ~${rbwApprox.toFixed(0)} kHz`,
      x + w,
      y - 14,
    )
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  accent: string,
  bg: string,
): void {
  ctx.font = '600 9px "IBM Plex Mono", monospace'
  const tw = ctx.measureText(label).width
  ctx.fillStyle = bg
  roundRect(ctx, x, y, tw + 18, 16, 4)
  ctx.fill()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(x + 8, y + 8, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.textAlign = 'left'
  ctx.fillText(label, x + 14, y + 11)
}
