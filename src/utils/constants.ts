/** Default UHF wireless monitoring window (configurable later). */
export const DEFAULT_SPECTRUM_CONFIG = {
  startFrequencyMhz: 614,
  endFrequencyMhz: 638,
  binCount: 2048,
  updateRateHz: 25,
} as const

export const LOCAL_SDR_PORT = 8787

/** HTTP del backend local. En dev Vite proxifica `/sdr-api` → :8787. */
export function localSdrHttpUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const explicit = import.meta.env.VITE_SDR_HTTP
  if (explicit) return `${String(explicit).replace(/\/$/, '')}${normalized}`
  if (import.meta.env.DEV) return `/sdr-api${normalized}`
  return `http://127.0.0.1:${LOCAL_SDR_PORT}${normalized}`
}

/**
 * WebSocket de frames.
 * En localhost va directo a :8787 (el proxy WS de Vite corta el socket).
 * En la LAN se usa el proxy de Vite.
 */
export function localSdrWsUrl(): string {
  const explicit = import.meta.env.VITE_SDR_WS
  if (explicit) return String(explicit)
  const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'
  if (host === 'localhost' || host === '127.0.0.1') {
    return `ws://127.0.0.1:${LOCAL_SDR_PORT}/spectrum`
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/sdr-ws/spectrum`
}

export const STORAGE_KEYS = {
  devices: 'rf-monitor.devices.v2',
  spectrumSource: 'rf-monitor.spectrum-source.v1',
  sidebarCollapsed: 'rf-monitor.sidebar-collapsed.v1',
  rtaSplit: 'rf-monitor.rta-split.v1',
  rtaSensitivity: 'rf-monitor.rta-sensitivity.v1',
  rangePanelPos: 'rf-monitor.range-panel-pos.v1',
  monitorPopupPos: 'rf-monitor.monitor-popup-pos.v1',
  scanInventory: 'rf-monitor.scan-inventory.v2',
  listenDemod: 'rf-monitor.listen-demod.v1',
  eventKitCatalogIds: 'rf-monitor.event-kit.v1',
} as const

export function formatFrequencyMhz(mhz: number, digits = 3): string {
  return `${mhz.toFixed(digits)} MHz`
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
