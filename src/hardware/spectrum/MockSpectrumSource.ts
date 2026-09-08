import { DEFAULT_SPECTRUM_CONFIG } from '@/utils/constants'
import {
  MOCK_CARRIERS,
  MOCK_NOISE_BANDS,
  MOCK_SPECTRUM_PARAMS,
  type SimulatedCarrier,
  type SimulatedNoiseBand,
} from '@/data'
import type {
  HardwareStatus,
  SpectrumConfig,
  SpectrumFrame,
  SpectrumSource,
} from '@/types/spectrum'

/**
 * Genera frames de espectro UHF realistas a partir de datos en `src/data`.
 * Sustituible por RTLSDRSource / HackRFSource sin tocar la UI.
 */
export class MockSpectrumSource implements SpectrumSource {
  readonly id = 'mock-spectrum'
  readonly label = 'SDR simulado'

  private config: SpectrumConfig = { ...DEFAULT_SPECTRUM_CONFIG }
  private listeners = new Set<(frame: SpectrumFrame) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private carriers: SimulatedCarrier[] = []
  private noiseBands: SimulatedNoiseBand[] = []
  private baselineNoise: Float32Array | null = null
  private interferenceUntil = 0
  private interferenceCenter = 0
  private frameCount = 0
  private timeSec = 0

  async start(config: SpectrumConfig): Promise<void> {
    this.config = { ...config }
    this.seedEnvironment()
    if (this.timer) clearInterval(this.timer)
    this.running = true
    const intervalMs = Math.max(16, Math.round(1000 / config.updateRateHz))
    this.timer = setInterval(() => this.emitFrame(), intervalMs)
    this.emitFrame()
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  subscribe(listener: (frame: SpectrumFrame) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus(): HardwareStatus {
    return {
      state: this.running ? 'simulated' : 'disconnected',
      deviceName: this.running ? 'Generador de espectro simulado' : null,
      message: this.running
        ? 'Datos simulados — sin hardware SDR'
        : 'Fuente detenida',
      lastFrameAt: this.frameCount > 0 ? Date.now() : undefined,
    }
  }

  private seedEnvironment(): void {
    const { startFrequencyMhz, endFrequencyMhz, binCount } = this.config
    this.carriers = MOCK_CARRIERS.map((c) => ({ ...c }))
    this.noiseBands = MOCK_NOISE_BANDS.map((b) => ({ ...b }))

    this.baselineNoise = new Float32Array(binCount)
    let walk = 0
    for (let i = 0; i < binCount; i++) {
      walk += (Math.random() - 0.5) * 0.35
      walk *= 0.98
      const freq =
        startFrequencyMhz + (i / binCount) * (endFrequencyMhz - startFrequencyMhz)
      const rollOff =
        freq < startFrequencyMhz + 8
          ? ((freq - startFrequencyMhz) / 8) * 8 - 8
          : freq > endFrequencyMhz - 8
            ? ((endFrequencyMhz - freq) / 8) * 8 - 8
            : 0
      this.baselineNoise[i] = walk + rollOff
    }
  }

  private emitFrame(): void {
    if (!this.running) return
    this.frameCount += 1
    const now = Date.now()
    this.timeSec = now / 1000
    const { startFrequencyMhz, endFrequencyMhz, binCount } = this.config
    const binWidthMhz = (endFrequencyMhz - startFrequencyMhz) / binCount
    const powerDb = new Float32Array(binCount)
    const baseline = this.baselineNoise
    const params = MOCK_SPECTRUM_PARAMS

    const noiseFloor =
      params.noiseFloorDb + Math.sin(this.timeSec * 0.15) * params.noiseFloorDrift

    if (Math.random() < params.interferenceChance) {
      const spanMs =
        params.interferenceDurationMsMin +
        Math.random() *
          (params.interferenceDurationMsMax - params.interferenceDurationMsMin)
      this.interferenceUntil = now + spanMs
      this.interferenceCenter =
        startFrequencyMhz + Math.random() * (endFrequencyMhz - startFrequencyMhz)
    }

    for (let i = 0; i < binCount; i++) {
      const freq = startFrequencyMhz + i * binWidthMhz

      const rayleigh = -10 * Math.log10(-Math.log(Math.max(1e-9, Math.random())))
      let power =
        noiseFloor +
        (baseline?.[i] ?? 0) +
        Math.min(12, rayleigh) -
        5 +
        (Math.random() - 0.5) * 0.8

      for (const band of this.noiseBands) {
        if (freq >= band.startMhz && freq <= band.endMhz) {
          const edge = Math.min(
            (freq - band.startMhz) / 1.5,
            (band.endMhz - freq) / 1.5,
            1,
          )
          power += band.liftDb * Math.max(0, edge) + (Math.random() - 0.5)
        }
      }

      for (const carrier of this.carriers) {
        const fade =
          Math.sin(this.timeSec * carrier.fadeHz + carrier.phase) * 1.8 +
          Math.sin(this.timeSec * carrier.fadeHz * 2.7 + carrier.phase) * 0.6
        const peak = carrier.peakDb + fade
        const contrib = shapeContribution(freq, carrier, peak)
        if (contrib > power) power = contrib
        else power = maxDbPower(power, contrib)
      }

      if (now < this.interferenceUntil) {
        const dx = Math.abs(freq - this.interferenceCenter)
        if (dx < params.interferenceWidthMhz) {
          const burst =
            params.interferencePeakDb -
            (dx / params.interferenceWidthMhz) * 35 +
            Math.sin(this.timeSec * 40 + freq) * 3 +
            (Math.random() - 0.5) * 4
          power = maxDbPower(power, burst)
        }
      }

      powerDb[i] = power
    }

    const frame: SpectrumFrame = {
      timestamp: now,
      startFrequencyMhz,
      endFrequencyMhz,
      binWidthMhz,
      powerDb,
    }

    for (const listener of this.listeners) {
      listener(frame)
    }
  }
}

function maxDbPower(a: number, b: number): number {
  const m = Math.max(a, b)
  return m + Math.log1p(Math.exp(-Math.abs(a - b))) * 0.15
}

function shapeContribution(
  freq: number,
  carrier: SimulatedCarrier,
  peakDb: number,
): number {
  const dx = freq - carrier.frequencyMhz
  const half = carrier.bwMhz / 2

  switch (carrier.shape) {
    case 'digital': {
      const flat = half * 0.55
      const abs = Math.abs(dx)
      if (abs <= flat) {
        return peakDb + (Math.random() - 0.5) * 1.2
      }
      const skirt = (abs - flat) / (half * 1.8)
      if (skirt > 4) return -160
      return peakDb - 6 - skirt * skirt * 18
    }
    case 'wide': {
      const abs = Math.abs(dx)
      if (abs > half) {
        const skirt = (abs - half) / 0.8
        if (skirt > 5) return -160
        return peakDb - 8 - skirt * 12
      }
      const ripple = Math.sin(dx * 8) * 1.5
      return peakDb - 2 + ripple + (Math.random() - 0.5) * 2
    }
    case 'spur': {
      const sigma = Math.max(0.02, half)
      const g = Math.exp(-0.5 * (dx / sigma) ** 2)
      if (g < 0.001) return -160
      return peakDb + 10 * Math.log10(g)
    }
    case 'narrow':
    default: {
      const sigma = Math.max(0.04, half * 0.7)
      const g = 1 / (1 + (dx / sigma) ** 2)
      if (g < 0.002) return -160
      return peakDb + 10 * Math.log10(g) + 3
    }
  }
}
