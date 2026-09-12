import { formatFrequencyMhz, STORAGE_KEYS } from '@/utils/constants'
import { LISTEN_DEMODS, type ListenDemod, type RfListenBand } from '@/types/audio'

export function ListenDemodButtons({
  value,
  onChange,
  compact = false,
}: {
  value: ListenDemod
  onChange: (mode: ListenDemod) => void
  compact?: boolean
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Modo de escucha">
      {LISTEN_DEMODS.map((item) => {
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            title={item.hint}
            onClick={() => {
              onChange(item.id)
              try {
                localStorage.setItem(STORAGE_KEYS.listenDemod, item.id)
              } catch {
                /* ignore */
              }
            }}
            className={[
              'rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase',
              active
                ? 'border-amber-400/50 bg-amber-400/20 text-amber-200'
                : 'border-white/10 text-slate-400 hover:text-slate-200',
              compact ? '' : 'px-2',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function ListenBar({
  band,
  volume,
  onVolume,
  onStop,
  demod,
  onDemod,
  mode = 'simulated',
}: {
  band: RfListenBand
  volume: number
  onVolume: (v: number) => void
  onStop: () => void
  demod: ListenDemod
  onDemod: (mode: ListenDemod) => void
  mode?: 'sdr' | 'simulated' | 'idle'
}) {
  const span = band.endMhz - band.startMhz
  const center = (band.startMhz + band.endMhz) / 2
  const active = LISTEN_DEMODS.find((d) => d.id === demod)

  return (
    <div className="flex min-h-0 min-w-0 flex-wrap items-center gap-2 rounded-xl border border-amber-400/30 bg-[#141414]/95 px-2.5 py-1.5 shadow-2xl shadow-black/40 backdrop-blur-md">
      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-amber-300 uppercase">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
        {mode === 'sdr' ? `${demod.toUpperCase()} SDR` : 'Escuchando'}
      </span>
      <ListenDemodButtons value={demod} onChange={onDemod} compact />
      <span className="font-mono text-sm text-amber-100">
        {formatFrequencyMhz(center)} ± {(span / 2).toFixed(span < 1 ? 3 : 1)}
      </span>
      <span className="font-mono text-[11px] text-amber-200/70">
        {active?.hint ?? ''}
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
