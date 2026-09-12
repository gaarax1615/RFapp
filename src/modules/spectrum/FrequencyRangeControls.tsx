import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useServices } from '@/app/AppProviders'
import { useAppStore } from '@/app/store'
import { STORAGE_KEYS } from '@/utils/constants'
import type { ListenDemod } from '@/types/audio'
import { ListenDemodButtons } from './ListenBar'
import {
  ABS_MAX_MHZ,
  ABS_MIN_MHZ,
  clampRange,
  DEFAULT_SWEEP,
  LIVE_WINDOW_MHZ,
  MAX_SPAN_MHZ,
  MIN_SPAN_MHZ,
} from './spectrumRange'
import { kitPrimaryViewRange } from '@/modules/scan/eventKit'

const DEFAULT_PANEL_POS = { x: 64, y: 16 }

function readPanelPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.rangePanelPos)
    if (!raw) return { ...DEFAULT_PANEL_POS }
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown }
    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return { x: Number(parsed.x), y: Number(parsed.y) }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PANEL_POS }
}

function persistPanelPos(pos: { x: number; y: number }): void {
  try {
    localStorage.setItem(STORAGE_KEYS.rangePanelPos, JSON.stringify(pos))
  } catch {
    /* ignore */
  }
}

function clampPanelPos(x: number, y: number, panel: HTMLElement): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - panel.offsetWidth)
  const maxY = Math.max(0, window.innerHeight - panel.offsetHeight)
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  }
}

const PRESETS: { id: string; label: string; start: number; end: number }[] = [
  { id: 'kit', label: 'Kit evento', start: DEFAULT_SWEEP.startMhz, end: DEFAULT_SWEEP.endMhz },
  { id: 'k12', label: '614–638 K12', start: 614, end: 638 },
  { id: 'j11', label: '596–616 J11', start: 596, end: 616 },
  { id: 'm15', label: '662–686 M15', start: 662, end: 686 },
  { id: 'iem', label: '550–580 IEM', start: 550, end: 580 },
]

function kitAwarePresets(
  catalogIds: string[],
): { id: string; label: string; start: number; end: number }[] {
  const kit = kitPrimaryViewRange(catalogIds)
  const head = kit
    ? {
        id: 'kit',
        label: `${kit.startMhz.toFixed(0)}–${kit.endMhz.toFixed(0)} kit`,
        start: kit.startMhz,
        end: kit.endMhz,
      }
    : PRESETS[0]!
  return [head, ...PRESETS.filter((p) => p.id !== 'kit')]
}

interface FrequencyRangeControlsProps {
  compact?: boolean
  onRangeApplied?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomSelected?: () => void
  onFitDevices?: () => void
  onResetZoom?: () => void
}

