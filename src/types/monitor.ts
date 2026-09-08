export type SignalStatus = 'GOOD' | 'WARNING' | 'INTERFERENCE' | 'NO_SIGNAL'

export interface ChannelMetrics {
  deviceId: string
  timestamp: number
  signalDbm: number
  noiseFloorDbm: number
  snrDb: number
  status: SignalStatus
}

export interface ChannelMetricsSource {
  subscribe(listener: (metrics: ChannelMetrics[]) => void): () => void
  getHistory(deviceId: string, windowMs: number): Promise<number[]>
  start(deviceIds: string[]): Promise<void>
  stop(): Promise<void>
}
