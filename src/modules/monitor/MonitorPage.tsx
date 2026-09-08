import { Link } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { MonitorCard } from './MonitorCard'

export function MonitorPage() {
  const devices = useAppStore((s) => s.devices)
  const metrics = useAppStore((s) => s.metrics)
  const alerts = useAppStore((s) => s.alerts)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)

  const enabled = devices.filter((d) => d.enabled)
  const metricsById = new Map(metrics.map((m) => [m.deviceId, m]))

  return (
    <div className="flex flex-col gap-6 p-5 md:p-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] text-rf-muted uppercase">
          Canales en vivo
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Monitor</h2>
        <p className="mt-1 text-sm text-rf-muted">
          Métricas en vivo · {enabled.length} activos
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {enabled.map((device) => (
          <MonitorCard
            key={device.id}
            device={device}
            metrics={metricsById.get(device.id)}
            alerts={alerts}
            onSelect={setSelectedDeviceId}
          />
        ))}
      </div>

      {enabled.length === 0 ? (
        <p className="rounded-lg border border-dashed border-rf-border p-8 text-center text-sm text-rf-muted">
          No hay dispositivos habilitados.{' '}
          <Link to="/" className="text-teal-300 hover:underline">
            Agregar en el Panel
          </Link>
          {' · '}
          <Link to="/devices" className="text-teal-300 hover:underline">
            Dispositivos
          </Link>
        </p>
      ) : null}
    </div>
  )
}
