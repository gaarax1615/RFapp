import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { useServices } from '@/app/AppProviders'
import { useAppStore } from '@/app/store'
import type { SpectrumFrame } from '@/types/spectrum'
import { FrequencyRangeControls } from './FrequencyRangeControls'
import { FrequencyAxis } from './FrequencyAxis'
import { ListenBar } from './ListenBar'
import type { ListenDemod } from '@/types/audio'
import { RtaSensitivityControl } from './RtaSensitivityControl'
import { clickListenBand, makeListenBand } from './rfListen'
import { STORAGE_KEYS } from '@/utils/constants'
import {
  clampRange,
  clampRtaSensitivity,
  DEFAULT_SWEEP,
  LIVE_WINDOW_MHZ,
  RTA_SENSITIVITY,
  SPECTRUM_PAD,
  rtaDbWindow,
  xToFrequencyMhz,
  zoomAround,
} from './spectrumRange'
import { kitPrimaryViewRange } from '@/modules/scan/eventKit'

const RTA_SPLIT_MIN = 0.22
const RTA_SPLIT_MAX = 0.88
const RTA_SPLIT_DEFAULT = 0.74

function readRtaSensitivity(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.rtaSensitivity)
    if (raw == null || raw === '') return RTA_SENSITIVITY.default
    return clampRtaSensitivity(Number(raw))
  } catch {
    return RTA_SENSITIVITY.default
  }
}

function persistRtaSensitivity(value: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.rtaSensitivity, String(clampRtaSensitivity(value)))
  } catch {
    /* ignore */
  }
}

function readRtaSplit(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEYS.rtaSplit))
    if (Number.isFinite(v) && v >= RTA_SPLIT_MIN && v <= RTA_SPLIT_MAX) return v
  } catch {
    /* ignore */
  }
  return RTA_SPLIT_DEFAULT
}

interface SpectrumAnalyzerProps {
  showWaterfall?: boolean
  /** Pantalla completa: RTA + cascada + barra de rango. */
  solo?: boolean
}

