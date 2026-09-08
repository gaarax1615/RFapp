import type { RfDevice } from '@/types/device'
import type { AudioMonitorSource, AudioMonitorStatus } from '@/types/audio'

/**
 * Stub for future audio monitoring. Does not assume SDR can demodulate
 * proprietary digital wireless systems.
 */
export class StubAudioMonitorSource implements AudioMonitorSource {
  readonly id = 'stub-audio'
  readonly label = 'Monitor de audio (no disponible)'

  private status: AudioMonitorStatus = 'unavailable'

  canMonitor(_device: RfDevice): boolean {
    return false
  }

  async start(_deviceId: string): Promise<void> {
    this.status = 'error'
    throw new Error(
      'Monitoreo de audio no disponible en Beta 1. Requiere hardware/API compatible.',
    )
  }

  async stop(): Promise<void> {
    this.status = 'unavailable'
  }

  getStatus(): AudioMonitorStatus {
    return this.status
  }
}
