import { useRef, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import { SPECTRUM_PAD, RTA_SENSITIVITY, clampRtaSensitivity } from './spectrumRange'

export function RtaSensitivityControl({
  value,
  minDb,
  maxDb,
  onChange,
  onChangeEnd,
}: {
  value: number
  minDb: number
  maxDb: number
  onChange: (value: number) => void
  onChangeEnd?: (value: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const applyFromClientY = (clientY: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.height <= 0) return
    const t = (rect.bottom - clientY) / rect.height
    onChange(clampRtaSensitivity(t * 100))
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    applyFromClientY(event.clientY)

    const onMove = (ev: globalThis.PointerEvent) => {
      applyFromClientY(ev.clientY)
    }
    const onUp = (ev: globalThis.PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      onChangeEnd?.(valueRef.current)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const next = clampRtaSensitivity(value + (event.deltaY < 0 ? 4 : -4))
    onChange(next)
    onChangeEnd?.(next)
  }

  const onDoubleClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onChange(RTA_SENSITIVITY.default)
    onChangeEnd?.(RTA_SENSITIVITY.default)
  }

  return (
    <div
      className="pointer-events-auto absolute z-20 flex flex-col items-center gap-1"
      style={{
        left: 2,
        top: SPECTRUM_PAD.top,
        bottom: SPECTRUM_PAD.bottom + 4,
        width: 22,
      }}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      title="Arrastra: sensibilidad del RTA · rueda · doble clic restablece"
    >
      <span className="pointer-events-none font-mono text-[7px] tracking-[0.14em] text-slate-500 uppercase">
        Sens
      </span>
      <div
        ref={trackRef}
        role="slider"
        aria-label="Sensibilidad del RTA"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${Math.round(minDb)} a ${Math.round(maxDb)} dB`}
        className="group relative w-3 min-h-0 flex-1 cursor-ns-resize touch-none rounded-full bg-white/10"
      >
        <div
          className="absolute inset-x-0 bottom-0 rounded-full bg-teal-400/45 group-hover:bg-teal-400/70"
          style={{ height: `${value}%` }}
        />
        <div
          className="absolute left-1/2 h-2.5 w-4 -translate-x-1/2 rounded-sm bg-teal-100 shadow shadow-black/40"
          style={{ bottom: `calc(${value}% - 5px)` }}
        />
      </div>
      <span className="pointer-events-none font-mono text-[8px] leading-none text-slate-500">
        {value}
      </span>
    </div>
  )
}
