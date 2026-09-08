export type HardwareConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'simulated'

export interface HardwareStatus {
  state: HardwareConnectionState
  deviceName: string | null
  message?: string
  lastFrameAt?: number
}

export interface SpectrumConfig {
  startFrequencyMhz: number
  endFrequencyMhz: number
  binCount: number
  updateRateHz: number
}

export interface SpectrumFrame {
  timestamp: number
  startFrequencyMhz: number
  endFrequencyMhz: number
  binWidthMhz: number
  /** Relative dB or estimated dBm after calibration */
  powerDb: Float32Array
}

export interface SpectrumSource {
  readonly id: string
  readonly label: string
  start(config: SpectrumConfig): Promise<void>
  stop(): Promise<void>
  subscribe(listener: (frame: SpectrumFrame) => void): () => void
  getStatus(): HardwareStatus
}
