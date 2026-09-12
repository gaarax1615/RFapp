import { Link } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { useEventRescan } from '@/modules/scan/useEventRescan'
import { MonitorCard } from './MonitorCard'

export function MonitorPage() {
  const devices = useAppStore((s) => s.devices)
  const metrics = useAppStore((s) => s.metrics)
  const alerts = useAppStore((s) => s.alerts)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)
  const { busy, message, error, rescanAll, rescanOne } = useEventRescan()

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
          Métricas en vivo · {enabled.length} activos. Verde = sin interferencia.
          Si uno se corta, reescanea ese; si fallan varios, todos.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={rescanAll}
            className="rounded-md border border-zinc-400/40 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-400/10"
          >
            Reescanear todos
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        {message ? <p className="mt-2 text-sm text-zinc-200">{message}</p> : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {enabled.map((device) => (
          <div key={device.id} className="flex flex-col gap-1.5">
            <MonitorCard
              device={device}
              metrics={metricsById.get(device.id)}
              alerts={alerts}
              onSelect={setSelectedDeviceId}
            />
            <button
              type="button"
              onClick={() => void rescanOne(device)}
              disabled={busy}
              className="rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-zinc-400/40 hover:text-zinc-200 disabled:opacity-40"
            >
              {busy ? 'Reescaneando…' : 'Reescanear solo este'}
            </button>
          </div>
        ))}
      </div>

      {enabled.length === 0 ? (
        <p className="rounded-lg border border-dashed border-rf-border p-8 text-center text-sm text-rf-muted">
          No hay dispositivos habilitados.{' '}
          <Link to="/" className="text-zinc-300 hover:underline">
            Agregar en el Panel
          </Link>
          {' · '}
          <Link to="/devices" className="text-zinc-300 hover:underline">
            Dispositivos
          </Link>
        </p>
      ) : null}
    </div>
  )
}
