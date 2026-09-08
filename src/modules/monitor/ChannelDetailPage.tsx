import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz } from '@/utils/constants'
import type { SpectrumFrame } from '@/types/spectrum'

export function ChannelDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const { monitor, spectrum, audio } = useServices()
  const devices = useAppStore((s) => s.devices)
  const metrics = useAppStore((s) => s.metrics)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)

  const device = devices.find((d) => d.id === deviceId)
  const metric = metrics.find((m) => m.deviceId === deviceId)
  const [history, setHistory] = useState<number[]>([])

  useEffect(() => {
    if (deviceId) setSelectedDeviceId(deviceId)
  }, [deviceId, setSelectedDeviceId])

  useEffect(() => {
    if (!deviceId) return
    let cancelled = false
    const tick = async () => {
      const values = await monitor.getHistory(deviceId, 60_000)
      if (!cancelled) setHistory(values)
    }
    void tick()
    const id = setInterval(() => void tick(), 500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [deviceId, monitor])

  if (!device) {
    return (
      <div className="p-8">
        <p className="text-rf-muted">Dispositivo no encontrado.</p>
        <Link to="/monitor" className="mt-2 inline-block text-rf-cyan">
          Volver al Monitor
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/monitor"
            className="font-mono text-[11px] tracking-wider text-rf-muted uppercase hover:text-rf-cyan"
          >
            ← Monitor
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <span className="font-mono text-rf-cyan">{device.channel}</span>
            <span className="mx-2 text-rf-muted">—</span>
            {device.name}
          </h2>
          <p className="mt-1 text-sm text-rf-muted">
            {device.brand} {device.model} · {device.type}
          </p>
        </div>
        {metric ? <StatusBadge kind="signal" value={metric.status} /> : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-rf-border bg-rf-panel p-5">
          <p className="text-[11px] tracking-wider text-rf-muted uppercase">
            Frecuencia
          </p>
          <p className="mt-2 font-mono text-4xl font-semibold text-rf-cyan md:text-5xl">
            {formatFrequencyMhz(device.frequencyMhz)}
          </p>

          <div className="mt-8 space-y-5">
            <LevelRow
              label="RF"
              value={metric ? `${metric.signalDbm.toFixed(0)} dBm` : '—'}
              ratio={metric ? (metric.signalDbm + 90) / 50 : 0}
              color="bg-rf-cyan"
            />
            <LevelRow
              label="Ruido"
              value={metric ? `${metric.noiseFloorDbm.toFixed(0)} dBm` : '—'}
              ratio={metric ? (metric.noiseFloorDbm + 100) / 40 : 0}
              color="bg-rf-amber"
            />
            <LevelRow
              label="SNR"
              value={metric ? `${metric.snrDb.toFixed(0)} dB` : '—'}
              ratio={metric ? metric.snrDb / 50 : 0}
              color="bg-emerald-400"
            />
          </div>

          <div className="mt-8 rounded-md border border-rf-border bg-rf-bg/60 p-3">
            <p className="text-[11px] tracking-wider text-rf-muted uppercase">
              Monitoreo de audio
            </p>
            <p className="mt-1 text-sm text-rf-muted">
              {audio.getLabel()} · {audio.getStatus()}
            </p>
            <p className="mt-2 text-xs text-rf-muted">
              Desacoplado del espectro. No disponible en Beta 1 (requiere
              hardware/API compatible — no asumimos demodulación SDR genérica).
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-rf-border bg-rf-panel p-4">
            <p className="mb-2 text-[11px] tracking-wider text-rf-muted uppercase">
              Mini espectro (±1 MHz)
            </p>
            <MiniSpectrum
              centerMhz={device.frequencyMhz}
              spectrumService={spectrum}
            />
          </div>
          <div className="rounded-lg border border-rf-border bg-rf-panel p-4">
            <p className="mb-2 text-[11px] tracking-wider text-rf-muted uppercase">
              Historial de señal (60 s)
            </p>
            <HistoryChart values={history} />
          </div>
        </div>
      </div>

      {device.notes ? (
        <p className="text-sm text-rf-muted">
          <span className="text-rf-text">Notas:</span> {device.notes}
        </p>
      ) : null}
    </div>
  )
}

function LevelRow({
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
        <span className="text-xs tracking-wider text-rf-muted uppercase">
          {label}
        </span>
        <span className="font-mono text-lg font-semibold">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded bg-rf-bg">
        <div className={`h-full rounded ${color}`} style={{ width }} />
      </div>
    </div>
  )
}

function MiniSpectrum({
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
      className="h-28 w-full rounded bg-rf-bg"
      width={640}
      height={112}
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

function HistoryChart({ values }: { values: number[] }) {
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
    <div className="h-28 rounded bg-rf-bg p-2">
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
