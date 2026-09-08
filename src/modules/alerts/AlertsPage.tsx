import { Link } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz } from '@/utils/constants'

export function AlertsPage() {
  const { alerts: alertService } = useServices()
  const alerts = useAppStore((s) => s.alerts)
  const devices = useAppStore((s) => s.devices)

  const deviceName = (id?: string) =>
    id ? (devices.find((d) => d.id === id)?.name ?? id) : null

  return (
    <div className="flex flex-col gap-6 p-5 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-rf-muted uppercase">
            Sistema de alertas
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Alertas</h2>
          <p className="mt-1 text-sm text-rf-muted">
            Interferencias, ruido y caídas generadas desde métricas simuladas
          </p>
        </div>
        <button
          type="button"
          onClick={() => alertService.clear()}
          className="rounded-md border border-rf-border px-3 py-2 text-sm text-rf-muted hover:text-rf-text"
        >
          Borrar todas
        </button>
      </header>

      {alerts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rf-border p-10 text-center text-sm text-rf-muted">
          Sin alertas. El simulador generará eventos periódicamente.
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-rf-border bg-rf-panel px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <StatusBadge kind="alert" value={alert.severity} />
                  <span className="font-mono text-[11px] text-rf-muted">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                  {alert.frequencyMhz != null ? (
                    <span className="font-mono text-[11px] text-rf-cyan">
                      {formatFrequencyMhz(alert.frequencyMhz)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-rf-text">{alert.message}</p>
                {alert.deviceId ? (
                  <Link
                    to={`/monitor/${alert.deviceId}`}
                    className="mt-1 inline-block text-xs text-rf-cyan hover:underline"
                  >
                    {deviceName(alert.deviceId)} → detalle
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => alertService.dismiss(alert.id)}
                className="text-xs text-rf-muted hover:text-rf-text"
              >
                Descartar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
