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
} as const

export function formatFrequencyMhz(mhz: number, digits = 3): string {
  return `${mhz.toFixed(digits)} MHz`
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
