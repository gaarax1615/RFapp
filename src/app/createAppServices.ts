import { createSpectrumSource, type SpectrumSourceKind } from '@/hardware/spectrum'
import { MockChannelMetricsSource } from '@/hardware/metrics'
import { JsonDeviceRepository } from '@/repositories'
import {
  AlertService,
  AudioMonitorService,
  DeviceService,
  HardwareService,
  MonitorService,
  SpectrumService,
} from '@/services'
import { DEFAULT_SPECTRUM_CONFIG } from '@/utils/constants'

/**
 * Composition root — wires ports to adapters.
 * Swap adapters here without touching React modules.
 */
export function createAppServices() {
  const hardware = new HardwareService()
  // Arranque seguro con simulador; tras detectar, AppProviders reaplica la preferencia guardada.
  const spectrumSource = createSpectrumSource('mock' satisfies SpectrumSourceKind)
  const spectrum = new SpectrumService(spectrumSource)
  const devices = new DeviceService(new JsonDeviceRepository())
  const monitor = new MonitorService(new MockChannelMetricsSource())
  const alerts = new AlertService()
  const audio = new AudioMonitorService()

  return {
    spectrum,
    devices,
    monitor,
    alerts,
    audio,
    hardware,
    defaultSpectrumConfig: { ...DEFAULT_SPECTRUM_CONFIG },
  }
}

export type AppServices = ReturnType<typeof createAppServices>
