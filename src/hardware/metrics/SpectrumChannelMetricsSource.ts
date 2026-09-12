import type { ChannelMetrics, ChannelMetricsSource, SignalStatus } from '@/types/monitor'
import type { RfDevice } from '@/types/device'
import type { SpectrumFrame } from '@/types/spectrum'
import type { DeviceService } from '@/services/DeviceService'
import type { SpectrumService } from '@/services/SpectrumService'

interface Track {
  history: { t: number; signal: number }[]
  /** Solo visitas con portadora; el encendido del TX no cuenta como “inestable”. */
  onAir: { t: number; signal: number }[]
  lastSignal: number | null
  lastMetrics: ChannelMetrics | null
}

const HALF_CHANNEL_MHZ = 0.15
const NOISE_INNER_MHZ = 0.28
const NOISE_OUTER_MHZ = 1.2
const HISTORY_MAX = 240
const FRESH_UP_DB = 0.45
const FRESH_DOWN_DB = 1.4
const EMPTYISH_DB = -93
/** Por encima del pasto local = el inalámbrico está al aire. */
const CARRIER_SNR_DB = 8
const GOOD_SNR_DB = 14
const WEAK_SNR_DB = 10

/**
 * Métricas reales desde el espectro SDR: nivel, SNR y estabilidad por frecuencia.
 * En barrido UHF solo cuenta una visita al hop (ignora el decay del peak-hold).
 */
export class SpectrumChannelMetricsSource implements ChannelMetricsSource {
  private listeners = new Set<(metrics: ChannelMetrics[]) => void>()
  private unsub: (() => void) | null = null
  private devices: RfDevice[] = []
  private tracks = new Map<string, Track>()
  private latest: ChannelMetrics[] = []

  constructor(
    private readonly spectrum: SpectrumService,
    private readonly deviceService: DeviceService,
  ) {}

  async start(deviceIds: string[]): Promise<void> {
    const all = await this.deviceService.list()
    this.devices = all.filter((d) => deviceIds.includes(d.id) && d.enabled)
    const keep = new Set(this.devices.map((d) => d.id))
    for (const id of [...this.tracks.keys()]) {
      if (!keep.has(id)) this.tracks.delete(id)
    }
    for (const d of this.devices) {
      if (!this.tracks.has(d.id)) {
        this.tracks.set(d.id, { history: [], onAir: [], lastSignal: null, lastMetrics: null })
      }
    }
    this.unsub?.()
    this.unsub = this.spectrum.subscribe((frame) => this.onFrame(frame))
    const latest = this.spectrum.getLatestFrame()
    if (latest) this.onFrame(latest)
  }

  async stop(): Promise<void> {
    this.unsub?.()
    this.unsub = null
  }

  subscribe(listener: (metrics: ChannelMetrics[]) => void): () => void {
    this.listeners.add(listener)
    if (this.latest.length) listener(this.latest)
    return () => this.listeners.delete(listener)
  }

  async getHistory(deviceId: string, windowMs: number): Promise<number[]> {
    const track = this.tracks.get(deviceId)
    if (!track) return []
    const cutoff = Date.now() - windowMs
    return track.history.filter((h) => h.t >= cutoff).map((h) => h.signal)
  }

  private onFrame(frame: SpectrumFrame): void {
    const now = Date.now()
    const metrics: ChannelMetrics[] = this.devices.map((device) => {
      const track = this.tracks.get(device.id) ?? {
        history: [],
        onAir: [],
        lastSignal: null,
        lastMetrics: null,
      }
      this.tracks.set(device.id, track)

      const covered =
        device.frequencyMhz >= frame.startFrequencyMhz &&
        device.frequencyMhz <= frame.endFrequencyMhz
      if (!covered) {
        return track.lastMetrics ?? placeholder(device.id, now)
      }

      const half = Math.max(HALF_CHANNEL_MHZ, (frame.binWidthMhz ?? 0.05) * 2)
      const signalDbm = peakNear(frame, device.frequencyMhz, half)
      const noiseFloorDbm = localNoise(frame, device.frequencyMhz)
      const liveSnr = signalDbm - noiseFloorDbm
      const hopCovers = hopCoversMhz(frame, device.frequencyMhz)
      const fresh = hopCovers || isFreshSample(track.lastSignal, signalDbm)

      if (fresh) {
        track.lastSignal = signalDbm
        track.history.push({ t: now, signal: signalDbm })
        if (track.history.length > HISTORY_MAX) track.history.shift()
        if (liveSnr >= CARRIER_SNR_DB) {
          track.onAir.push({ t: now, signal: signalDbm })
          if (track.onAir.length > HISTORY_MAX) track.onAir.shift()
        }
      }

      const signal = fresh || !track.lastMetrics ? signalDbm : track.lastMetrics.signalDbm
      const snrDb = fresh || !track.lastMetrics ? liveSnr : track.lastMetrics.snrDb
      const stabilityDb = stddev(track.onAir.slice(-16).map((h) => h.signal))
      const next: ChannelMetrics = {
        deviceId: device.id,
        timestamp: now,
        signalDbm: signal,
        noiseFloorDbm,
        snrDb,
        stabilityDb,
        sampleCount: track.history.length,
        status: deriveStatus(snrDb, stabilityDb, track.onAir.length),
      }
      track.lastMetrics = next
      return next
    })
    this.latest = metrics
    for (const listener of this.listeners) listener(metrics)
  }
}

