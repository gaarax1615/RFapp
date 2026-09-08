import type { SpectrumSourceKind } from './index'

export interface DetectedHardwareOption {
  kind: SpectrumSourceKind
  id: string
  label: string
  /** true = se puede seleccionar y arrancar */
  available: boolean
  detail: string
}

/**
 * Sonda de hardware SDR.
 * Beta 1: solo el simulador está disponible.
 * Más adelante: Tauri invocará rtl_sdr / hackrf / libusb.
 */
export async function detectSpectrumHardware(): Promise<DetectedHardwareOption[]> {
  const options: DetectedHardwareOption[] = [
    {
      kind: 'mock',
      id: 'mock-spectrum',
      label: 'Simulado',
      available: true,
      detail: 'Generador local — sin hardware SDR',
    },
  ]

  const probed = await probeNativeSdr()
  options.push(...probed)

  return options
}

/**
 * Punto de extensión para Tauri/Rust.
 * Hoy no hay bridge nativo: reporta candidatos no disponibles.
 */
async function probeNativeSdr(): Promise<DetectedHardwareOption[]> {
  // Futuro: await invoke('list_sdr_devices')
  if (typeof window !== 'undefined' && '__RF_MONITOR_SDR__' in window) {
    const bridge = (
      window as unknown as {
        __RF_MONITOR_SDR__?: {
          list?: () => Promise<DetectedHardwareOption[]>
        }
      }
    ).__RF_MONITOR_SDR__
    if (bridge?.list) {
      return bridge.list()
    }
  }

  return [
    {
      kind: 'rtl-sdr',
      id: 'rtl-sdr',
      label: 'RTL-SDR',
      available: false,
      detail: 'No detectado — requiere driver Tauri/USB',
    },
    {
      kind: 'hackrf',
      id: 'hackrf',
      label: 'HackRF',
      available: false,
      detail: 'No detectado — requiere driver Tauri/USB',
    },
  ]
}
