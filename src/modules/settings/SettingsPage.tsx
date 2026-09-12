import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import { HardwareSourceSelector } from '@/components/hardware/HardwareSourceSelector'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz } from '@/utils/constants'
import { EventKitEditor } from '@/modules/scan/EventKitEditor'
import { kitSummaryLabel } from '@/modules/scan/eventKit'

const AUDIO_STATUS: Record<string, string> = {
  unavailable: 'no disponible',
  idle: 'en espera',
  listening: 'escuchando zona',
  error: 'error',
}

export function SettingsPage() {
  const { spectrum, audio, defaultSpectrumConfig } = useServices()
  const hardwareStatus = useAppStore((s) => s.hardwareStatus)
  const spectrumRange = useAppStore((s) => s.spectrumRange)
  const eventKitCatalogIds = useAppStore((s) => s.eventKitCatalogIds)

  return (
    <div className="flex flex-col gap-6 p-5 md:p-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] text-rf-muted uppercase">
          Configuración
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Ajustes</h2>
        <p className="mt-1 text-sm text-rf-muted">
          Equipos del evento, fuente SDR y rango
        </p>
      </header>

      <EventKitEditor />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-rf-border bg-rf-panel p-5">
          <h3 className="text-sm font-semibold">Fuente de espectro</h3>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge kind="hardware" value={hardwareStatus.state} />
            <span className="text-sm">{spectrum.getSourceLabel()}</span>
          </div>
          <p className="mt-2 text-sm text-rf-muted">{hardwareStatus.message}</p>
          <div className="mt-4">
            <HardwareSourceSelector />
          </div>
        </div>

        <div className="rounded-lg border border-rf-border bg-rf-panel p-5">
          <h3 className="text-sm font-semibold">Rango monitoreado</h3>
          <p className="mt-3 font-mono text-2xl text-rf-cyan">
            {formatFrequencyMhz(spectrumRange.startMhz, 0)} –{' '}
            {formatFrequencyMhz(spectrumRange.endMhz, 0)}
          </p>
          <p className="mt-2 text-xs text-rf-muted">
            Anclado al kit: {kitSummaryLabel(eventKitCatalogIds)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-rf-muted">Bins</dt>
              <dd className="font-mono">{defaultSpectrumConfig.binCount}</dd>
            </div>
            <div>
              <dt className="text-rf-muted">Tasa de actualización</dt>
              <dd className="font-mono">{defaultSpectrumConfig.updateRateHz} Hz</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-rf-muted">
            Un RTL-SDR ve ~2 MHz a la vez; la banda del kit se barre a saltos.
            Cambia mics/ears arriba para retunar.
          </p>
        </div>

        <div className="rounded-lg border border-rf-border bg-rf-panel p-5">
          <h3 className="text-sm font-semibold">Monitoreo de audio</h3>
          <p className="mt-2 text-sm text-rf-muted">
            {audio.getLabel()} · estado:{' '}
            {AUDIO_STATUS[audio.getStatus()] ?? audio.getStatus()}
          </p>
          <p className="mt-3 text-xs text-rf-muted">
            Con RTL-SDR activo: bloquea el RTA y haz clic o arrastra una zona.
            El dongle se sintoniza ahí y oyes NFM real.
          </p>
        </div>

        <div className="rounded-lg border border-rf-border bg-rf-panel p-5">
          <h3 className="text-sm font-semibold">Backend local (Python)</h3>
          <p className="mt-2 text-sm text-rf-muted">
            Sin empaquetar. Desde la raíz del proyecto:
          </p>
          <pre className="mt-3 overflow-auto rounded bg-rf-bg p-3 font-mono text-[11px] leading-relaxed text-rf-muted">
{`./start.sh

Frontend  Vite :5173
   └─ proxy /sdr-ws  →  Backend :8787
                          └─ RTL-SDR o espectro de prueba`}
          </pre>
          <p className="mt-3 text-xs text-rf-muted">
            Pulsa «Buscar de nuevo» cuando el servidor esté arriba. Reinicia el
            backend tras cambios de Python (tope de barrido 40 MHz).
          </p>
        </div>
      </section>
    </div>
  )
}
