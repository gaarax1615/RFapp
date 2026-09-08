import { useEffect, useState } from 'react'
import { useServices } from '@/app/AppProviders'
import { useAppStore } from '@/app/store'
import {
  ABS_MAX_MHZ,
  ABS_MIN_MHZ,
  clampRange,
  FULL_UHF,
  MIN_SPAN_MHZ,
} from './spectrumRange'

const PRESETS: { id: string; label: string; start: number; end: number }[] = [
  { id: 'uhf', label: 'UHF 470–698', start: FULL_UHF.startMhz, end: FULL_UHF.endMhz },
  { id: 'low', label: 'Baja 470–542', start: 470, end: 542 },
  { id: 'mid', label: 'Media 516–590', start: 516, end: 590 },
  { id: 'high', label: 'Alta 614–698', start: 614, end: 698 },
  { id: 'narrow', label: '±10 MHz', start: 0, end: 0 },
]

interface FrequencyRangeControlsProps {
  onRangeApplied?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomSelected?: () => void
  onFitDevices?: () => void
  onResetZoom?: () => void
}

export function FrequencyRangeControls({
  onRangeApplied,
  onZoomIn,
  onZoomOut,
  onZoomSelected,
  onFitDevices,
  onResetZoom,
}: FrequencyRangeControlsProps) {
  const { spectrum } = useServices()
  const spectrumRange = useAppStore((s) => s.spectrumRange)
  const setSpectrumRange = useAppStore((s) => s.setSpectrumRange)
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId)
  const devices = useAppStore((s) => s.devices)

  const [start, setStart] = useState(String(spectrumRange.startMhz))
  const [end, setEnd] = useState(String(spectrumRange.endMhz))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [activePreset, setActivePreset] = useState<string | null>('uhf')

  useEffect(() => {
    setStart(String(spectrumRange.startMhz))
    setEnd(String(spectrumRange.endMhz))
  }, [spectrumRange.startMhz, spectrumRange.endMhz])

  const applyRange = async (startMhz: number, endMhz: number, presetId?: string | null) => {
    const next = clampRange(startMhz, endMhz)
    if (!next) {
      setError(`Ancho mínimo ${MIN_SPAN_MHZ} MHz · rango ${ABS_MIN_MHZ}–${ABS_MAX_MHZ}`)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await spectrum.setRange(next.startMhz, next.endMhz)
      setSpectrumRange(next)
      setStart(String(next.startMhz))
      setEnd(String(next.endMhz))
      setActivePreset(presetId ?? null)
      onRangeApplied?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aplicar el rango')
    } finally {
      setBusy(false)
    }
  }

  const onApplyCustom = () => {
    void applyRange(Number(start), Number(end), null)
  }

  const onPreset = (preset: (typeof PRESETS)[number]) => {
    if (preset.id === 'narrow') {
      const selected = devices.find((d) => d.id === selectedDeviceId)
      const center =
        selected?.frequencyMhz ??
        (spectrumRange.startMhz + spectrumRange.endMhz) / 2
      void applyRange(center - 10, center + 10, preset.id)
      return
    }
    void applyRange(preset.start, preset.end, preset.id)
  }

  const span = spectrumRange.endMhz - spectrumRange.startMhz
  const hasSelection = Boolean(selectedDeviceId)

  return (
    <div className="rounded-xl border border-white/10 bg-[#121820] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-slate-400 uppercase">
            Rango de frecuencia
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            ANCHO {span.toFixed(span < 20 ? 2 : 0)} MHz
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ZoomBtn label="−" title="Alejar" onClick={onZoomOut} disabled={busy} />
          <ZoomBtn label="+" title="Acercar" onClick={onZoomIn} disabled={busy} />
          <ZoomBtn
            label="Zoom dispositivo"
            title="Zoom ±5 MHz al dispositivo seleccionado"
            onClick={onZoomSelected}
            disabled={busy || !hasSelection}
            wide
          />
          <ZoomBtn
            label="Ajustar a dispositivos"
            title="Ajustar vista a todos los dispositivos activos"
            onClick={onFitDevices}
            disabled={busy}
            wide
          />
          <ZoomBtn
            label="Restablecer"
            title="UHF completo"
            onClick={onResetZoom}
            disabled={busy}
            wide
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={busy}
            onClick={() => onPreset(preset)}
            className={[
              'rounded-md border px-2 py-1 font-mono text-[11px] transition-colors disabled:opacity-50',
              activePreset === preset.id
                ? 'border-teal-400/40 bg-teal-400/15 text-teal-300'
                : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200',
            ].join(' ')}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-0.5 block font-mono text-[10px] text-rf-muted uppercase">
            Inicio MHz
          </span>
          <input
            type="number"
            step="0.001"
            value={start}
            onChange={(e) => {
              setStart(e.target.value)
              setActivePreset(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyCustom()
            }}
            className="w-[7.5rem] rounded-md border border-white/10 bg-[#0d1117] px-2 py-1.5 font-mono text-sm text-slate-100 outline-none focus:border-teal-400/50"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block font-mono text-[10px] text-rf-muted uppercase">
            Fin MHz
          </span>
          <input
            type="number"
            step="0.001"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value)
              setActivePreset(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyCustom()
            }}
            className="w-[7.5rem] rounded-md border border-white/10 bg-[#0d1117] px-2 py-1.5 font-mono text-sm text-slate-100 outline-none focus:border-teal-400/50"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={onApplyCustom}
          className="rounded-md bg-teal-400/20 px-3 py-1.5 text-sm font-medium text-teal-300 hover:bg-teal-400/30 disabled:opacity-50"
        >
          {busy ? '…' : 'Aplicar'}
        </button>
        {error ? (
          <p className="w-full text-xs text-red-400 sm:w-auto">{error}</p>
        ) : null}
      </div>
    </div>
  )
}

function ZoomBtn({
  label,
  title,
  onClick,
  disabled,
  wide,
}: {
  label: string
  title: string
  onClick?: () => void
  disabled?: boolean
  wide?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || !onClick}
      onClick={onClick}
      className={[
        'rounded-md border border-white/10 bg-[#0d1117] font-mono text-[11px] text-slate-300 transition-colors hover:border-teal-400/40 hover:text-teal-300 disabled:opacity-40',
        wide ? 'px-2 py-1' : 'min-w-8 px-2 py-1',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
