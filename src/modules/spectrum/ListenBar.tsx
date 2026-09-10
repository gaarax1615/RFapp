import { formatFrequencyMhz } from '@/utils/constants'
import type { RfListenBand } from '@/types/audio'

export function ListenBar({
  band,
  volume,
  onVolume,
  onStop,
}: {
  band: RfListenBand
  volume: number
  onVolume: (v: number) => void
  onStop: () => void
}) {
  const span = band.endMhz - band.startMhz
  const center = (band.startMhz + band.endMhz) / 2

  return (
    <div className="flex min-h-0 min-w-0 flex-wrap items-center gap-2 rounded-xl border border-amber-400/30 bg-[#1a1610]/95 px-2.5 py-1.5 shadow-2xl shadow-black/40 backdrop-blur-md">
      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-amber-300 uppercase">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
        Escuchando
      </span>
      <span className="font-mono text-sm text-amber-100">
        {formatFrequencyMhz(center)} ± {(span / 2).toFixed(span < 1 ? 3 : 1)}
      </span>
      <span className="font-mono text-[11px] text-amber-200/70">
        {band.startMhz.toFixed(3)}–{band.endMhz.toFixed(3)} MHz
      </span>
      <label className="ml-auto flex items-center gap-2 text-[11px] text-amber-200/80">
        Vol
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="w-24 accent-amber-300"
        />
      </label>
      <button
        type="button"
        onClick={onStop}
        className="rounded-md border border-amber-400/40 px-2 py-0.5 font-mono text-[11px] text-amber-200 hover:bg-amber-400/15"
      >
        Detener
      </button>
    </div>
  )
}
