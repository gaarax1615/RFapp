import type { RfDevice } from './device'
import type { SpectrumFrame } from './spectrum'

export type AudioMonitorStatus =
  | 'unavailable'
  | 'idle'
  | 'monitoring'
  | 'listening'
  | 'error'

export interface RfListenBand {
  startMhz: number
  endMhz: number
}

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

/** Escucha de una zona de RF (sonorización ahora; demodulación SDR después). */
export interface RfListenSource {
  readonly id: string
  readonly label: string
  start(band: RfListenBand): Promise<void>
  stop(): Promise<void>
  pushFrame(frame: SpectrumFrame): void
  getBand(): RfListenBand | null
  getStatus(): AudioMonitorStatus
  setVolume(volume: number): void
  getVolume(): number
}

export const DEFAULT_LISTEN_BW_MHZ = 0.2
export const MIN_LISTEN_SPAN_MHZ = 0.05
export const MAX_LISTEN_SPAN_MHZ = 6
