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
  hopStartMhz?: number
  hopEndMhz?: number
  hopIndex?: number
  hopCount?: number
  passIndex?: number
}

export interface SpectrumSource {
  readonly id: string
  readonly label: string
  start(config: SpectrumConfig): Promise<void>
  stop(): Promise<void>
  subscribe(listener: (frame: SpectrumFrame) => void): () => void
  getStatus(): HardwareStatus
  listen?(
    band: { startMhz: number; endMhz: number },
    demod?: 'nfm' | 'wfm' | 'am',
  ): Promise<void>
  stopListen?(): Promise<void>
  subscribeAudio?(
    listener: (samples: Float32Array, sampleRate: number) => void,
  ): () => void
}
