/**
 * Stream continuo con ring buffer.
 * Si falta data (underrun), sostiene la última muestra en vez de silencio a tirones.
 */

const RING = 48_000 // ~3 s a 16 kHz
const PRIME_S = 0.15 // espera 150 ms de audio antes de empezar a reproducir

export class PcmPlayer {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private node: ScriptProcessorNode | null = null
  private ring = new Float32Array(RING)
  private write = 0
  private read = 0
  private filled = 0
  private primed = false
  private lastSample = 0
  private volume = 0.45

  async start(): Promise<void> {
    await this.stop()
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    try {
      this.ctx = new Ctx({ sampleRate: 16000 })
    } catch {
      this.ctx = new Ctx()
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.gain = this.ctx.createGain()
    this.gain.gain.value = this.volume
    this.gain.connect(this.ctx.destination)
    const block = 1024
    this.node = this.ctx.createScriptProcessor(block, 1, 1)
    this.node.onaudioprocess = (ev) => {
      this.pull(ev.outputBuffer.getChannelData(0))
    }
    this.node.connect(this.gain)
    this.write = 0
    this.read = 0
    this.filled = 0
    this.primed = false
    this.lastSample = 0
  }

  async stop(): Promise<void> {
    this.node?.disconnect()
    this.node = null
    if (this.ctx) await this.ctx.close().catch(() => undefined)
    this.ctx = null
    this.gain = null
    this.primed = false
    this.filled = 0
  }

  push(samples: Float32Array, sampleRate: number): void {
    const ctx = this.ctx
    if (!ctx || samples.length === 0) return
    const data =
      Math.abs(ctx.sampleRate - sampleRate) < 1
        ? samples
        : resampleLinear(samples, sampleRate, ctx.sampleRate)
    for (let i = 0; i < data.length; i++) {
      this.ring[this.write] = data[i] ?? 0
      this.write = (this.write + 1) % RING
      if (this.filled < RING) this.filled += 1
      else this.read = (this.read + 1) % RING
    }
    if (!this.primed && this.filled >= Math.floor(ctx.sampleRate * PRIME_S)) {
      this.primed = true
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    const now = this.ctx?.currentTime ?? 0
    this.gain?.gain.setTargetAtTime(this.volume, now, 0.04)
  }

  getVolume(): number {
    return this.volume
  }

  private pull(out: Float32Array): void {
    if (!this.primed) {
      out.fill(0)
      return
    }
    for (let i = 0; i < out.length; i++) {
      if (this.filled <= 0) {
        // Falta data: no pongas silencio (clics). Sostén la última muestra.
        out[i] = this.lastSample * 0.92
        this.lastSample = out[i] ?? 0
        continue
      }
      const s = this.ring[this.read] ?? 0
      out[i] = s
      this.lastSample = s
      this.read = (this.read + 1) % RING
      this.filled -= 1
    }
  }
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (input.length < 2 || fromRate <= 0) return input
  const ratio = fromRate / toRate
  const n = Math.max(1, Math.floor(input.length / ratio))
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const src = i * ratio
    const i0 = Math.min(input.length - 2, Math.floor(src))
    const frac = src - i0
    const a = input[i0] ?? 0
    const b = input[i0 + 1] ?? a
    out[i] = a + (b - a) * frac
  }
  return out
}

export function decodePcm16Base64(b64: string): Float32Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const aligned = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(aligned).set(bytes)
  const i16 = new Int16Array(aligned)
  const out = new Float32Array(i16.length)
  for (let i = 0; i < i16.length; i++) out[i] = i16[i] / 32768
  return out
}
