import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import { HardwareSourceSelector } from '@/components/hardware/HardwareSourceSelector'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz } from '@/utils/constants'

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

  return (
    <div className="flex flex-col gap-6 p-5 md:p-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] text-rf-muted uppercase">
          Configuración
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Ajustes</h2>
        <p className="mt-1 text-sm text-rf-muted">
          Fuente de datos, rango y preparación de red local / Tauri
        </p>
      </header>

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
            Nota: un RTL-SDR típico cubre ~2.4 MHz útiles; barrer esta ventana
            completa requerirá barrido o un SDR de mayor ancho de banda.
          </p>
        </div>

        <div className="rounded-lg border border-rf-border bg-rf-panel p-5">
          <h3 className="text-sm font-semibold">Monitoreo de audio</h3>
          <p className="mt-2 text-sm text-rf-muted">
            {audio.getLabel()} · estado:{' '}
            {AUDIO_STATUS[audio.getStatus()] ?? audio.getStatus()}
          </p>
          <p className="mt-3 text-xs text-rf-muted">
            Interfaz de audio lista: con el RTA bloqueado, arrastra una zona para
            escucharla (sonorización de la energía RF). La demodulación real
            llegará con hardware SDR; no se asume que un SDR demodule sistemas
            digitales propietarios.
          </p>
        </div>

        <div className="rounded-lg border border-rf-border bg-rf-panel p-5">
          <h3 className="text-sm font-semibold">Red local / iPad</h3>
          <p className="mt-2 text-sm text-rf-muted">
            Diseño sin internet ni nube. Flujo previsto:
          </p>
          <pre className="mt-3 overflow-auto rounded bg-rf-bg p-3 font-mono text-[11px] leading-relaxed text-rf-muted">
{`Mac (Tauri)
 └─ RF Monitor + servidor HTTP/WS
      ├─ Safari iPad  → http://mac.local:8787
      └─ Fuente remota (frames por WS)`}
          </pre>
          <p className="mt-3 text-xs text-rf-muted">
            Vite ya puede exponerse en la red local. El servidor embebido
            Rust/Tauri se añadirá en una fase posterior.
          </p>
        </div>
      </section>
    </div>
  )
}
