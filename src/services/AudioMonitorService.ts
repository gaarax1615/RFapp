import type { AudioMonitorStatus, RfListenBand } from '@/types/audio'
import type { RfDevice } from '@/types/device'
import type { SpectrumService } from './SpectrumService'
import { SimulatedRfListenSource } from '@/hardware/audio/SimulatedRfListenSource'

export class AudioMonitorService {
  private readonly listenSource = new SimulatedRfListenSource()
  private unsubSpectrum: (() => void) | null = null

  canMonitor(_device: RfDevice): boolean {
    return false
  }

  getLabel(): string {
    return this.listenSource.label
  }

  getStatus(): AudioMonitorStatus {
    return this.listenSource.getStatus()
  }

  getListenBand(): RfListenBand | null {
    return this.listenSource.getBand()
  }

  getVolume(): number {
    return this.listenSource.getVolume()
  }

  setVolume(volume: number): void {
    this.listenSource.setVolume(volume)
  }

  async start(_deviceId: string): Promise<void> {
    throw new Error(
      'Monitoreo por dispositivo requiere hardware compatible. Usa escucha de zona en el RTA.',
    )
  }

  async listenToBand(band: RfListenBand, spectrum: SpectrumService): Promise<void> {
    this.unsubSpectrum?.()
    this.unsubSpectrum = null
    await this.listenSource.start(band)
    this.unsubSpectrum = spectrum.subscribe((frame) => {
      this.listenSource.pushFrame(frame)
    })
    const latest = spectrum.getLatestFrame()
    if (latest) this.listenSource.pushFrame(latest)
  }

  async stop(): Promise<void> {
    this.unsubSpectrum?.()
    this.unsubSpectrum = null
    await this.listenSource.stop()
  }
}