function placeholder(deviceId: string, timestamp: number): ChannelMetrics {
  return {
    deviceId,
    timestamp,
    signalDbm: -160,
    noiseFloorDbm: -100,
    snrDb: 0,
    stabilityDb: 0,
    sampleCount: 0,
    status: 'NO_SIGNAL',
  }
}

function isFreshSample(last: number | null, next: number): boolean {
  if (next <= EMPTYISH_DB && (last === null || last <= EMPTYISH_DB)) return false
  if (last === null) return true
  const delta = next - last
  return delta >= FRESH_UP_DB || delta <= -FRESH_DOWN_DB
}

function peakNear(frame: SpectrumFrame, freqMhz: number, halfMhz: number): number {
  const [i0, i1] = binRange(frame, freqMhz - halfMhz, freqMhz + halfMhz)
  let peak = -160
  for (let i = i0; i <= i1; i++) {
    const v = frame.powerDb[i] ?? -160
    if (v > peak) peak = v
  }
  return peak
}

function localNoise(frame: SpectrumFrame, freqMhz: number): number {
  const [o0, o1] = binRange(frame, freqMhz - NOISE_OUTER_MHZ, freqMhz + NOISE_OUTER_MHZ)
  const [c0, c1] = binRange(frame, freqMhz - NOISE_INNER_MHZ, freqMhz + NOISE_INNER_MHZ)
  const sample: number[] = []
  for (let i = o0; i <= o1; i++) {
    if (i >= c0 && i <= c1) continue
    const v = frame.powerDb[i]
    if (v !== undefined && v > EMPTYISH_DB) sample.push(v)
  }
  if (sample.length < 4) return percentile(frame.powerDb, 0.2)
  sample.sort((a, b) => a - b)
  return sample[Math.floor(sample.length * 0.3)] ?? sample[0] ?? -100
}

function binRange(
  frame: SpectrumFrame,
  fromMhz: number,
  toMhz: number,
): [number, number] {
  const span = frame.endFrequencyMhz - frame.startFrequencyMhz
  const n = frame.powerDb.length
  if (span <= 0 || n < 2) return [0, 0]
  const i0 = Math.max(0, Math.floor(((fromMhz - frame.startFrequencyMhz) / span) * n))
  const i1 = Math.min(n - 1, Math.ceil(((toMhz - frame.startFrequencyMhz) / span) * n))
  return [i0, i1]
}

function percentile(bins: Float32Array, p: number): number {
  if (bins.length === 0) return -100
  const step = Math.max(1, Math.floor(bins.length / 256))
  const sample: number[] = []
  for (let i = 0; i < bins.length; i += step) sample.push(bins[i] ?? -100)
  sample.sort((a, b) => a - b)
  return sample[Math.floor((sample.length - 1) * p)] ?? -100
}

function stddev(values: number[]): number {
  if (values.length < 3) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const varSum = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(varSum)
}

function hopCoversMhz(frame: SpectrumFrame, freqMhz: number): boolean {
  const lo = frame.hopStartMhz
  const hi = frame.hopEndMhz
  if (lo == null || hi == null) return false
  return freqMhz >= lo && freqMhz <= hi
}

function deriveStatus(
  snrDb: number,
  stabilityDb: number,
  onAirCount: number,
): SignalStatus {
  if (snrDb < CARRIER_SNR_DB) return 'NO_SIGNAL'
  if (snrDb < WEAK_SNR_DB) return 'INTERFERENCE'
  if (snrDb < GOOD_SNR_DB || (onAirCount >= 4 && stabilityDb > 6)) return 'WARNING'
  return 'GOOD'
}
