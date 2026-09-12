import type { SpectrumFrame } from '@/types/spectrum'
import type { RfDevice } from '@/types/device'
import { SPECTRUM_DB, SPECTRUM_PAD, frequencyTickStepMhz } from './spectrumRange'

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
  /** Si false, el eje de MHz lo pinta un componente HTML compartido con la cascada. */
  showFrequencyAxis: boolean
  showHud: boolean
  listenBand: { startMhz: number; endMhz: number } | null
  listenDrag: { x0: number; x1: number } | null
}

const DEFAULT_OPTIONS: SpectrumRenderOptions = {
  minDb: SPECTRUM_DB.minDb,
  maxDb: SPECTRUM_DB.maxDb,
  selectedDeviceId: null,
  devices: [],
  peakHoldDecay: 0.022,
  showPeakHold: true,
  showAverage: false,
  zoomSelection: null,
  cursorMhz: null,
  showFrequencyAxis: true,
  showHud: true,
  listenBand: null,
  listenDrag: null,
}

/**
 * Analizador de espectro limpio: envolvente (peak-detect), traza fina y hold.
 */
export class SpectrumRenderer {
  private options: SpectrumRenderOptions = { ...DEFAULT_OPTIONS }
  private displayLive: Float32Array | null = null
  private displayHold: Float32Array | null = null
  private displayLen = 0

  setOptions(partial: Partial<SpectrumRenderOptions>): void {
    this.options = { ...this.options, ...partial }
  }

