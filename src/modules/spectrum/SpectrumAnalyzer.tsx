import { useCallback, useEffect, useRef, useState, type MouseEvent, type WheelEvent } from 'react'
import { useServices } from '@/app/AppProviders'
import { useAppStore } from '@/app/store'
import type { SpectrumFrame } from '@/types/spectrum'
import { SpectrumRenderer } from './SpectrumRenderer'
import { WaterfallRenderer } from '@/modules/waterfall/WaterfallRenderer'
import { FrequencyRangeControls } from './FrequencyRangeControls'
import {
  clampRange,
  FULL_UHF,
  xToFrequencyMhz,
  zoomAround,
} from './spectrumRange'

interface SpectrumAnalyzerProps {
  showWaterfall?: boolean
}

export function SpectrumAnalyzer({ showWaterfall = true }: SpectrumAnalyzerProps) {
  const { spectrum } = useServices()
  const devices = useAppStore((s) => s.devices)
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)
  const spectrumRange = useAppStore((s) => s.spectrumRange)
  const setSpectrumRange = useAppStore((s) => s.setSpectrumRange)

  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null)
  const waterfallCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const waterfallContainerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef(new SpectrumRenderer())
  const waterfallRef = useRef(new WaterfallRenderer())
  const latestFrameRef = useRef<SpectrumFrame | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const waterfallSizeRef = useRef({ w: 0, h: 0 })
  const dragRef = useRef<{ startX: number; currentX: number; moved: boolean } | null>(null)
  const [hint, setHint] = useState(
    'Rueda = zoom · Arrastra = zoom a región · Doble clic en marcador = ±5 MHz',
  )

  const resetTraces = useCallback(() => {
    rendererRef.current.resetTraces()
    const canvas = waterfallCanvasRef.current
    if (!canvas) return
    waterfallRef.current.attach(canvas)
    const { w, h } = waterfallSizeRef.current
    if (w > 0 && h > 0) {
      waterfallRef.current.resize(w, h)
    }
  }, [])

  const applyRange = useCallback(
    async (startMhz: number, endMhz: number) => {
      const next = clampRange(startMhz, endMhz)
      if (!next) return
      await spectrum.setRange(next.startMhz, next.endMhz)
      setSpectrumRange(next)
      resetTraces()
    },
    [spectrum, setSpectrumRange, resetTraces],
  )

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
      zoomSelection: dragRef.current
        ? { x0: dragRef.current.startX, x1: dragRef.current.currentX }
        : null,
    })
    rendererRef.current.draw(ctx, frame, w, h)
  }, [])

  useEffect(() => {
    rendererRef.current.resetTraces()
  }, [spectrumRange.startMhz, spectrumRange.endMhz])

  useEffect(() => {
    rendererRef.current.setOptions({ devices, selectedDeviceId })
    redrawOverlay()
  }, [devices, selectedDeviceId, redrawOverlay])

  useEffect(() => {
    const spectrumEl = containerRef.current
    const waterfallEl = waterfallContainerRef.current
    if (!spectrumEl) return

    const resizeSpectrum = () => {
      const canvas = spectrumCanvasRef.current
      if (!canvas || !spectrumEl) return
      const rect = spectrumEl.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      sizeRef.current = { w, h }
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      redrawOverlay()
    }

    const resizeWaterfall = () => {
      if (!waterfallEl || !waterfallCanvasRef.current) return
      const rect = waterfallEl.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      waterfallSizeRef.current = { w, h }
      waterfallRef.current.attach(waterfallCanvasRef.current)
      waterfallRef.current.resize(w, h)
      waterfallCanvasRef.current.style.width = `${w}px`
      waterfallCanvasRef.current.style.height = `${h}px`
    }

    resizeSpectrum()
    resizeWaterfall()

    const ro = new ResizeObserver(() => {
      resizeSpectrum()
      resizeWaterfall()
    })
    ro.observe(spectrumEl)
    if (waterfallEl) ro.observe(waterfallEl)

    return () => ro.disconnect()
  }, [showWaterfall, redrawOverlay])

  useEffect(() => {
    if (waterfallCanvasRef.current) {
      waterfallRef.current.attach(waterfallCanvasRef.current)
    }

    return spectrum.subscribe((frame) => {
      latestFrameRef.current = frame
      const canvas = spectrumCanvasRef.current
      const { w, h } = sizeRef.current
      if (canvas && w > 0) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          rendererRef.current.setOptions({
            devices: useAppStore.getState().devices,
            selectedDeviceId: useAppStore.getState().selectedDeviceId,
            zoomSelection: dragRef.current
              ? { x0: dragRef.current.startX, x1: dragRef.current.currentX }
              : null,
          })
          rendererRef.current.draw(ctx, frame, w, h)
        }
      }

      if (showWaterfall) {
        const { w: ww, h: wh } = waterfallSizeRef.current
        if (ww > 0 && wh > 0) {
          waterfallRef.current.pushFrame(frame, ww, wh)
        }
      }
    })
  }, [spectrum, showWaterfall])

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
      rendererRef.current.setOptions({
        zoomSelection: {
          x0: dragRef.current.startX,
          x1: dragRef.current.currentX,
        },
      })
    }
    redrawOverlay()
  }

  const onPointerLeave = () => {
    rendererRef.current.setOptions({ cursorMhz: null, zoomSelection: null })
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
    rendererRef.current.setOptions({ zoomSelection: null })

    if (!frame || !canvas) {
      redrawOverlay()
      return
    }

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const { w } = sizeRef.current

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
    const hit = rendererRef.current.hitTestDevice(
      x,
      w,
      frame,
      useAppStore.getState().devices,
    )
    if (hit) {
      setSelectedDeviceId(hit.id)
      void applyRange(hit.frequencyMhz - 5, hit.frequencyMhz + 5)
      setHint(`Zoom ±5 MHz → ${hit.name} (${hit.frequencyMhz.toFixed(3)} MHz)`)
      return
    }
    const freq = xToFrequencyMhz(x, w, frame.startFrequencyMhz, frame.endFrequencyMhz)
    if (freq != null) {
      void applyRange(freq - 5, freq + 5)
      setHint(`Zoom ±5 MHz en ${freq.toFixed(3)} MHz`)
    }
  }

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
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
    void applyRange(selected.frequencyMhz - 5, selected.frequencyMhz + 5)
    setHint(`Zoom a ${selected.name}`)
  }

  const fitDevices = () => {
    const enabled = devices.filter((d) => d.enabled)
    if (enabled.length === 0) {
      void applyRange(FULL_UHF.startMhz, FULL_UHF.endMhz)
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
    void applyRange(FULL_UHF.startMhz, FULL_UHF.endMhz)
    setHint('Rango UHF completo')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <FrequencyRangeControls
        onRangeApplied={resetTraces}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomSelected={zoomToSelected}
        onFitDevices={fitDevices}
        onResetZoom={resetZoom}
      />

      <div
        ref={containerRef}
        className="relative min-h-[260px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
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
        <p className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-[#0d1117]/85 px-2 py-1 font-mono text-[10px] text-slate-400">
          {hint}
        </p>
      </div>
      {showWaterfall ? (
        <div
          ref={waterfallContainerRef}
          className="relative h-44 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] md:h-56"
        >
          <canvas
            ref={waterfallCanvasRef}
            className="absolute inset-0 h-full w-full"
          />
          <div className="pointer-events-none absolute top-2 left-2 rounded-md bg-[#0d1117]/80 px-2 py-0.5 font-mono text-[10px] tracking-wider text-teal-300/80 uppercase">
            Cascada
          </div>
        </div>
      ) : null}
    </div>
  )
}
