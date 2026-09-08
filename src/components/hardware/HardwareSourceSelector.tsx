import { useState } from 'react'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import type { SpectrumSourceKind } from '@/hardware/spectrum'

type Props = {
  /** compact = fila compacta para el panel */
  compact?: boolean
}

export function HardwareSourceSelector({ compact = false }: Props) {
  const { hardware, spectrum } = useServices()
  const options = useAppStore((s) => s.hardwareOptions)
  const selectedKind = useAppStore((s) => s.selectedSourceKind)
  const setHardwareOptions = useAppStore((s) => s.setHardwareOptions)
  const setSelectedSourceKind = useAppStore((s) => s.setSelectedSourceKind)
  const setHardwareStatus = useAppStore((s) => s.setHardwareStatus)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      const next = await hardware.refresh()
      setHardwareOptions(next)
      setSelectedSourceKind(hardware.getSelectedKind())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar hardware')
    } finally {
      setBusy(false)
    }
  }

  async function select(kind: SpectrumSourceKind) {
    if (kind === selectedKind) return
    setBusy(true)
    setError(null)
    try {
      if (hardware.getOptions().length === 0) {
        await hardware.refresh()
      }
      await hardware.select(kind, spectrum)
      setSelectedSourceKind(hardware.getSelectedKind())
      setHardwareOptions(hardware.getOptions())
      setHardwareStatus(spectrum.getStatus())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la fuente')
    } finally {
      setBusy(false)
    }
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="hw-source-compact">
          Fuente de hardware
        </label>
        <select
          id="hw-source-compact"
          disabled={busy}
          value={selectedKind}
          onChange={(e) => void select(e.target.value as SpectrumSourceKind)}
          className="rounded-md border border-white/10 bg-[#0d1117] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-400/50"
        >
          {options.length === 0 ? (
            <option value="mock">Simulado</option>
          ) : (
            options.map((opt) => (
              <option key={opt.kind} value={opt.kind} disabled={!opt.available}>
                {opt.label}
                {!opt.available ? ' (no detectado)' : ''}
              </option>
            ))
          )}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:border-teal-400/40 hover:text-teal-300 disabled:opacity-50"
        >
          Buscar
        </button>
        {error ? <span className="text-[11px] text-red-400">{error}</span> : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-rf-muted">
          Elige simulado o hardware detectado por USB / driver.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="rounded-md border border-rf-border px-2.5 py-1.5 text-xs text-slate-300 hover:border-teal-400/40 hover:text-teal-300 disabled:opacity-50"
        >
          {busy ? 'Buscando…' : 'Buscar de nuevo'}
        </button>
      </div>

      <ul className="space-y-2">
        {options.map((opt) => {
          const active = opt.kind === selectedKind
          const disabled = !opt.available || busy
          return (
            <li key={opt.kind}>
              <button
                type="button"
                disabled={disabled && !active}
                onClick={() => void select(opt.kind)}
                className={[
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition',
                  active
                    ? 'border-teal-400/50 bg-teal-400/10'
                    : opt.available
                      ? 'border-rf-border bg-rf-bg hover:border-white/20'
                      : 'cursor-not-allowed border-rf-border/60 bg-rf-bg/50 opacity-60',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    active
                      ? 'border-teal-400 bg-teal-400'
                      : 'border-white/30 bg-transparent',
                  ].join(' ')}
                  aria-hidden
                >
                  {active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0d1117]" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-100">
                      {opt.label}
                    </span>
                    {opt.available ? (
                      <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-emerald-400">
                        Disponible
                      </span>
                    ) : (
                      <span className="rounded border border-zinc-500/40 bg-zinc-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
                        No detectado
                      </span>
                    )}
                    {active ? (
                      <span className="rounded border border-teal-400/40 bg-teal-400/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-teal-300">
                        Activo
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs text-rf-muted">{opt.detail}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  )
}
