import { createSpectrumSource, type SpectrumSourceKind } from '@/hardware/spectrum'
import { SpectrumChannelMetricsSource } from '@/hardware/metrics'
import { JsonDeviceRepository } from '@/repositories'
import {
  AlertService,
  AudioMonitorService,
  DeviceService,
  HardwareService,
  MonitorService,
  SpectrumService,
} from '@/services'
import { SpectrumTunnel } from '@/modules/spectrum/SpectrumTunnel'
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
  const monitor = new MonitorService(
    new SpectrumChannelMetricsSource(spectrum, devices),
  )
  const alerts = new AlertService()
  const audio = new AudioMonitorService()
  const tunnel = new SpectrumTunnel()
  spectrum.setViewReset(() => tunnel.reset())

  return {
    spectrum,
    devices,
    monitor,
    alerts,
    audio,
    hardware,
    tunnel,
    defaultSpectrumConfig: { ...DEFAULT_SPECTRUM_CONFIG },
  }
}

export type AppServices = ReturnType<typeof createAppServices>
