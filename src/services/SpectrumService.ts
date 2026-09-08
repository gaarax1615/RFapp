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

  constructor(source: SpectrumSource) {
    this.source = source
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
    await this.stop()
    this.source = source
    if (config) this.config = { ...config }
    await this.start(this.config)
  }

  async setRange(startFrequencyMhz: number, endFrequencyMhz: number): Promise<void> {
    await this.start({
      ...this.config,
      startFrequencyMhz,
      endFrequencyMhz,
    })
  }

  async start(config?: SpectrumConfig): Promise<void> {
    if (config) this.config = { ...config }
    await this.source.stop()
    this.unsubSource?.()
    this.latestFrame = null
    this.unsubSource = this.source.subscribe((frame) => {
      this.latestFrame = frame
      for (const listener of this.listeners) listener(frame)
    })
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
}
