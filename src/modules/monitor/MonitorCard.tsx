import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz } from '@/utils/constants'
import { formatDeviceChannel, formatStability } from '@/utils/i18n'
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
        : 'border-rf-border hover:border-zinc-400/40'

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
            {formatDeviceChannel(device.channel)}
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
          'mt-2 font-mono font-semibold text-zinc-300',
          compact ? 'text-xl' : 'text-2xl',
        ].join(' ')}
      >
        {formatFrequencyMhz(device.frequencyMhz)}
      </p>

      <dl className={`mt-3 grid grid-cols-2 gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <Metric label="Señal" value={metrics ? formatDbm(metrics.signalDbm) : '—'} />
        <Metric label="Ruido" value={metrics ? formatDbm(metrics.noiseFloorDbm) : '—'} />
        <Metric label="SNR" value={metrics ? `${metrics.snrDb.toFixed(0)} dB` : '—'} />
        <Metric
          label="Estabilidad"
          value={
            metrics
              ? formatStability(metrics.stabilityDb, metrics.sampleCount)
              : '—'
          }
        />
      </dl>

      {device.awaitingHardware && (!metrics || metrics.snrDb < 8) ? (
        <p className="mt-2 text-[11px] text-amber-200/90">
          Frecuencia nueva en el software. Gira el BLX a {formatDeviceChannel(device.channel)}.
        </p>
      ) : null}

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
                      : 'border-zinc-400/25 bg-zinc-500/10',
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
          className="h-full rounded bg-zinc-400 transition-[width] duration-300"
          style={{ width: `${level * 100}%` }}
        />
      </div>
    </div>
  )
}

function formatDbm(v: number): string {
  return `${v.toFixed(0)} dBm`
}

function barsFromMetrics(
  metrics?: ChannelMetrics,
  awaitingHardware?: boolean,
): {
  bars: number
  tone: string
  label: string
} {
  if (!metrics || metrics.sampleCount === 0) {
    return { bars: 0, tone: 'text-slate-500', label: 'Leyendo…' }
  }

  const snr = metrics.snrDb
  if (snr < 8) {
    return {
      bars: 0,
      tone: 'text-slate-500',
      label: awaitingHardware
        ? 'Pon este grupo/canal en el BLX'
        : 'Sin portadora',
    }
  }
  if (snr < 10 || metrics.status === 'INTERFERENCE') {
    return { bars: 1, tone: 'text-red-500', label: 'Sucia / débil' }
  }
  if (snr < 14 || metrics.status === 'WARNING') {
    return { bars: 2, tone: 'text-yellow-400', label: 'Regular' }
  }
  if (snr < 22) {
    return { bars: 3, tone: 'text-zinc-300', label: 'Buena' }
  }
  return { bars: 4, tone: 'text-white', label: 'Muy buena' }
}

function CellularSignalIcon({ bars }: { bars: number }) {
  const heights = [5, 8, 11, 14]
  return (
    <svg
      width="18"
      height="16"
      viewBox="0 0 18 16"
      fill="none"
      aria-hidden="true"
    >
      {heights.map((height, index) => (
        <rect
          key={index}
          x={index * 4.5}
          y={16 - height}
          width="3.2"
          height={height}
          rx="0.9"
          className={index < bars ? 'fill-current' : 'fill-current opacity-20'}
        />
      ))}
    </svg>
  )
}

/** Tarjeta compacta para el Panel: nombre + canal, frecuencia e icono de señal. */
export function MiniMonitorCard({
  device,
  metrics,
  selected = false,
  onSelect,
}: {
  device: RfDevice
  metrics?: ChannelMetrics
  selected?: boolean
  onSelect?: (deviceId: string) => void
}) {
  const signal = barsFromMetrics(metrics, device.awaitingHardware)
  const title = device.channel
    ? `${device.name} - ${formatDeviceChannel(device.channel)}`
    : device.name
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!selected) return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [selected])

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect?.(device.id)}
      title={`${title} · ${signal.label}. Enciende ese transmisor (guitarra, bajo, voz, acordeón…): verde = frecuencia buena.`}
      aria-pressed={selected}
      className={[
        'flex min-w-[9.5rem] max-w-[14rem] flex-1 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all duration-200',
        selected
          ? '-translate-y-1 scale-[1.06] z-10 border-orange-400 bg-orange-400/15 shadow-[0_8px_24px_rgba(251,146,60,0.35)] ring-2 ring-orange-400/80'
          : 'border-white/10 bg-[#141414] hover:border-zinc-400/40 hover:bg-[#1a1a1a]',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <p
          className={[
            'truncate text-[12px] font-semibold tracking-tight uppercase',
            selected ? 'text-orange-200' : 'text-slate-100',
          ].join(' ')}
        >
          {title}
        </p>
        <p
          className={[
            'mt-0.5 font-mono text-[11px]',
            selected ? 'text-orange-100' : 'text-zinc-300',
          ].join(' ')}
        >
          {formatFrequencyMhz(device.frequencyMhz)}
        </p>
        <p
          className={[
            'font-mono text-[10px]',
            selected ? 'text-orange-200/80' : 'text-slate-400',
          ].join(' ')}
        >
          {signal.label}
        </p>
      </div>
      <span
        className={['shrink-0', signal.tone].join(' ')}
        aria-label={`Señal ${signal.label}`}
      >
        <CellularSignalIcon bars={signal.bars} />
      </span>
    </button>
  )
}