  resetTraces(): void {
    this.displayLive = null
    this.displayHold = null
    this.displayLen = 0
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

    // Panel
    ctx.fillStyle = '#050505'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#141414'
    ctx.fillRect(pad.left, pad.top, plotW, plotH)

    this.drawGrid(ctx, pad.left, pad.top, plotW, plotH, frame)
    this.drawCleanTrace(ctx, pad.left, pad.top, plotW, plotH, frame)
    this.drawMarkers(ctx, pad.left, pad.top, plotW, plotH, frame)
    this.drawListenBand(ctx, pad.left, pad.top, plotW, plotH, frame)
    this.drawZoomSelection(ctx, pad.left, pad.top, plotW, plotH)
    this.drawListenDrag(ctx, pad.left, pad.top, plotW, plotH)
    this.drawCursor(ctx, pad.left, pad.top, plotW, plotH, frame)
    if (this.options.showFrequencyAxis) {
      this.drawAxisLabels(ctx, pad.left, pad.top, plotW, plotH, frame)
    }
    if (this.options.showHud) {
      this.drawHud(ctx, pad.left, pad.top, plotW, frame)
    }
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

  private drawCleanTrace(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    frame: SpectrumFrame,
  ): void {
    const bins = frame.powerDb
    const n = bins.length
    if (n < 2 || w < 2) return

    const cols = Math.max(64, Math.floor(w))
    const { minDb, showPeakHold, peakHoldDecay } = this.options
    const bottom = this.dbToY(minDb, y, h)

    if (!this.displayLive || this.displayLen !== cols) {
      this.displayLive = new Float32Array(cols)
      this.displayHold = new Float32Array(cols)
      this.displayHold.fill(minDb)
      this.displayLen = cols
    }

    for (let c = 0; c < cols; c++) {
      const i0 = Math.floor((c / cols) * n)
      const i1 = Math.max(i0 + 1, Math.floor(((c + 1) / cols) * n))
      let peak = -160
      for (let i = i0; i < i1; i++) {
        const v = bins[i] ?? -160
        if (v > peak) peak = v
      }
      const prev = this.displayLive[c] ?? peak
      const live = prev * 0.62 + peak * 0.38
      this.displayLive[c] = live
      const hold = this.displayHold![c] ?? live
      this.displayHold![c] =
        live > hold ? live : hold - (hold - (minDb - 6)) * peakHoldDecay
    }

    if (showPeakHold && this.displayHold) {
      ctx.beginPath()
      for (let c = 0; c < cols; c++) {
        const px = x + (c / Math.max(1, cols - 1)) * w
        const py = this.dbToY(this.displayHold[c] ?? minDb, y, h)
        if (c === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    ctx.beginPath()
    for (let c = 0; c < cols; c++) {
      const px = x + (c / Math.max(1, cols - 1)) * w
      const py = this.dbToY(this.displayLive[c] ?? minDb, y, h)
      if (c === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.lineTo(x + w, bottom)
    ctx.lineTo(x, bottom)
    ctx.closePath()
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, 'rgba(45, 212, 191, 0.22)')
    g.addColorStop(0.55, 'rgba(45, 212, 191, 0.06)')
    g.addColorStop(1, 'rgba(45, 212, 191, 0)')
    ctx.fillStyle = g
    ctx.fill()

    ctx.beginPath()
    for (let c = 0; c < cols; c++) {
      const px = x + (c / Math.max(1, cols - 1)) * w
      const py = this.dbToY(this.displayLive[c] ?? minDb, y, h)
      if (c === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = '#f5f5f5'
    ctx.lineWidth = 1.4
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
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
    const majorMhz = frequencyTickStepMhz(span)

    // Horizontal majors only — cleaner coordination UI
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1
    for (let db = Math.ceil(minDb / majorDb) * majorDb; db <= maxDb; db += majorDb) {
      const gy = y + ((maxDb - db) / dbSpan) * h
      ctx.beginPath()
      ctx.moveTo(x, gy)
      ctx.lineTo(x + w, gy)
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
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
      ctx.fillText(`${db}`, x - 8, gy + 4)
    }

    // Thin plot border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
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

      ctx.strokeStyle = selected ? color : 'rgba(251, 146, 60, 0.55)'
      ctx.lineWidth = selected ? 1.5 : 1
      ctx.setLineDash(selected ? [] : [3, 4])
      ctx.beginPath()
      ctx.moveTo(mx, y)
      ctx.lineTo(mx, y + h)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(mx, y + 5, selected ? 3.5 : 2.5, 0, Math.PI * 2)
      ctx.fill()

      const name = device.name
      const freq = `${device.frequencyMhz.toFixed(3)}`
      ctx.font = '600 11px "IBM Plex Sans", sans-serif'
      const nameW = ctx.measureText(name).width
      ctx.font = '500 10px "IBM Plex Mono", monospace'
      const freqW = ctx.measureText(freq).width
      const pw = Math.max(nameW, freqW) + 20
      const ph = 40
      const gap = 10
      const topMargin = 14
      const px = Math.max(x, Math.min(x + w - pw, mx - pw / 2))
      const py = Math.max(topMargin, y - ph - gap - lane * (ph + 6))

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
      ctx.fillText(name, px + pw / 2, py + 15)
      ctx.font = '500 10px "IBM Plex Mono", monospace'
      ctx.fillStyle = selected ? '#050505' : '#f5f5f5'
      ctx.fillText(freq, px + pw / 2, py + 31)
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

    ctx.fillStyle = 'rgba(245, 245, 245, 0.12)'
    ctx.fillRect(x0, y, x1 - x0, h)
    ctx.strokeStyle = 'rgba(245, 245, 245, 0.85)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1)
  }

  private drawListenDrag(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const sel = this.options.listenDrag
    if (!sel) return
    const x0 = Math.max(x, Math.min(x + w, Math.min(sel.x0, sel.x1)))
    const x1 = Math.max(x, Math.min(x + w, Math.max(sel.x0, sel.x1)))
    if (x1 - x0 < 2) return

    ctx.fillStyle = 'rgba(251, 191, 36, 0.16)'
    ctx.fillRect(x0, y, x1 - x0, h)
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1)
  }

  private drawListenBand(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    frame: SpectrumFrame,
  ): void {
    const band = this.options.listenBand
    if (!band) return
    const span = frame.endFrequencyMhz - frame.startFrequencyMhz
    if (span <= 0) return
    const t0 = (band.startMhz - frame.startFrequencyMhz) / span
    const t1 = (band.endMhz - frame.startFrequencyMhz) / span
    const x0 = x + Math.max(0, Math.min(1, t0)) * w
    const x1 = x + Math.max(0, Math.min(1, t1)) * w
    if (x1 - x0 < 2) return

    ctx.fillStyle = 'rgba(251, 191, 36, 0.12)'
    ctx.fillRect(x0, y, x1 - x0, h)
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)'
    ctx.lineWidth = 1.75
    ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1)

    ctx.fillStyle = '#fbbf24'
    ctx.font = '600 10px "IBM Plex Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText('AUDIO', x0 + 6, y + 14)
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
    roundRect(ctx, lx, y + 10, tw + 10, 18, 4)
    ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.textAlign = 'left'
    ctx.fillText(label, lx + 5, y + 22)
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
    const majorMhz = frequencyTickStepMhz(span)

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
    drawChip(ctx, x, y - 28, 'VIVO', '#f5f5f5', '#050505')
    drawChip(ctx, x + 58, y - 28, 'PK', 'rgba(247, 244, 251, 0.75)', '#050505')

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
