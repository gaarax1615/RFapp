import type {
  HardwareStatus,
  SpectrumConfig,
  SpectrumFrame,
  SpectrumSource,
} from '@/types/spectrum'
import { DEFAULT_SPECTRUM_CONFIG } from '@/utils/constants'

/**
 * Application-facing spectrum facade. UI subscribes here,
 * never to a concrete SpectrumSource implementation.
 */
export class SpectrumService {
  private source: SpectrumSource
  private unsubSource: (() => void) | null = null
  private listeners = new Set<(frame: SpectrumFrame) => void>()
  private latestFrame: SpectrumFrame | null = null
  private config: SpectrumConfig = { ...DEFAULT_SPECTRUM_CONFIG }
  private onViewReset: (() => void) | null = null

  constructor(source: SpectrumSource) {
    this.source = source
  }

  setViewReset(handler: () => void): void {
    this.onViewReset = handler
  }

  getConfig(): SpectrumConfig {
    return { ...this.config }
  }

  getLatestFrame(): SpectrumFrame | null {
    return this.latestFrame
  }

  getStatus(): HardwareStatus {
    return this.source.getStatus()
  }

  getSourceLabel(): string {
    return this.source.label
  }

  getSourceId(): string {
    return this.source.id
  }

  async setSource(source: SpectrumSource, config?: SpectrumConfig): Promise<void> {
    this.onViewReset?.()
    this.latestFrame = null
    await this.stop()
    this.source = source
    if (config) this.config = { ...config }
    await this.start(this.config)
  }

  async setRange(startFrequencyMhz: number, endFrequencyMhz: number): Promise<boolean> {
    if (
      this.config.startFrequencyMhz === startFrequencyMhz &&
      this.config.endFrequencyMhz === endFrequencyMhz
    ) {
      return false
    }
    await this.start({
      ...this.config,
      startFrequencyMhz,
      endFrequencyMhz,
    })
    return true
  }

  async start(config?: SpectrumConfig): Promise<void> {
    if (config) this.config = { ...config }
    await this.source.stopListen?.()
    if (!this.unsubSource) {
      this.unsubSource = this.source.subscribe((frame) => {
        this.latestFrame = frame
        for (const listener of this.listeners) listener(frame)
      })
    }
    await this.source.start(this.config)
  }

  async stop(): Promise<void> {
    this.unsubSource?.()
    this.unsubSource = null
    await this.source.stop()
  }

  subscribe(listener: (frame: SpectrumFrame) => void): () => void {
    this.listeners.add(listener)
    if (this.latestFrame) listener(this.latestFrame)
    return () => this.listeners.delete(listener)
  }

  canIqListen(): boolean {
    if (typeof this.source.listen !== 'function') return false
    return this.source.getStatus().state === 'connected'
  }

  async listen(
    band: { startMhz: number; endMhz: number },
    demod: 'nfm' | 'wfm' | 'am' = 'nfm',
  ): Promise<void> {
    if (!this.source.listen) {
      throw new Error('Esta fuente no demodula audio SDR')
    }
    await this.source.listen(band, demod)
  }

  async stopListen(): Promise<void> {
    await this.source.stopListen?.()
  }

  subscribeAudio(
    listener: (samples: Float32Array, sampleRate: number) => void,
  ): () => void {
    if (!this.source.subscribeAudio) return () => undefined
    return this.source.subscribeAudio(listener)
  }
}
