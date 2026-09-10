import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { SpectrumAnalyzer } from '@/modules/spectrum/SpectrumAnalyzer'
import { MiniMonitorCard } from '@/modules/monitor/MonitorCard'
import { ChannelMonitorPopup } from '@/modules/monitor/ChannelMonitorPopup'

export function DashboardPage() {
  const devices = useAppStore((s) => s.devices)
  const metrics = useAppStore((s) => s.metrics)
  const alerts = useAppStore((s) => s.alerts)
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)
  const [popupId, setPopupId] = useState<string | null>(null)

  const enabled = devices.filter((d) => d.enabled)
  const metricsById = new Map(metrics.map((m) => [m.deviceId, m]))
  const popupDevice = enabled.find((d) => d.id === popupId) ?? null

  const onCardSelect = (id: string) => {
    setSelectedDeviceId(id)
    setPopupId(id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3 md:p-5">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]">
        <SpectrumAnalyzer showWaterfall solo />
      </section>

      <section className="shrink-0">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide">
            Monitor
            <span className="ml-2 font-mono text-xs font-normal text-rf-muted">
              {enabled.length} activos
            </span>
          </h3>
          <Link to="/monitor" className="text-xs text-teal-300 hover:underline">
            Vista completa
          </Link>
        </div>

        {enabled.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-sm text-rf-muted">
            No hay dispositivos activos.{' '}
            <Link to="/devices" className="text-teal-300 hover:underline">
              Agrégalos en Dispositivos
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
      </section>

      {popupDevice ? (
        <ChannelMonitorPopup
          device={popupDevice}
          metrics={metricsById.get(popupDevice.id)}
          alerts={alerts}
          onClose={() => setPopupId(null)}
        />
      ) : null}
    </div>
  )
}
