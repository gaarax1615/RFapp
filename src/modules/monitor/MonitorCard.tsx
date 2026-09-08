import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz } from '@/utils/constants'
import { deviceTypeLabel } from '@/utils/i18n'
import type { RfDevice } from '@/types/device'
import type { ChannelMetrics } from '@/types/monitor'
import type { RfAlert } from '@/types/alerts'

interface MonitorCardProps {
  device: RfDevice
  metrics?: ChannelMetrics
  alerts?: RfAlert[]
  onSelect?: (deviceId: string) => void
  compact?: boolean
}

export function MonitorCard({
  device,
  metrics,
  alerts = [],
  onSelect,
  compact = false,
}: MonitorCardProps) {
  const deviceAlerts = alerts
    .filter((a) => a.deviceId === device.id)
    .slice(0, compact ? 2 : 3)

  const worst = worstSeverity(deviceAlerts)
  const borderClass =
    worst === 'critical'
      ? 'border-red-400/50 hover:border-red-400/70'
      : worst === 'warning'
        ? 'border-amber-400/45 hover:border-amber-400/65'
        : 'border-rf-border hover:border-teal-400/40'

  return (
    <Link
      to={`/monitor/${device.id}`}
      onClick={() => onSelect?.(device.id)}
      className={[
        'rounded-lg border bg-rf-panel transition-colors hover:bg-rf-elevated',
        borderClass,
        compact ? 'p-3' : 'p-4',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-wider text-rf-muted uppercase">
            {device.channel || '—'}
          </p>
          <h3
            className={[
              'truncate font-semibold tracking-tight',
              compact ? 'text-base' : 'text-lg',
            ].join(' ')}
          >
            {device.name}
          </h3>
        </div>
        {metrics ? (
          <StatusBadge kind="signal" value={metrics.status} />
        ) : (
          <span className="text-xs text-rf-muted">…</span>
        )}
      </div>

      <p
        className={[
          'mt-2 font-mono font-semibold text-teal-300',
          compact ? 'text-xl' : 'text-2xl',
        ].join(' ')}
      >
        {formatFrequencyMhz(device.frequencyMhz)}
      </p>

      <dl className={`mt-3 grid grid-cols-2 gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <Metric label="Señal" value={metrics ? formatDbm(metrics.signalDbm) : '—'} />
        <Metric label="Ruido" value={metrics ? formatDbm(metrics.noiseFloorDbm) : '—'} />
        <Metric label="SNR" value={metrics ? `${metrics.snrDb.toFixed(0)} dB` : '—'} />
        <Metric label="Tipo" value={deviceTypeLabel(device.type)} />
      </dl>

      {metrics ? <SignalBar metrics={metrics} compact={compact} /> : null}

      <div className={compact ? 'mt-3' : 'mt-4'}>
        <p className="mb-1.5 font-mono text-[10px] tracking-wider text-rf-muted uppercase">
          Alertas
          {deviceAlerts.length > 0 ? (
            <span className="ml-1 text-amber-400/90">({deviceAlerts.length})</span>
          ) : null}
        </p>
        {deviceAlerts.length === 0 ? (
          <p className="rounded-md border border-white/5 bg-rf-bg/60 px-2 py-1.5 text-[11px] text-rf-muted">
            Sin alertas
          </p>
        ) : (
          <ul className="space-y-1">
            {deviceAlerts.map((alert) => (
              <li
                key={alert.id}
                className={[
                  'rounded-md border px-2 py-1.5',
                  alert.severity === 'critical'
                    ? 'border-red-400/30 bg-red-500/10'
                    : alert.severity === 'warning'
                      ? 'border-amber-400/30 bg-amber-500/10'
                      : 'border-sky-400/25 bg-sky-500/10',
                ].join(' ')}
              >
                <div className="mb-0.5 flex items-center gap-1.5">
                  <StatusBadge kind="alert" value={alert.severity} />
                  <span className="font-mono text-[9px] text-rf-muted">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p
                  className={[
                    'text-rf-text',
                    compact ? 'line-clamp-2 text-[11px]' : 'text-xs',
                  ].join(' ')}
                >
                  {alert.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  )
}

function worstSeverity(alerts: RfAlert[]): 'critical' | 'warning' | 'info' | null {
  if (alerts.some((a) => a.severity === 'critical')) return 'critical'
  if (alerts.some((a) => a.severity === 'warning')) return 'warning'
  if (alerts.length > 0) return 'info'
  return null
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wider text-rf-muted uppercase">{label}</dt>
      <dd className="font-mono text-rf-text">{value}</dd>
    </div>
  )
}

function SignalBar({
  metrics,
  compact,
}: {
  metrics: ChannelMetrics
  compact?: boolean
}) {
  const level = Math.max(0, Math.min(1, (metrics.signalDbm + 90) / 50))
  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <div className="mb-1 flex justify-between text-[10px] text-rf-muted">
        <span>RF</span>
        <span className="font-mono">{formatDbm(metrics.signalDbm)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-rf-bg">
        <div
          className="h-full rounded bg-teal-400 transition-[width] duration-300"
          style={{ width: `${level * 100}%` }}
        />
      </div>
    </div>
  )
}

function formatDbm(v: number): string {
  return `${v.toFixed(0)} dBm`
}
