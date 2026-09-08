import type { HardwareStatus, SpectrumConfig, SpectrumSource } from '@/types/spectrum'

/**
 * Placeholder for future RTL-SDR integration via Tauri/Rust bridge.
 * UI must never import this as a concrete dependency beyond factory selection.
 */
export class RTLSDRSource implements SpectrumSource {
  readonly id = 'rtl-sdr'
  readonly label = 'RTL-SDR'

  async start(_config: SpectrumConfig): Promise<void> {
    throw new Error('RTLSDRSource no implementado — usar MockSpectrumSource en Beta 1')
  }

  async stop(): Promise<void> {}

  subscribe(): () => void {
    return () => undefined
  }

  getStatus(): HardwareStatus {
    return {
      state: 'disconnected',
      deviceName: null,
      message: 'Controlador RTL-SDR pendiente (Tauri/Rust)',
    }
  }
}
