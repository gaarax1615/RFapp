import type { HardwareStatus, SpectrumConfig, SpectrumSource } from '@/types/spectrum'

/**
 * Future LAN client: Mac runs Tauri + local WS server;
 * iPad/Safari consumes frames through this adapter.
 */
export class RemoteSpectrumSource implements SpectrumSource {
  readonly id = 'remote-spectrum'
  readonly label = 'Remoto (red local)'
  private readonly endpoint: string

  constructor(endpoint: string = 'ws://127.0.0.1:8787/spectrum') {
    this.endpoint = endpoint
  }

  async start(_config: SpectrumConfig): Promise<void> {
    throw new Error(
      `RemoteSpectrumSource no implementado — endpoint previsto: ${this.endpoint}`,
    )
  }

  async stop(): Promise<void> {}

  subscribe(): () => void {
    return () => undefined
  }

  getStatus(): HardwareStatus {
    return {
      state: 'disconnected',
      deviceName: null,
      message: 'Servidor de red local pendiente',
    }
  }
}
