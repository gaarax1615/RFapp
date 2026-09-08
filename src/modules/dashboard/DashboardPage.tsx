import { Link } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import { HardwareSourceSelector } from '@/components/hardware/HardwareSourceSelector'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz } from '@/utils/constants'
import { SpectrumAnalyzer } from '@/modules/spectrum/SpectrumAnalyzer'
import { QuickDeviceForm } from '@/modules/devices/QuickDeviceForm'
import { MonitorCard } from '@/modules/monitor/MonitorCard'

export function DashboardPage() {
  const services = useServices()
  const devices = useAppStore((s) => s.devices)
  const alerts = useAppStore((s) => s.alerts)
  const metrics = useAppStore((s) => s.metrics)
  const hardwareStatus = useAppStore((s) => s.hardwareStatus)
  const spectrumRange = useAppStore((s) => s.spectrumRange)
  const activeFrequencyCount = useAppStore((s) => s.activeFrequencyCount)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)

  const enabled = devices.filter((d) => d.enabled)
  const metricsById = new Map(metrics.map((m) => [m.deviceId, m]))
  const warningAlerts = alerts.filter(
    (a) => a.severity === 'warning' || a.severity === 'critical',
  ).length

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#121820] px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Panel</h2>
            <StatusBadge kind="hardware" value={hardwareStatus.state} />
          </div>
          <p className="mt-0.5 truncate text-xs text-rf-muted">
            {services.spectrum.getSourceLabel()} ·{' '}
            {formatFrequencyMhz(spectrumRange.startMhz, 0)}–
            {formatFrequencyMhz(spectrumRange.endMhz, 0)} · {enabled.length}{' '}
            dispositivos · {activeFrequencyCount} activos
            {warningAlerts > 0 ? ` · ${warningAlerts} alertas` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <HardwareSourceSelector compact />
          <Link
            to="/spectrum"
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-slate-300 hover:border-teal-400/40 hover:text-teal-300"
          >
            Espectro
          </Link>
          <Link
            to="/devices"
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-slate-300 hover:border-teal-400/40 hover:text-teal-300"
          >
            Dispositivos
          </Link>
          <Link
            to="/monitor"
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-slate-300 hover:border-teal-400/40 hover:text-teal-300"
          >
            Monitor
          </Link>
          <Link
            to="/alerts"
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-slate-300 hover:border-teal-400/40 hover:text-teal-300"
          >
            Alertas
          </Link>
        </div>
      </header>

      <section className="grid min-h-[380px] flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] p-2 md:p-3">
          <SpectrumAnalyzer showWaterfall={false} />
        </div>
        <QuickDeviceForm />
      </section>

      <section className="shrink-0">
        <div className="mb-2 flex items-center justify-between">
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
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-rf-muted">
            Agrega un dispositivo con el formulario de la derecha: aparecerá aquí y en el
            espectro.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {enabled.map((device) => (
              <MonitorCard
                key={device.id}
                device={device}
                metrics={metricsById.get(device.id)}
                alerts={alerts}
                onSelect={setSelectedDeviceId}
                compact
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
