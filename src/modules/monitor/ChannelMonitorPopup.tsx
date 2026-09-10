import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useServices } from '@/app/AppProviders'
import { useAppStore } from '@/app/store'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatFrequencyMhz, STORAGE_KEYS } from '@/utils/constants'
import { deviceTypeLabel } from '@/utils/i18n'
import { clickListenBand } from '@/modules/spectrum/rfListen'
import type { RfDevice } from '@/types/device'
import type { ChannelMetrics } from '@/types/monitor'
import type { RfAlert } from '@/types/alerts'
import { HistoryChart, LevelRow, MiniSpectrum } from './channelMonitorWidgets'

const DEFAULT_POS = { x: 72, y: 72 }

function readPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.monitorPopupPos)
    if (!raw) return { ...DEFAULT_POS }
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown }
    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return { x: Number(parsed.x), y: Number(parsed.y) }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_POS }
}

function persistPos(pos: { x: number; y: number }): void {
  try {
    localStorage.setItem(STORAGE_KEYS.monitorPopupPos, JSON.stringify(pos))
  } catch {
    /* ignore */
  }
}

function clampPos(x: number, y: number, el: HTMLElement): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - el.offsetWidth)
  const maxY = Math.max(0, window.innerHeight - el.offsetHeight)
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  }
}

export function ChannelMonitorPopup({
  device,
  metrics,
  alerts,
  onClose,
}: {
  device: RfDevice
  metrics?: ChannelMetrics
  alerts: RfAlert[]
  onClose: () => void
}) {
  const { monitor, spectrum, audio } = useServices()
  const setListenBand = useAppStore((s) => s.setListenBand)
  const listenBand = useAppStore((s) => s.listenBand)
  const [history, setHistory] = useState<number[]>([])
  const [volume, setVolume] = useState(() => audio.getVolume())
  const [pos, setPos] = useState(readPos)
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

  const title = device.channel ? `${device.name} - ${device.channel}` : device.name
  const deviceAlerts = alerts.filter((a) => a.deviceId === device.id).slice(0, 3)
  const listeningHere =
    listenBand != null &&
    device.frequencyMhz >= listenBand.startMhz &&
    device.frequencyMhz <= listenBand.endMhz

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const values = await monitor.getHistory(device.id, 60_000)
      if (!cancelled) setHistory(values)
    }
    void tick()
    const id = setInterval(() => void tick(), 500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [device.id, monitor])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const keepInBounds = () => {
    const panel = panelRef.current
    if (!panel) return
    setPos((current) => {
      const next = clampPos(current.x, current.y, panel)
      if (next.x === current.x && next.y === current.y) return current
      persistPos(next)
      return next
    })
  }

  useLayoutEffect(() => {
    keepInBounds()
  }, [])

  useEffect(() => {
    const onResize = () => keepInBounds()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onDragPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
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
      setPos(clampPos(drag.origX + dx, drag.origY + dy, panel))
    }
    const onUp = () => {
      handle.releasePointerCapture(event.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      if (dragRef.current?.moved) persistPos(posRef.current)
      dragRef.current = null
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const onListen = async () => {
    const band = clickListenBand(device.frequencyMhz)
    if (!band) return
    await audio.listenToBand(band, spectrum)
    setListenBand(band)
  }

  const onStopListen = async () => {
    await audio.stop()
    setListenBand(null)
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Monitoreo ${title}`}
      className="fixed z-[90] flex w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(36rem,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-xl border border-orange-400/35 bg-[#121820]/97 shadow-2xl shadow-black/60 backdrop-blur-md"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-2.5 py-1.5">
        <button
          type="button"
          onPointerDown={onDragPointerDown}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-2 text-left select-none active:cursor-grabbing"
          title="Arrastra para mover"
        >
          <span className="grid shrink-0 grid-cols-2 gap-0.5 opacity-50" aria-hidden="true">
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-slate-400" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-sm text-orange-100 uppercase">
              {title}
            </span>
            <span className="block font-mono text-[11px] text-teal-300">
              {formatFrequencyMhz(device.frequencyMhz)}
            </span>
          </span>
        </button>
        {metrics ? <StatusBadge kind="signal" value={metrics.status} /> : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/5 hover:text-slate-100"
        >
          ×
        </button>
      </div>

      <div className="min-h-0 space-y-3 overflow-auto px-3 py-3">
        <p className="text-[11px] text-rf-muted">
          {device.brand} {device.model} · {deviceTypeLabel(device.type)}
        </p>

        <div className="space-y-3">
          <LevelRow
            label="RF"
            value={metrics ? `${metrics.signalDbm.toFixed(0)} dBm` : '—'}
            ratio={metrics ? (metrics.signalDbm + 90) / 50 : 0}
            color="bg-rf-cyan"
          />
          <LevelRow
            label="Ruido"
            value={metrics ? `${metrics.noiseFloorDbm.toFixed(0)} dBm` : '—'}
            ratio={metrics ? (metrics.noiseFloorDbm + 100) / 40 : 0}
            color="bg-rf-amber"
          />
          <LevelRow
            label="SNR"
            value={metrics ? `${metrics.snrDb.toFixed(0)} dB` : '—'}
            ratio={metrics ? metrics.snrDb / 50 : 0}
            color="bg-emerald-400"
          />
        </div>

        <div>
          <p className="mb-1 font-mono text-[10px] tracking-wider text-rf-muted uppercase">
            Mini espectro (±1 MHz)
          </p>
          <MiniSpectrum centerMhz={device.frequencyMhz} spectrumService={spectrum} />
        </div>

        <div>
          <p className="mb-1 font-mono text-[10px] tracking-wider text-rf-muted uppercase">
            Historial (60 s)
          </p>
          <HistoryChart values={history} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {listeningHere ? (
            <>
              <label className="flex items-center gap-2 text-[11px] text-amber-200/80">
                Vol
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setVolume(v)
                    audio.setVolume(v)
                  }}
                  className="w-20 accent-amber-300"
                />
              </label>
              <button
                type="button"
                onClick={() => void onStopListen()}
                className="rounded-md border border-amber-400/40 px-2 py-1 font-mono text-[11px] text-amber-200 hover:bg-amber-400/15"
              >
                Detener
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void onListen()}
              className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 font-mono text-[11px] text-amber-200 hover:bg-amber-400/20"
            >
              Escuchar canal
            </button>
          )}
        </div>

        <div>
          <p className="mb-1 font-mono text-[10px] tracking-wider text-rf-muted uppercase">
            Alertas
          </p>
          {deviceAlerts.length === 0 ? (
            <p className="text-[11px] text-rf-muted">Sin alertas</p>
          ) : (
            <ul className="space-y-1">
              {deviceAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-200"
                >
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
