import type { RfDevice } from './device'

export type AudioMonitorStatus =
  | 'unavailable'
  | 'idle'
  | 'monitoring'
  | 'error'

/**
 * Conceptual port for future RF audio monitoring.
 * Intentionally decoupled from SpectrumSource — demodulation
 * is not implied by spectrum power bins.
 */
export interface AudioMonitorSource {
  readonly id: string
  readonly label: string
  canMonitor(device: RfDevice): boolean
  start(deviceId: string): Promise<void>
  stop(): Promise<void>
  getStatus(): AudioMonitorStatus
}
