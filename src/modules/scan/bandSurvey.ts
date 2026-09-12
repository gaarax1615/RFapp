import type { SpectrumFrame } from '@/types/spectrum'
import type { SpectrumService } from '@/services/SpectrumService'
import { energyAtMhz, occupiedFromFrame } from './scanSpectrum'
import {
  kitPrimaryViewRange,
  kitSurveyWindows,
  type MhzRange,
} from './eventKit'

/** Acumula el máximo de energía visto en cada zona durante el barrido. */
export class EnergyAtlas {
  private readonly samples: { mhz: number; db: number }[] = []
  private blocked: number[] = []
  private floorSamples: number[] = []

  ingest(frame: SpectrumFrame): void {
    const n = frame.powerDb.length
    if (n < 8) return
    const step = Math.max(1, Math.floor(n / 512))
    for (let i = 0; i < n; i += step) {
      const mhz = frame.startFrequencyMhz + i * frame.binWidthMhz
      const db = frame.powerDb[i] ?? -160
      this.samples.push({ mhz, db })
      this.floorSamples.push(db)
    }
    for (const peak of occupiedFromFrame(frame)) {
      if (!this.blocked.some((b) => Math.abs(b - peak) < 0.2)) {
        this.blocked.push(peak)
      }
    }
  }

  score(mhz: number): number {
    let peak = -160
    for (const s of this.samples) {
      if (Math.abs(s.mhz - mhz) <= 0.15 && s.db > peak) peak = s.db
    }
    if (peak > -159) return peak
    // Sin muestra cercana: neutro (no sesgar)
    return 0
  }

  blockedPeaks(): number[] {
    return [...this.blocked]
  }

  /** Solo picos claros (portadoras), no ventanas sucias del peak-hold. */
  strongPeaks(minAboveFloorDb = 14): number[] {
    const floor = this.noiseFloorDb()
    const peaks: number[] = []
    for (const s of this.samples) {
      if (s.db < floor + minAboveFloorDb) continue
      if (peaks.some((p) => Math.abs(p - s.mhz) < 0.25)) continue
      peaks.push(s.mhz)
    }
    return peaks
  }

  noiseFloorDb(): number {
    if (this.floorSamples.length === 0) return -100
    const sorted = [...this.floorSamples].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.2)] ?? -100
  }

  sampleCount(): number {
    return this.samples.length
  }
}

export interface SurveyProgress {
  windowIndex: number
  windowCount: number
  startMhz: number
  endMhz: number
  message: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForPasses(
  spectrum: SpectrumService,
  atlas: EnergyAtlas,
  passes: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const start = Date.now()
  let seenHops = 0
  let lastHop = -1
  let targetHops = 0

  await new Promise<void>((resolve, reject) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      unsub()
      resolve()
    }
    const unsub = spectrum.subscribe((frame) => {
      if (signal?.aborted) {
        unsub()
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      atlas.ingest(frame)
      const hops = frame.hopCount ?? 1
      const idx = frame.hopIndex ?? 0
      if (targetHops === 0) targetHops = Math.max(1, hops) * passes
      if (idx !== lastHop) {
        lastHop = idx
        seenHops += 1
      }
      if (seenHops >= targetHops || Date.now() - start > timeoutMs) {
        finish()
      }
    })
    void sleep(timeoutMs).then(finish)
  })
}

export async function surveyKitBands(options: {
  spectrum: SpectrumService
  catalogIds: string[]
  onProgress?: (p: SurveyProgress) => void
  signal?: AbortSignal
  passesPerWindow?: number
}): Promise<{ atlas: EnergyAtlas; viewRange: MhzRange | null }> {
  const { spectrum, catalogIds, onProgress, signal } = options
  const passes = options.passesPerWindow ?? 2
  const windows = kitSurveyWindows(catalogIds)
  const atlas = new EnergyAtlas()
  const viewRange = kitPrimaryViewRange(catalogIds)

  if (windows.length === 0) {
    return { atlas, viewRange }
  }

  for (let i = 0; i < windows.length; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const win = windows[i]!
    onProgress?.({
      windowIndex: i,
      windowCount: windows.length,
      startMhz: win.startMhz,
      endMhz: win.endMhz,
      message: `Barriendo ${win.startMhz.toFixed(0)}–${win.endMhz.toFixed(0)} MHz (${i + 1}/${windows.length})…`,
    })
    await spectrum.setRange(win.startMhz, win.endMhz)
    // Dejar que el peak-hold se llene
    await sleep(400)
    await waitForPasses(spectrum, atlas, passes, 14_000, signal)
  }

  if (viewRange) {
    await spectrum.setRange(viewRange.startMhz, viewRange.endMhz)
  }

  return { atlas, viewRange }
}

/** Score desde un frame suelto (cálculo rápido sin survey). */
export function scoreFromFrame(frame: SpectrumFrame | null): (mhz: number) => number {
  if (!frame) return () => 0
  return (mhz) => energyAtMhz(frame, mhz)
}
