import { Link } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz } from '@/utils/constants'
import { deviceTypeLabel } from '@/utils/i18n'
import { SpectrumAnalyzer } from './SpectrumAnalyzer'

export function SpectrumPage() {
  const services = useServices()
  const devices = useAppStore((s) => s.devices)
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId)
  const hardwareStatus = useAppStore((s) => s.hardwareStatus)
  const spectrumRange = useAppStore((s) => s.spectrumRange)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)

  const selected = devices.find((d) => d.id === selectedDeviceId) ?? null
  const enabled = devices.filter((d) => d.enabled)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-rf-muted uppercase">
            Analizador RF
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">Espectro</h2>
          <p className="mt-1 text-sm text-rf-muted">
            {formatFrequencyMhz(spectrumRange.startMhz, 0)} –{' '}
            {formatFrequencyMhz(spectrumRange.endMhz, 0)} ·{' '}
            {services.spectrum.getSourceLabel()} · {enabled.length} marcadores
          </p>
        </div>
        <StatusBadge kind="hardware" value={hardwareStatus.state} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-[420px] min-w-0 flex-1 flex-col">
          <SpectrumAnalyzer showWaterfall />
        </div>

        <aside className="w-full shrink-0 rounded-lg border border-rf-border bg-rf-panel p-4 lg:w-72">
          <h3 className="text-xs font-semibold tracking-wider text-rf-muted uppercase">
            Selección
          </h3>
          {selected ? (
            <div className="mt-3 space-y-3">
              <p className="text-lg font-semibold">{selected.name}</p>
              <dl className="space-y-2 font-mono text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-rf-muted">Canal</dt>
                  <dd>{selected.channel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-rf-muted">Frec.</dt>
                  <dd className="text-rf-cyan">
                    {formatFrequencyMhz(selected.frequencyMhz)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-rf-muted">Tipo</dt>
                  <dd>{deviceTypeLabel(selected.type)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-rf-muted">Marca</dt>
                  <dd>
                    {selected.brand} {selected.model}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to={`/monitor/${selected.id}`}
                  className="rounded-md bg-rf-cyan/15 px-3 py-2 text-center text-sm font-medium text-rf-cyan hover:bg-rf-cyan/25"
                >
                  Abrir detalle del canal
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedDeviceId(null)}
                  className="rounded-md border border-rf-border px-3 py-2 text-sm text-rf-muted hover:text-rf-text"
                >
                  Quitar selección
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-rf-muted">
              Haz clic en un marcador del espectro para seleccionar un dispositivo.
            </p>
          )}

          <div className="mt-6 border-t border-rf-border pt-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-rf-muted uppercase">
              Marcadores
            </h3>
            <ul className="max-h-48 space-y-1 overflow-auto">
              {enabled.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedDeviceId(d.id)}
                    className={[
                      'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm',
                      d.id === selectedDeviceId
                        ? 'bg-rf-elevated text-rf-cyan'
                        : 'text-rf-text hover:bg-rf-elevated/60',
                    ].join(' ')}
                  >
                    <span className="truncate">{d.name}</span>
                    <span className="font-mono text-[11px] text-rf-muted">
                      {d.frequencyMhz.toFixed(1)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
