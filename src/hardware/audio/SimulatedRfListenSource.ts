import type { SpectrumFrame } from '@/types/spectrum'
import type {
  AudioMonitorStatus,
  RfListenBand,
  RfListenSource,
} from '@/types/audio'

interface BandStats {
  meanDb: number
  peakDb: number
  peakMhz: number
  occupancy: number
}

/**
 * Sonoriza la energía RF de una banda a partir de los frames de espectro.
 * Sustituible por demodulación real (SDR) sin cambiar la UI.
 */
export class SimulatedRfListenSource implements RfListenSource {
  readonly id = 'simulated-rf-listen'
  readonly label = 'Escucha RF simulada'

  private status: AudioMonitorStatus = 'idle'
  private band: RfListenBand | null = null
  private volume = 0.4
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private hissGain: GainNode | null = null
  private hashGain: GainNode | null = null
  private voiceGain: GainNode | null = null
  private toneGain: GainNode | null = null
  private tone: OscillatorNode | null = null
  private noiseNode: AudioBufferSourceNode | null = null

  async start(band: RfListenBand): Promise<void> {
    await this.stop()
    this.band = { ...band }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    this.ctx = new Ctx()
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }

    const ctx = this.ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(ctx.destination)

    const noise = ctx.createBufferSource()
    noise.buffer = makeNoiseBuffer(ctx, 1.5)
    noise.loop = true
    this.noiseNode = noise

    const hissFilter = ctx.createBiquadFilter()
    hissFilter.type = 'highpass'
    hissFilter.frequency.value = 1800
    hissFilter.Q.value = 0.7
    this.hissGain = ctx.createGain()
    this.hissGain.gain.value = 0.02
    noise.connect(hissFilter)
    hissFilter.connect(this.hissGain)
    this.hissGain.connect(this.master)

    const hashFilter = ctx.createBiquadFilter()
    hashFilter.type = 'bandpass'
    hashFilter.frequency.value = 2400
    hashFilter.Q.value = 3.5
    this.hashGain = ctx.createGain()
    this.hashGain.gain.value = 0
    noise.connect(hashFilter)
    hashFilter.connect(this.hashGain)
    this.hashGain.connect(this.master)

    const voice1 = ctx.createBiquadFilter()
    voice1.type = 'bandpass'
    voice1.frequency.value = 780
    voice1.Q.value = 1.1
    const voice2 = ctx.createBiquadFilter()
    voice2.type = 'bandpass'
    voice2.frequency.value = 1650
    voice2.Q.value = 0.9
    this.voiceGain = ctx.createGain()
    this.voiceGain.gain.value = 0
    noise.connect(voice1)
    voice1.connect(voice2)
    voice2.connect(this.voiceGain)
    this.voiceGain.connect(this.master)

    this.tone = ctx.createOscillator()
    this.tone.type = 'sine'
    this.tone.frequency.value = 520
    this.toneGain = ctx.createGain()
    this.toneGain.gain.value = 0
    this.tone.connect(this.toneGain)
    this.toneGain.connect(this.master)
    this.tone.start()

    noise.start()
    this.status = 'listening'
  }

  async stop(): Promise<void> {
    this.band = null
    this.status = 'idle'
    try {
      this.tone?.stop()
      this.noiseNode?.stop()
    } catch {
      /* already stopped */
    }
    this.tone = null
    this.noiseNode = null
    this.hissGain = null
    this.hashGain = null
    this.voiceGain = null
    this.toneGain = null
    this.master = null
    if (this.ctx) {
      await this.ctx.close().catch(() => undefined)
      this.ctx = null
    }
  }

  pushFrame(frame: SpectrumFrame): void {
    if (!this.band || !this.ctx || this.status !== 'listening') return
    const stats = analyzeBand(frame, this.band)
    if (!stats) return

    const now = this.ctx.currentTime
    const tau = 0.07
    const peakiness = stats.peakDb - stats.meanDb
    const energy = dbToUnit(stats.meanDb, -100, -40)
    const peakE = dbToUnit(stats.peakDb, -98, -32)

    this.hissGain?.gain.setTargetAtTime(0.018 + energy * 0.12, now, tau)

    const digital = peakiness > 12 && stats.occupancy > 0.12 && stats.occupancy < 0.55
    const analog = peakiness > 10 && stats.occupancy < 0.22
    const wide = stats.occupancy > 0.55

    this.hashGain?.gain.setTargetAtTime(
      digital ? peakE * 0.22 : wide ? energy * 0.08 : 0,
      now,
      tau,
    )

    if (this.voiceGain) {
      if (analog) {
        const mumble =
          0.5 + 0.5 * Math.abs(Math.sin(now * 3.4) * Math.sin(now * 1.6))
        this.voiceGain.gain.setTargetAtTime(
          (0.05 + peakE * 0.2) * mumble,
          now,
          0.05,
        )
      } else {
        this.voiceGain.gain.setTargetAtTime(0, now, tau)
      }
    }

    if (this.tone && this.toneGain) {
      const span = Math.max(0.001, this.band.endMhz - this.band.startMhz)
      const t = (stats.peakMhz - this.band.startMhz) / span
      const hz = 280 + t * 900
      this.tone.frequency.setTargetAtTime(hz, now, 0.05)
      const toneAmt = analog || digital ? peakE * (analog ? 0.07 : 0.04) : 0
      this.toneGain.gain.setTargetAtTime(toneAmt, now, tau)
    }
  }

  getBand(): RfListenBand | null {
    return this.band ? { ...this.band } : null
  }

  getStatus(): AudioMonitorStatus {
    return this.status
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    const now = this.ctx?.currentTime ?? 0
    this.master?.gain.setTargetAtTime(this.volume, now, 0.04)
  }

  getVolume(): number {
    return this.volume
  }
}

function analyzeBand(frame: SpectrumFrame, band: RfListenBand): BandStats | null {
  const span = frame.endFrequencyMhz - frame.startFrequencyMhz
  const n = frame.powerDb.length
  if (span <= 0 || n < 2) return null

  const i0 = Math.max(
    0,
    Math.floor(((band.startMhz - frame.startFrequencyMhz) / span) * n),
  )
  const i1 = Math.min(
    n - 1,
    Math.ceil(((band.endMhz - frame.startFrequencyMhz) / span) * n),
  )
  if (i1 < i0) return null

  let sum = 0
  let peak = -160
  let peakI = i0
  let hot = 0
  for (let i = i0; i <= i1; i++) {
    const v = frame.powerDb[i] ?? -160
    sum += v
    if (v > peak) {
      peak = v
      peakI = i
    }
  }
  const count = i1 - i0 + 1
  const mean = sum / count
  const thresh = peak - 6
  for (let i = i0; i <= i1; i++) {
    if ((frame.powerDb[i] ?? -160) >= thresh) hot += 1
  }

  return {
    meanDb: mean,
    peakDb: peak,
    peakMhz:
      frame.startFrequencyMhz + (peakI / Math.max(1, n - 1)) * span,
    occupancy: hot / count,
  }
}

function dbToUnit(db: number, lo: number, hi: number): number {
  const t = (db - lo) / (hi - lo)
  return Math.max(0, Math.min(1, t)) ** 1.35
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}
