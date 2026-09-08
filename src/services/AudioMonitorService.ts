import type { AudioMonitorSource } from '@/types/audio'
import type { RfDevice } from '@/types/device'

export class AudioMonitorService {
  private readonly source: AudioMonitorSource

  constructor(source: AudioMonitorSource) {
    this.source = source
  }

  canMonitor(device: RfDevice): boolean {
    return this.source.canMonitor(device)
  }

  getStatus() {
    return this.source.getStatus()
  }

  getLabel(): string {
    return this.source.label
  }

  start(deviceId: string): Promise<void> {
    return this.source.start(deviceId)
  }

  stop(): Promise<void> {
    return this.source.stop()
  }
}
