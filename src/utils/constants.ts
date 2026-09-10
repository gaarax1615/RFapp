/** Default UHF wireless monitoring window (configurable later). */
export const DEFAULT_SPECTRUM_CONFIG = {
  startFrequencyMhz: 470,
  endFrequencyMhz: 698,
  binCount: 2048,
  updateRateHz: 25,
} as const

export const STORAGE_KEYS = {
  devices: 'rf-monitor.devices.v1',
  spectrumSource: 'rf-monitor.spectrum-source.v1',
  sidebarCollapsed: 'rf-monitor.sidebar-collapsed.v1',
  rtaSplit: 'rf-monitor.rta-split.v1',
  rtaSensitivity: 'rf-monitor.rta-sensitivity.v1',
  rangePanelPos: 'rf-monitor.range-panel-pos.v1',
  monitorPopupPos: 'rf-monitor.monitor-popup-pos.v1',
  scanInventory: 'rf-monitor.scan-inventory.v1',
} as const

export function formatFrequencyMhz(mhz: number, digits = 3): string {
  return `${mhz.toFixed(digits)} MHz`
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
