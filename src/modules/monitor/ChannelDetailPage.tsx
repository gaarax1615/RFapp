import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz } from '@/utils/constants'
import { HistoryChart, LevelRow, MiniSpectrum } from './channelMonitorWidgets'

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
