import type { AudioMonitorStatus, ListenDemod, RfListenBand } from '@/types/audio'
import type { RfDevice } from '@/types/device'
import type { SpectrumService } from './SpectrumService'
import { SimulatedRfListenSource } from '@/hardware/audio/SimulatedRfListenSource'
import { PcmPlayer } from '@/hardware/audio/PcmPlayer'

export type ListenKind = 'sdr' | 'simulated' | 'idle'

export class AudioMonitorService {
  private readonly listenSource = new SimulatedRfListenSource()
  private readonly player = new PcmPlayer()
  private unsubSpectrum: (() => void) | null = null
  private unsubAudio: (() => void) | null = null
  private kind: ListenKind = 'idle'
  private band: RfListenBand | null = null

  canMonitor(_device: RfDevice): boolean {
    return false
  }

  getLabel(): string {
    if (this.kind === 'sdr') return 'NFM · RTL-SDR'
    return this.listenSource.label
  }

  getListenKind(): ListenKind {
    return this.kind
  }

  getStatus(): AudioMonitorStatus {
    if (this.kind === 'sdr') return 'listening'
    return this.listenSource.getStatus()
  }

  getListenBand(): RfListenBand | null {
    if (this.kind === 'sdr') return this.band
    return this.listenSource.getBand()
  }

  getVolume(): number {
    return this.kind === 'sdr' ? this.player.getVolume() : this.listenSource.getVolume()
  }

  setVolume(volume: number): void {
    this.player.setVolume(volume)
    this.listenSource.setVolume(volume)
  }

  async start(_deviceId: string): Promise<void> {
    throw new Error(
      'Monitoreo por dispositivo requiere hardware compatible. Usa escucha de zona en el RTA.',
    )
  }

  async listenToBand(
    band: RfListenBand,
    spectrum: SpectrumService,
    demod: ListenDemod = 'nfm',
  ): Promise<void> {
    this.band = { ...band }

    if (spectrum.canIqListen()) {
      if (this.kind !== 'sdr') {
        await this.stop(spectrum)
        this.band = { ...band }
        await this.player.start()
        this.unsubAudio = spectrum.subscribeAudio((samples, rate) => {
          this.player.push(samples, rate)
        })
      }
      await spectrum.listen(band, demod)
      this.kind = 'sdr'
      return
    }

    await this.stop(spectrum)
    this.band = { ...band }
    this.unsubSpectrum = spectrum.subscribe((frame) => {
      this.listenSource.pushFrame(frame)
    })
    await this.listenSource.start(band)
    const latest = spectrum.getLatestFrame()
    if (latest) this.listenSource.pushFrame(latest)
    this.kind = 'simulated'
  }

  async stop(spectrum?: SpectrumService): Promise<void> {
    this.unsubSpectrum?.()
    this.unsubSpectrum = null
    this.unsubAudio?.()
    this.unsubAudio = null
    if (spectrum && this.kind === 'sdr') await spectrum.stopListen()
    await this.player.stop()
    await this.listenSource.stop()
    this.kind = 'idle'
    this.band = null
  }
}
