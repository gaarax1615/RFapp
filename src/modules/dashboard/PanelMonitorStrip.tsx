import { Link } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { MiniMonitorCard } from '@/modules/monitor/MonitorCard'
import { ChannelMonitorPopup } from '@/modules/monitor/ChannelMonitorPopup'
import { EventFlowSteps } from '@/modules/scan/EventFlowSteps'
import { useEventRescan } from '@/modules/scan/useEventRescan'

export function PanelMonitorStrip() {
  const devices = useAppStore((s) => s.devices)
  const metrics = useAppStore((s) => s.metrics)
  const alerts = useAppStore((s) => s.alerts)
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)

  const enabled = devices.filter((d) => d.enabled)
  const metricsById = new Map(metrics.map((m) => [m.deviceId, m]))
  const popupDevice = enabled.find((d) => d.id === selectedDeviceId) ?? null

  const { busy, message, error, rescanAll, rescanOne } = useEventRescan()

  const onCardSelect = (id: string) => {
    setSelectedDeviceId(id === selectedDeviceId ? null : id)
  }

  return (
    <section className="shrink-0">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide">
          Monitor
          <span className="ml-2 font-mono text-xs font-normal text-rf-muted">
            {enabled.length} activos
          </span>
        </h3>
        <div className="flex items-center gap-3">
          {enabled.length > 0 ? (
            <button
              type="button"
              onClick={rescanAll}
              className="font-mono text-[11px] text-zinc-300 hover:underline"
            >
              Reescanear todos
            </button>
          ) : null}
          <Link to="/monitor" className="text-xs text-zinc-300 hover:underline">
            Vista completa
          </Link>
        </div>
      </div>
      <div className="mb-1.5">
        <EventFlowSteps compact />
      </div>
      {error ? <p className="mb-1.5 text-[11px] text-red-400">{error}</p> : null}
      {message ? <p className="mb-1.5 text-[11px] text-zinc-200">{message}</p> : null}

      {enabled.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-sm text-rf-muted">
          No hay dispositivos activos.{' '}
          <Link to="/scan" className="text-zinc-300 hover:underline">
            Asígnalos en Escaneo
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {enabled.map((device) => (
            <MiniMonitorCard
              key={device.id}
              device={device}
              metrics={metricsById.get(device.id)}
              selected={device.id === selectedDeviceId}
              onSelect={onCardSelect}
            />
          ))}
        </div>
      )}

      {popupDevice ? (
        <ChannelMonitorPopup
          device={popupDevice}
          metrics={metricsById.get(popupDevice.id)}
          alerts={alerts}
          rescanBusy={busy}
          onRescan={() => void rescanOne(popupDevice)}
          onClose={() => setSelectedDeviceId(null)}
        />
      ) : null}
    </section>
  )
}