export function FrequencyRangeControls({
  compact = false,
  onRangeApplied,
  onZoomIn,
  onZoomOut,
  onZoomSelected,
  onFitDevices,
  onResetZoom,
}: FrequencyRangeControlsProps) {
  const { spectrum, audio } = useServices()
  const spectrumRange = useAppStore((s) => s.spectrumRange)
  const setSpectrumRange = useAppStore((s) => s.setSpectrumRange)
  const viewLocked = useAppStore((s) => s.viewLocked)
  const setViewLocked = useAppStore((s) => s.setViewLocked)
  const setListenBand = useAppStore((s) => s.setListenBand)
  const listenDemod = useAppStore((s) => s.listenDemod)
  const setListenDemod = useAppStore((s) => s.setListenDemod)

  const applyDemod = (mode: ListenDemod) => {
    setListenDemod(mode)
    const band = useAppStore.getState().listenBand
    if (band) void audio.listenToBand(band, spectrum, mode)
  }
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId)
  const eventKitCatalogIds = useAppStore((s) => s.eventKitCatalogIds)
  const presets = kitAwarePresets(eventKitCatalogIds)

  const [start, setStart] = useState(String(spectrumRange.startMhz))
  const [end, setEnd] = useState(String(spectrumRange.endMhz))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setStart(String(spectrumRange.startMhz))
    setEnd(String(spectrumRange.endMhz))
  }, [spectrumRange.startMhz, spectrumRange.endMhz])

  const applyRange = async (
    startMhz: number,
    endMhz: number,
    opts?: { ignoreLock?: boolean },
  ): Promise<boolean> => {
    if (viewLocked && !opts?.ignoreLock) setViewLocked(false)
    const requested = Math.abs(endMhz - startMhz)
    const next = clampRange(startMhz, endMhz)
    if (!next) {
      setError(
        `Ancho ${MIN_SPAN_MHZ}–${MAX_SPAN_MHZ} MHz · ${ABS_MIN_MHZ}–${ABS_MAX_MHZ}`,
      )
      return false
    }

    setBusy(true)
    setError(
      requested > MAX_SPAN_MHZ + 0.01
        ? `Máximo ${MAX_SPAN_MHZ} MHz. Ajustado a ${next.startMhz.toFixed(0)}–${next.endMhz.toFixed(0)}.`
        : null,
    )
    try {
      if (useAppStore.getState().listenBand) {
        await audio.stop(spectrum)
        setListenBand(null)
      }
      const changed = await spectrum.setRange(next.startMhz, next.endMhz)
      setSpectrumRange(next)
      setStart(String(next.startMhz))
      setEnd(String(next.endMhz))
      if (changed) onRangeApplied?.()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aplicar el rango')
      return false
    } finally {
      setBusy(false)
    }
  }

  const toggleLock = () => {
    if (viewLocked) {
      setViewLocked(false)
      return
    }
    void (async () => {
      const ok = await applyRange(Number(start), Number(end), { ignoreLock: true })
      if (ok) setViewLocked(true)
    })()
  }

  const onApplyCustom = () => {
    void applyRange(Number(start), Number(end))
  }

  const span = spectrumRange.endMhz - spectrumRange.startMhz
  const zoomDisabled = busy || viewLocked
  const disabled = busy
  const hasSelection = Boolean(selectedDeviceId)

  if (compact) {
    return (
      <FloatingRangePanel
        start={start}
        end={end}
        span={span}
        error={error}
        disabled={disabled}
        viewLocked={viewLocked}
        presets={presets}
        onStartChange={setStart}
        onEndChange={setEnd}
        onApply={onApplyCustom}
        onPreset={(s, e) => void applyRange(s, e)}
        onToggleLock={toggleLock}
        listenDemod={listenDemod}
        onListenDemod={applyDemod}
      />
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-slate-400 uppercase">
            Rango de frecuencia
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            ANCHO {span.toFixed(span < 20 ? 2 : 0)} MHz ·{' '}
            {span <= LIVE_WINDOW_MHZ + 0.05 ? 'tiempo real' : `barrido · máx ${MAX_SPAN_MHZ}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ZoomBtn label="−" title="Alejar" onClick={onZoomOut} disabled={zoomDisabled} />
          <ZoomBtn label="+" title="Acercar" onClick={onZoomIn} disabled={zoomDisabled} />
          <ZoomBtn
            label="Zoom dispositivo"
            title="Ventana en tiempo real (~1.6 MHz) al dispositivo seleccionado"
            onClick={onZoomSelected}
            disabled={zoomDisabled || !hasSelection}
            wide
          />
          <ZoomBtn
            label="Ajustar a dispositivos"
            title="Ajustar vista a todos los dispositivos activos"
            onClick={onFitDevices}
            disabled={zoomDisabled}
            wide
          />
          <ZoomBtn
            label="Restablecer"
            title="Volver a la banda del kit de evento"
            onClick={onResetZoom}
            disabled={zoomDisabled}
            wide
          />
          <ListenDemodButtons value={listenDemod} onChange={applyDemod} />
          <button
            type="button"
            onClick={toggleLock}
            className={[
              'rounded-md border px-2 py-1 font-mono text-[11px] uppercase',
              viewLocked
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                : 'border-white/10 text-slate-300 hover:border-zinc-400/40 hover:text-zinc-300',
            ].join(' ')}
          >
            {viewLocked ? 'Bloqueado' : 'Bloquear'}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => void applyRange(preset.start, preset.end)}
            className="rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200 disabled:opacity-50"
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
            disabled={disabled}
            onChange={(e) => setStart(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyCustom()
            }}
            className="w-[7.5rem] rounded-md border border-white/10 bg-[#050505] px-2 py-1.5 font-mono text-sm text-slate-100 outline-none focus:border-zinc-400/50 disabled:opacity-50"
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
            disabled={disabled}
            onChange={(e) => setEnd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApplyCustom()
            }}
            className="w-[7.5rem] rounded-md border border-white/10 bg-[#050505] px-2 py-1.5 font-mono text-sm text-slate-100 outline-none focus:border-zinc-400/50 disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={onApplyCustom}
          className="rounded-md bg-zinc-400/20 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-400/30 disabled:opacity-50"
        >
          {busy ? '…' : 'Ver rango'}
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
        'rounded-md border border-white/10 bg-[#050505] font-mono text-[11px] text-slate-300 transition-colors hover:border-zinc-400/40 hover:text-zinc-300 disabled:opacity-40',
        wide ? 'px-2 py-1' : 'min-w-8 px-2 py-1',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function FloatingRangePanel({
  start,
  end,
  span,
  error,
  disabled,
  viewLocked,
  presets,
  onStartChange,
  onEndChange,
  onApply,
  onPreset,
  onToggleLock,
  listenDemod,
  onListenDemod,
}: {
  start: string
  end: string
  span: number
  error: string | null
  disabled: boolean
  viewLocked: boolean
  presets: { id: string; label: string; start: number; end: number }[]
  onStartChange: (v: string) => void
  onEndChange: (v: string) => void
  onApply: () => void
  onPreset: (start: number, end: number) => void
  onToggleLock: () => void
  listenDemod: ListenDemod
  onListenDemod: (mode: ListenDemod) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(readPanelPos)
  const panelRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(pos)
  posRef.current = pos
  const dragRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
    moved: boolean
  } | null>(null)

  const keepInBounds = () => {
    const panel = panelRef.current
    if (!panel) return
    setPos((current) => {
      const next = clampPanelPos(current.x, current.y, panel)
      if (next.x === current.x && next.y === current.y) return current
      persistPanelPos(next)
      return next
    })
  }

  useLayoutEffect(() => {
    keepInBounds()
  }, [open])

  useEffect(() => {
    const onResize = () => keepInBounds()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onDragPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
      moved: false,
    }

    const onMove = (ev: globalThis.PointerEvent) => {
      const drag = dragRef.current
      const panel = panelRef.current
      if (!drag || !panel) return
      const dx = ev.clientX - drag.startX
      const dy = ev.clientY - drag.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true
      setPos(clampPanelPos(drag.origX + dx, drag.origY + dy, panel))
    }
    const onUp = () => {
      handle.releasePointerCapture(event.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      const drag = dragRef.current
      dragRef.current = null
      if (drag?.moved) persistPanelPos(posRef.current)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const onDragDoubleClick = () => {
    const panel = panelRef.current
    const next = panel
      ? clampPanelPos(DEFAULT_PANEL_POS.x, DEFAULT_PANEL_POS.y, panel)
      : { ...DEFAULT_PANEL_POS }
    setPos(next)
    persistPanelPos(next)
  }

  return createPortal(
    <div
      ref={panelRef}
      className="pointer-events-auto fixed z-[80] w-[min(22rem,calc(100vw-5rem))] rounded-xl border border-white/15 bg-[#141414]/95 shadow-2xl shadow-black/50 backdrop-blur-md"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onPointerDown={onDragPointerDown}
          onDoubleClick={onDragDoubleClick}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 text-left select-none active:cursor-grabbing"
          title="Arrastra para mover · doble clic restablece la posición"
        >
          <span className="grid shrink-0 grid-cols-2 gap-0.5 opacity-50" aria-hidden="true">
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] tracking-[0.14em] text-slate-500 uppercase">
              Rango
            </span>
            <span className="block truncate font-mono text-sm text-slate-100">
              {Number(start).toFixed(0)}–{Number(end).toFixed(0)} MHz
              <span className="ml-2 text-[11px] text-slate-500">
                {span.toFixed(span < 20 ? 2 : 0)}
              </span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleLock}
          className={[
            'rounded-md border px-2 py-1 font-mono text-[10px] tracking-wide uppercase',
            viewLocked
              ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
              : 'border-white/10 text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          {viewLocked ? 'Bloq.' : 'Bloquear'}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar' : 'Abrir'}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/5 hover:text-zinc-300"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d={open ? 'M2 8.5 6 4.5 10 8.5' : 'M2 4.5 6 8.5 10 4.5'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="space-y-2 border-t border-white/10 px-2.5 py-2.5">
          <div className="flex flex-wrap items-end gap-1.5">
            <label className="block">
              <span className="mb-0.5 block font-mono text-[9px] text-slate-500 uppercase">
                Inicio
              </span>
              <input
                type="number"
                step="0.001"
                value={start}
                disabled={disabled}
                aria-label="Inicio MHz"
                onChange={(e) => onStartChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onApply()
                }}
                className="w-[5.5rem] rounded-md border border-white/10 bg-[#050505] px-2 py-1 font-mono text-sm text-slate-100 outline-none focus:border-zinc-400/50 disabled:opacity-50"
              />
            </label>
            <span className="pb-1 text-slate-600">–</span>
            <label className="block">
              <span className="mb-0.5 block font-mono text-[9px] text-slate-500 uppercase">
                Fin
              </span>
              <input
                type="number"
                step="0.001"
                value={end}
                disabled={disabled}
                aria-label="Fin MHz"
                onChange={(e) => onEndChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onApply()
                }}
                className="w-[5.5rem] rounded-md border border-white/10 bg-[#050505] px-2 py-1 font-mono text-sm text-slate-100 outline-none focus:border-zinc-400/50 disabled:opacity-50"
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={onApply}
              className="rounded-md bg-zinc-400/20 px-2.5 py-1 text-sm font-medium text-zinc-300 hover:bg-zinc-400/30 disabled:opacity-50"
            >
              Ver
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => onPreset(preset.start, preset.end)}
                className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-500 uppercase">Modo</span>
            <ListenDemodButtons value={listenDemod} onChange={onListenDemod} compact />
          </div>
          <p className="font-mono text-[10px] text-slate-500">
            {span <= LIVE_WINDOW_MHZ + 0.05
              ? 'Ventana fija: lectura en tiempo real'
              : `Barrido del rango · máx ${MAX_SPAN_MHZ} MHz`}
          </p>
          {viewLocked ? (
            <p className="font-mono text-[10px] text-amber-300/90">
              Arrastra el RTA para escuchar · doble clic = ±200 kHz
            </p>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