export function SpectrumAnalyzer({
  showWaterfall = true,
  solo = false,
}: SpectrumAnalyzerProps) {
  const { spectrum, audio, tunnel } = useServices()
  const devices = useAppStore((s) => s.devices)
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)
  const spectrumRange = useAppStore((s) => s.spectrumRange)
  const setSpectrumRange = useAppStore((s) => s.setSpectrumRange)
  const viewLocked = useAppStore((s) => s.viewLocked)
  const listenBand = useAppStore((s) => s.listenBand)
  const setListenBand = useAppStore((s) => s.setListenBand)
  const listenDemod = useAppStore((s) => s.listenDemod)
  const setListenDemod = useAppStore((s) => s.setListenDemod)

  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null)
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const waterfallContainerRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef(tunnel.rta)
  const latestFrameRef = useRef<SpectrumFrame | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const waterfallSizeRef = useRef({ w: 0, h: 0 })
  const dragRef = useRef<{ startX: number; currentX: number; moved: boolean } | null>(null)
  const [hint, setHint] = useState(
    'Rueda = zoom · Arrastra = zoom a región · Bloquear = escuchar zona',
  )
  const [liveHud, setLiveHud] = useState({ fps: 0, startMhz: 0, endMhz: 0, hops: 1 })
  const [volume, setVolume] = useState(() => audio.getVolume())
  const [rtaRatio, setRtaRatio] = useState(readRtaSplit)
  const [rtaSensitivity, setRtaSensitivity] = useState(readRtaSensitivity)
  const fpsRef = useRef({ frames: 0, lastAt: performance.now() })
  const rtaRatioRef = useRef(rtaRatio)
  rtaRatioRef.current = rtaRatio
  const rtaSensitivityRef = useRef(rtaSensitivity)
  rtaSensitivityRef.current = rtaSensitivity
  const dbWindow = rtaDbWindow(rtaSensitivity)

  const resetTraces = useCallback(() => {
    tunnel.reset()
  }, [tunnel])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.listenDemod)
      if (raw === 'nfm' || raw === 'wfm' || raw === 'am') setListenDemod(raw)
    } catch {
      /* ignore */
    }
  }, [setListenDemod])

  const applyRange = useCallback(
    async (startMhz: number, endMhz: number) => {
      if (useAppStore.getState().viewLocked) return
      const next = clampRange(startMhz, endMhz)
      if (!next) return
      if (useAppStore.getState().listenBand) {
        await audio.stop(spectrum)
        setListenBand(null)
      }
      const changed = await spectrum.setRange(next.startMhz, next.endMhz)
      setSpectrumRange(next)
      if (changed) resetTraces()
    },
    [audio, spectrum, setListenBand, setSpectrumRange, resetTraces],
  )

  const startListen = useCallback(
    async (
      band: { startMhz: number; endMhz: number } | null,
      demod?: ListenDemod,
    ) => {
      if (!band) return
      const mode = demod ?? useAppStore.getState().listenDemod
      try {
        await audio.listenToBand(band, spectrum, mode)
        setListenBand(band)
        setHint(
          audio.getListenKind() === 'sdr'
            ? `${mode.toUpperCase()} ${band.startMhz.toFixed(3)}–${band.endMhz.toFixed(3)} MHz`
            : `Escuchando ${band.startMhz.toFixed(3)}–${band.endMhz.toFixed(3)} MHz`,
        )
      } catch (e) {
        setHint(e instanceof Error ? e.message : 'No se pudo iniciar la escucha')
      }
    },
    [audio, spectrum, setListenBand],
  )

  const changeDemod = useCallback(
    (mode: ListenDemod) => {
      setListenDemod(mode)
      const band = useAppStore.getState().listenBand
      if (band) void startListen(band, mode)
    },
    [setListenDemod, startListen],
  )

  const stopListen = useCallback(async () => {
    await audio.stop(spectrum)
    setListenBand(null)
    setHint('Escucha detenida')
  }, [audio, spectrum, setListenBand])

  const onSplitPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const col = columnRef.current
    const handle = event.currentTarget
    if (!col) return
    handle.setPointerCapture(event.pointerId)
    const startY = event.clientY
    const startRatio = rtaRatioRef.current
    const usable = Math.max(160, col.getBoundingClientRect().height)

    const onMove = (ev: globalThis.PointerEvent) => {
      const next = startRatio + (ev.clientY - startY) / usable
      setRtaRatio(Math.min(RTA_SPLIT_MAX, Math.max(RTA_SPLIT_MIN, next)))
    }
    const onUp = (ev: globalThis.PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      try {
        localStorage.setItem(STORAGE_KEYS.rtaSplit, String(rtaRatioRef.current))
      } catch {
        /* ignore */
      }
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const onSplitDoubleClick = () => {
    setRtaRatio(RTA_SPLIT_DEFAULT)
    try {
      localStorage.setItem(STORAGE_KEYS.rtaSplit, String(RTA_SPLIT_DEFAULT))
    } catch {
      /* ignore */
    }
  }

  const redrawOverlay = useCallback(() => {
    const frame = latestFrameRef.current
    const canvas = spectrumCanvasRef.current
    const { w, h } = sizeRef.current
    if (!frame || !canvas || w <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    rendererRef.current.setOptions({
      devices: useAppStore.getState().devices,
      selectedDeviceId: useAppStore.getState().selectedDeviceId,
      showFrequencyAxis: !showWaterfall,
      showHud: !solo,
      listenBand: useAppStore.getState().listenBand,
      zoomSelection:
        dragRef.current && !useAppStore.getState().viewLocked
          ? { x0: dragRef.current.startX, x1: dragRef.current.currentX }
          : null,
      listenDrag:
        dragRef.current && useAppStore.getState().viewLocked
          ? { x0: dragRef.current.startX, x1: dragRef.current.currentX }
          : null,
    })
    rendererRef.current.draw(ctx, frame, w, h)
  }, [showWaterfall, solo])

  useEffect(() => {
    rendererRef.current.setOptions({
      devices,
      selectedDeviceId,
      showFrequencyAxis: !showWaterfall,
      showHud: !solo,
      listenBand,
      minDb: dbWindow.minDb,
      maxDb: dbWindow.maxDb,
    })
    tunnel.waterfall.setOptions({
      minDb: dbWindow.minDb,
      maxDb: dbWindow.maxDb,
    })
    redrawOverlay()
  }, [devices, selectedDeviceId, redrawOverlay, showWaterfall, solo, listenBand, dbWindow.minDb, dbWindow.maxDb, tunnel])

  useEffect(() => {
    const spectrumEl = containerRef.current
    const waterfallEl = waterfallContainerRef.current
    const columnEl = columnRef.current
    if (!spectrumEl) return

    const columnWidth = () => {
      const el = columnEl ?? spectrumEl
      return Math.max(1, Math.floor(el.getBoundingClientRect().width))
    }

    const resizeSpectrum = () => {
      const canvas = spectrumCanvasRef.current
      if (!canvas || !spectrumEl) return
      const w = columnWidth()
      const h = Math.max(1, Math.floor(spectrumEl.getBoundingClientRect().height))
      if (w < 8 || h < 8) return
      sizeRef.current = { w, h }
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      redrawOverlay()
    }

    const resizeWaterfall = () => {
      if (!waterfallEl || !waterfallCanvasRef.current) return
      const w = columnWidth()
      const h = Math.max(1, Math.floor(waterfallEl.getBoundingClientRect().height))
      if (w < 8 || h < 8) return
      waterfallSizeRef.current = { w, h }
      tunnel.setViewSize(w, h)
      tunnel.present(waterfallCanvasRef.current)
    }

    resizeSpectrum()
    resizeWaterfall()

    const ro = new ResizeObserver(() => {
      resizeSpectrum()
      resizeWaterfall()
    })
    ro.observe(spectrumEl)
    if (waterfallEl) ro.observe(waterfallEl)
    if (columnEl) ro.observe(columnEl)

    return () => ro.disconnect()
  }, [showWaterfall, redrawOverlay, tunnel])

  useEffect(() => {
    return spectrum.subscribe((frame) => {
      latestFrameRef.current = frame
      const fps = fpsRef.current
      fps.frames += 1
      const now = performance.now()
      if (now - fps.lastAt >= 500) {
        const nextFps = Math.round((fps.frames * 1000) / (now - fps.lastAt))
        fps.frames = 0
        fps.lastAt = now
        setLiveHud({
          fps: nextFps,
          startMhz: frame.startFrequencyMhz,
          endMhz: frame.endFrequencyMhz,
          hops: frame.hopCount ?? 1,
        })
      }
      const canvas = spectrumCanvasRef.current
      const { w, h } = sizeRef.current
      if (canvas && w > 0) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const db = rtaDbWindow(rtaSensitivityRef.current)
          rendererRef.current.setOptions({
            devices: useAppStore.getState().devices,
            selectedDeviceId: useAppStore.getState().selectedDeviceId,
            showFrequencyAxis: !showWaterfall,
            showHud: !solo,
            listenBand: useAppStore.getState().listenBand,
            minDb: db.minDb,
            maxDb: db.maxDb,
            zoomSelection:
              dragRef.current && !useAppStore.getState().viewLocked
                ? { x0: dragRef.current.startX, x1: dragRef.current.currentX }
                : null,
            listenDrag:
              dragRef.current && useAppStore.getState().viewLocked
                ? { x0: dragRef.current.startX, x1: dragRef.current.currentX }
                : null,
          })
          rendererRef.current.draw(ctx, frame, w, h)
        }
      }

      if (showWaterfall && waterfallCanvasRef.current) {
        const ww = sizeRef.current.w
        const wh = waterfallSizeRef.current.h
        if (ww > 0 && wh > 0) {
          tunnel.setViewSize(ww, wh)
          tunnel.present(waterfallCanvasRef.current)
        }
      }
    })
  }, [spectrum, showWaterfall, solo, tunnel])

  const onPointerDown = (event: MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    const canvas = spectrumCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    dragRef.current = { startX: x, currentX: x, moved: false }
  }

  const onPointerMove = (event: MouseEvent<HTMLCanvasElement>) => {
    const frame = latestFrameRef.current
    const canvas = spectrumCanvasRef.current
    if (!frame || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const { w } = sizeRef.current
    const freq = xToFrequencyMhz(
      x,
      w,
      frame.startFrequencyMhz,
      frame.endFrequencyMhz,
    )
    rendererRef.current.setOptions({ cursorMhz: freq })

    if (dragRef.current) {
      dragRef.current.currentX = x
      if (Math.abs(x - dragRef.current.startX) > 4) {
        dragRef.current.moved = true
      }
    }
    redrawOverlay()
  }

  const onPointerLeave = () => {
    rendererRef.current.setOptions({
      cursorMhz: null,
      zoomSelection: null,
      listenDrag: null,
    })
    if (dragRef.current && !dragRef.current.moved) {
      dragRef.current = null
    }
    redrawOverlay()
  }

  const onPointerUp = (event: MouseEvent<HTMLCanvasElement>) => {
    const frame = latestFrameRef.current
    const canvas = spectrumCanvasRef.current
    const drag = dragRef.current
    dragRef.current = null
    rendererRef.current.setOptions({ zoomSelection: null, listenDrag: null })

    if (!frame || !canvas) {
      redrawOverlay()
      return
    }

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const { w } = sizeRef.current
    const locked = useAppStore.getState().viewLocked

    if (locked) {
      if (drag?.moved) {
        const f0 = xToFrequencyMhz(drag.startX, w, frame.startFrequencyMhz, frame.endFrequencyMhz)
        const f1 = xToFrequencyMhz(drag.currentX, w, frame.startFrequencyMhz, frame.endFrequencyMhz)
        if (f0 != null && f1 != null) {
          void startListen(makeListenBand(f0, f1))
          return
        }
      }
      const hit = rendererRef.current.hitTestDevice(
        x,
        w,
        frame,
        useAppStore.getState().devices,
      )
      if (hit) setSelectedDeviceId(hit.id)
      redrawOverlay()
      return
    }

    if (drag?.moved) {
      const f0 = xToFrequencyMhz(drag.startX, w, frame.startFrequencyMhz, frame.endFrequencyMhz)
      const f1 = xToFrequencyMhz(drag.currentX, w, frame.startFrequencyMhz, frame.endFrequencyMhz)
      if (f0 != null && f1 != null && Math.abs(f1 - f0) >= 0.5) {
        void applyRange(Math.min(f0, f1), Math.max(f0, f1))
        setHint('Zoom a región aplicado')
        return
      }
    }

    const hit = rendererRef.current.hitTestDevice(
      x,
      w,
      frame,
      useAppStore.getState().devices,
    )
    setSelectedDeviceId(hit ? hit.id : null)
    redrawOverlay()
  }

  const onDoubleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const frame = latestFrameRef.current
    const canvas = spectrumCanvasRef.current
    if (!frame || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const { w } = sizeRef.current
    if (useAppStore.getState().viewLocked) {
      const hit = rendererRef.current.hitTestDevice(
        x,
        w,
        frame,
        useAppStore.getState().devices,
      )
      const freq =
        hit?.frequencyMhz ??
        xToFrequencyMhz(x, w, frame.startFrequencyMhz, frame.endFrequencyMhz)
      if (freq != null) void startListen(clickListenBand(freq))
      return
    }
    const hit = rendererRef.current.hitTestDevice(
      x,
      w,
      frame,
      useAppStore.getState().devices,
    )
    if (hit) {
      setSelectedDeviceId(hit.id)
      const half = LIVE_WINDOW_MHZ / 2
      void applyRange(hit.frequencyMhz - half, hit.frequencyMhz + half)
      setHint(`Tiempo real → ${hit.name} (${hit.frequencyMhz.toFixed(3)} MHz)`)
      return
    }
    const freq = xToFrequencyMhz(x, w, frame.startFrequencyMhz, frame.endFrequencyMhz)
    if (freq != null) {
      const half = LIVE_WINDOW_MHZ / 2
      void applyRange(freq - half, freq + half)
      setHint(`Tiempo real en ${freq.toFixed(3)} MHz`)
    }
  }

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    if (useAppStore.getState().viewLocked) return
    const frame = latestFrameRef.current
    const canvas = spectrumCanvasRef.current
    if (!frame || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const { w } = sizeRef.current
    const center =
      xToFrequencyMhz(x, w, frame.startFrequencyMhz, frame.endFrequencyMhz) ??
      (frame.startFrequencyMhz + frame.endFrequencyMhz) / 2
    const factor = event.deltaY > 0 ? 1.25 : 0.8
    const next = zoomAround(
      center,
      frame.startFrequencyMhz,
      frame.endFrequencyMhz,
      factor,
    )
    if (next) {
      void applyRange(next.startMhz, next.endMhz)
      setHint(factor < 1 ? 'Acercando' : 'Alejando')
    }
  }

  const zoomIn = () => {
    const { startMhz, endMhz } = spectrumRange
    const mid = (startMhz + endMhz) / 2
    const next = zoomAround(mid, startMhz, endMhz, 0.6)
    if (next) void applyRange(next.startMhz, next.endMhz)
  }

  const zoomOut = () => {
    const { startMhz, endMhz } = spectrumRange
    const mid = (startMhz + endMhz) / 2
    const next = zoomAround(mid, startMhz, endMhz, 1.6)
    if (next) void applyRange(next.startMhz, next.endMhz)
  }

  const zoomToSelected = () => {
    const selected = devices.find((d) => d.id === selectedDeviceId)
    if (!selected) {
      setHint('Selecciona un dispositivo (clic en su marcador)')
      return
    }
    const half = LIVE_WINDOW_MHZ / 2
    void applyRange(selected.frequencyMhz - half, selected.frequencyMhz + half)
    setHint(`Tiempo real · ${selected.name}`)
  }

  const eventKitCatalogIds = useAppStore((s) => s.eventKitCatalogIds)

  const fitDevices = () => {
    const enabled = devices.filter((d) => d.enabled)
    if (enabled.length === 0) {
      const kit = kitPrimaryViewRange(eventKitCatalogIds)
      void applyRange(
        kit?.startMhz ?? DEFAULT_SWEEP.startMhz,
        kit?.endMhz ?? DEFAULT_SWEEP.endMhz,
      )
      return
    }
    const freqs = enabled.map((d) => d.frequencyMhz)
    const min = Math.min(...freqs)
    const max = Math.max(...freqs)
    const pad = Math.max(2, (max - min) * 0.15)
    void applyRange(min - pad, max + pad)
    setHint('Vista ajustada a dispositivos')
  }

  const resetZoom = () => {
    const kit = kitPrimaryViewRange(eventKitCatalogIds)
    const start = kit?.startMhz ?? DEFAULT_SWEEP.startMhz
    const end = kit?.endMhz ?? DEFAULT_SWEEP.endMhz
    void applyRange(start, end)
    setHint(`Kit · ${start.toFixed(0)}–${end.toFixed(0)} MHz`)
  }

  const axisStart = liveHud.startMhz || spectrumRange.startMhz
  const axisEnd = liveHud.endMhz || spectrumRange.endMhz

  return (
    <div className={solo ? 'relative flex h-full min-h-0 flex-col' : 'flex min-h-0 flex-1 flex-col gap-2'}>
      {solo ? (
        <FrequencyRangeControls
          compact
          onRangeApplied={resetTraces}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomSelected={zoomToSelected}
          onFitDevices={fitDevices}
          onResetZoom={resetZoom}
        />
      ) : (
        <FrequencyRangeControls
          compact={false}
          onRangeApplied={resetTraces}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomSelected={zoomToSelected}
          onFitDevices={fitDevices}
          onResetZoom={resetZoom}
        />
      )}
      {solo || !listenBand ? null : (
        <ListenBar
          band={listenBand}
          volume={volume}
          mode={audio.getListenKind()}
          demod={listenDemod}
          onDemod={changeDemod}
          onVolume={(v) => {
            setVolume(v)
            audio.setVolume(v)
          }}
          onStop={() => void stopListen()}
        />
      )}

      <div ref={columnRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={containerRef}
          className={
            solo
              ? 'relative min-h-[80px] overflow-hidden bg-[#050505]'
              : 'relative min-h-[80px] overflow-hidden rounded-t-xl border border-white/10 bg-[#050505] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
          }
          style={
            showWaterfall
              ? { flex: `${rtaRatio} 1 0%` }
              : { flex: '1 1 auto' }
          }
        >
          <canvas
            ref={spectrumCanvasRef}
            className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerLeave}
            onDoubleClick={onDoubleClick}
            onWheel={onWheel}
          />
          <RtaSensitivityControl
            value={rtaSensitivity}
            minDb={dbWindow.minDb}
            maxDb={dbWindow.maxDb}
            onChange={setRtaSensitivity}
            onChangeEnd={persistRtaSensitivity}
          />
          {solo ? (
            <>
              {listenBand ? (
                <div className="pointer-events-none absolute top-3 right-3 z-10 max-w-[min(24rem,calc(100%-2rem))]">
                  <div className="pointer-events-auto">
                    <ListenBar
                      band={listenBand}
                      volume={volume}
                      mode={audio.getListenKind()}
                      demod={listenDemod}
                      onDemod={changeDemod}
                      onVolume={(v) => {
                        setVolume(v)
                        audio.setVolume(v)
                      }}
                      onStop={() => void stopListen()}
                    />
                  </div>
                </div>
              ) : null}
              <div className="pointer-events-none absolute right-3 bottom-2 z-10 flex items-center gap-3 font-mono text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-300" />
                  VIVO
                </span>
                <span>{liveHud.fps} fps</span>
                <span>
                  {Math.round(dbWindow.minDb)}/{Math.round(dbWindow.maxDb)} dB
                </span>
                {liveHud.hops <= 1 ? (
                  <span className="text-zinc-200">tiempo real</span>
                ) : (
                  <span className="text-amber-200/90">
                    barrido {liveHud.hops} hops
                  </span>
                )}
                {viewLocked ? (
                  <span className="text-amber-300">BLOQUEADO · arrastra para escuchar</span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-[#050505]/85 px-2 py-1 font-mono text-[10px] text-slate-400">
              {viewLocked
                ? 'Bloqueado · arrastra una zona para escucharla'
                : hint}
            </p>
          )}
        </div>

        {showWaterfall ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-valuemin={Math.round(RTA_SPLIT_MIN * 100)}
            aria-valuemax={Math.round(RTA_SPLIT_MAX * 100)}
            aria-valuenow={Math.round(rtaRatio * 100)}
            title="Arrastra para cambiar el tamaño · doble clic restablece"
            onPointerDown={onSplitPointerDown}
            onDoubleClick={onSplitDoubleClick}
            className="group relative z-20 shrink-0 cursor-row-resize touch-none select-none"
          >
            <div className="relative h-1.5 bg-white/10 transition-colors group-hover:bg-zinc-400/70 group-active:bg-zinc-300">
              <span className="absolute top-1/2 left-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 group-hover:bg-zinc-100" />
            </div>
            <FrequencyAxis startMhz={axisStart} endMhz={axisEnd} />
          </div>
        ) : null}

        {showWaterfall ? (
          <div
            ref={waterfallContainerRef}
            className={
              solo
                ? 'relative min-h-[64px] overflow-hidden bg-[#081248]'
                : 'relative min-h-[64px] overflow-hidden rounded-b-xl border border-t-0 border-white/10 bg-[#081248]'
            }
            style={{ flex: `${1 - rtaRatio} 1 0%` }}
          >
            <canvas
              ref={waterfallCanvasRef}
              className="absolute inset-0 h-full w-full"
            />
            {listenBand && axisEnd > axisStart ? (
              <div
                className="pointer-events-none absolute inset-y-0"
                style={{
                  left: SPECTRUM_PAD.left,
                  right: SPECTRUM_PAD.right,
                }}
              >
                <div
                  className="absolute inset-y-0 border-x border-amber-300/80 bg-amber-400/15"
                  style={{
                    left: `${((listenBand.startMhz - axisStart) / (axisEnd - axisStart)) * 100}%`,
                    width: `${((listenBand.endMhz - listenBand.startMhz) / (axisEnd - axisStart)) * 100}%`,
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
