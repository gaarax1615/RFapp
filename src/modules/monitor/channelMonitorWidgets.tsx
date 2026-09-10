import { useEffect, useMemo, useRef } from 'react'
import type { SpectrumFrame } from '@/types/spectrum'

export function LevelRow({
  label,
  value,
  ratio,
  color,
}: {
  label: string
  value: string
  ratio: number
  color: string
}) {
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%`
  return (
    <div>
      <div className="mb-1 flex items-end justify-between">
        <span className="text-xs tracking-wider text-rf-muted uppercase">{label}</span>
        <span className="font-mono text-sm font-semibold">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded bg-rf-bg">
        <div className={`h-full rounded ${color}`} style={{ width }} />
      </div>
    </div>
  )
}

export function MiniSpectrum({
  centerMhz,
  spectrumService,
}: {
  centerMhz: number
  spectrumService: { subscribe: (cb: (f: SpectrumFrame) => void) => () => void }
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    return spectrumService.subscribe((frame) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      drawMini(ctx, canvas, frame, centerMhz)
    })
  }, [spectrumService, centerMhz])

  return (
    <canvas
      ref={canvasRef}
      className="h-24 w-full rounded bg-rf-bg"
      width={640}
      height={96}
    />
  )
}

function drawMini(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  frame: SpectrumFrame,
  centerMhz: number,
): void {
  const w = canvas.width
  const h = canvas.height
  ctx.fillStyle = '#0b0e12'
  ctx.fillRect(0, 0, w, h)

  const half = 1
  const start = centerMhz - half
  const end = centerMhz + half
  const minDb = -110
  const maxDb = -20

  ctx.strokeStyle = '#3ecfcf'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  let started = false
  for (let i = 0; i < frame.powerDb.length; i++) {
    const freq = frame.startFrequencyMhz + i * frame.binWidthMhz
    if (freq < start || freq > end) continue
    const x = ((freq - start) / (end - start)) * w
    const t = ((frame.powerDb[i] ?? minDb) - minDb) / (maxDb - minDb)
    const y = h - Math.max(0, Math.min(1, t)) * h
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  const cx = ((centerMhz - start) / (end - start)) * w
  ctx.strokeStyle = 'rgba(232, 168, 56, 0.8)'
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, h)
  ctx.stroke()
  ctx.setLineDash([])
}

export function HistoryChart({ values }: { values: number[] }) {
  const path = useMemo(() => {
    if (values.length < 2) return ''
    const min = Math.min(...values, -90)
    const max = Math.max(...values, -40)
    const w = 100
    const h = 40
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w
        const y = h - ((v - min) / (max - min || 1)) * h
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }, [values])

  return (
    <div className="h-24 rounded bg-rf-bg p-2">
      {values.length < 2 ? (
        <p className="flex h-full items-center justify-center text-xs text-rf-muted">
          Acumulando historial…
        </p>
      ) : (
        <svg viewBox="0 0 100 40" className="h-full w-full" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="#3ecfcf" strokeWidth="1.2" />
        </svg>
      )}
    </div>
  )
}
