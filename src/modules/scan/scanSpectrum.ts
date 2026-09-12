import type { SpectrumFrame } from '@/types/spectrum'

export function occupiedFromFrame(frame: SpectrumFrame): number[] {
  const bins = frame.powerDb
  const n = bins.length
  if (n < 8) return []
  const sample: number[] = []
  const step = Math.max(1, Math.floor(n / 400))
  for (let i = 0; i < n; i += step) sample.push(bins[i] ?? -160)
  sample.sort((a, b) => a - b)
  const noise = sample[Math.floor(sample.length * 0.2)] ?? -100
  const thresh = noise + 12
  const peaks: number[] = []
  const win = 4
  for (let i = win; i < n - win; i++) {
    const v = bins[i] ?? -160
    if (v < thresh) continue
    let isMax = true
    for (let k = i - win; k <= i + win; k++) {
      if (k !== i && (bins[k] ?? -160) > v) {
        isMax = false
        break
      }
    }
    if (!isMax) continue
    const freq = frame.startFrequencyMhz + i * frame.binWidthMhz
    if (peaks.some((p) => Math.abs(p - freq) < 0.35)) continue
    peaks.push(freq)
  }

  const span = frame.endFrequencyMhz - frame.startFrequencyMhz
  const dirty: number[] = []
  const winMhz = 0.4
  const winBins = Math.max(4, Math.round((winMhz / span) * n))
  for (let i = 0; i < n; i += Math.max(1, Math.floor(winBins / 2))) {
    let sum = 0
    let count = 0
    for (let k = i; k < Math.min(n, i + winBins); k++) {
      sum += bins[k] ?? -160
      count++
    }
    if (count === 0) continue
    if (sum / count > noise + 10) {
      dirty.push(frame.startFrequencyMhz + i * frame.binWidthMhz)
    }
  }
  return [...peaks, ...dirty]
}

export function energyAtMhz(frame: SpectrumFrame, freqMhz: number, halfMhz = 0.15): number {
  const span = frame.endFrequencyMhz - frame.startFrequencyMhz
  const n = frame.powerDb.length
  if (span <= 0 || n < 2) return 0
  const i0 = Math.max(0, Math.floor(((freqMhz - halfMhz - frame.startFrequencyMhz) / span) * n))
  const i1 = Math.min(n - 1, Math.ceil(((freqMhz + halfMhz - frame.startFrequencyMhz) / span) * n))
  let peak = -160
  for (let i = i0; i <= i1; i++) {
    const v = frame.powerDb[i] ?? -160
    if (v > peak) peak = v
  }
  return peak
}
