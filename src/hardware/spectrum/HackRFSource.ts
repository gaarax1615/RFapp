import type { HardwareStatus, SpectrumConfig, SpectrumSource } from '@/types/spectrum'

/** Placeholder for future HackRF integration. */
export class HackRFSource implements SpectrumSource {
  readonly id = 'hackrf'
  readonly label = 'HackRF'

  async start(_config: SpectrumConfig): Promise<void> {
    throw new Error('HackRFSource no implementado — usar MockSpectrumSource en Beta 1')
  }

  async stop(): Promise<void> {}

  subscribe(): () => void {
    return () => undefined
  }

  getStatus(): HardwareStatus {
    return {
      state: 'disconnected',
      deviceName: null,
      message: 'Controlador HackRF pendiente (Tauri/Rust)',
    }
  }
}
