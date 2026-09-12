export type SignalStatus = 'GOOD' | 'WARNING' | 'INTERFERENCE' | 'NO_SIGNAL'

export interface ChannelMetrics {
  deviceId: string
  timestamp: number
  signalDbm: number
  noiseFloorDbm: number
  snrDb: number
  status: SignalStatus
  /** Desviación del nivel entre visitas a esa frecuencia. Bajo = estable. */
  stabilityDb: number
  /** Muestras frescas usadas para la estabilidad (no el decay del barrido). */
  sampleCount: number
}

export interface ChannelMetricsSource {
  subscribe(listener: (metrics: ChannelMetrics[]) => void): () => void
  getHistory(deviceId: string, windowMs: number): Promise<number[]>
  start(deviceIds: string[]): Promise<void>
  stop(): Promise<void>
}
