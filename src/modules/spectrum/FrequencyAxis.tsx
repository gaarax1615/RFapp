import { SPECTRUM_PAD, frequencyTicks } from './spectrumRange'

export function FrequencyAxis({
  startMhz,
  endMhz,
}: {
  startMhz: number
  endMhz: number
}) {
  const span = endMhz - startMhz
  const ticks = span > 0 ? frequencyTicks(startMhz, endMhz) : []

  return (
    <div className="relative h-6 shrink-0 bg-[#0d1117]">
      <div
        className="relative h-full"
        style={{
          marginLeft: SPECTRUM_PAD.left,
          marginRight: SPECTRUM_PAD.right,
        }}
      >
        {ticks.map((tick) => (
          <span
            key={tick.mhz}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-400"
            style={{ left: `${tick.t * 100}%` }}
          >
            {Number.isInteger(tick.mhz) ? tick.mhz.toFixed(0) : tick.mhz.toFixed(1)}
          </span>
        ))}
      </div>
    </div>
  )
}
