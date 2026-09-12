import { localSdrHttpUrl } from '@/utils/constants'
import type { SpectrumSourceKind } from './index'

export interface DetectedHardwareOption {
  kind: SpectrumSourceKind
  id: string
  label: string
  /** true = se puede seleccionar y arrancar */
  available: boolean
  detail: string
}

type BackendDevice = {
  driver?: string
  serial?: string | null
  name?: string
}

type DevicesResponse = {
  mode?: string
  librtlsdr?: boolean
  devices?: BackendDevice[]
}

/**
 * Sonda de hardware SDR.
 * El camino local actual es el backend Python (`Backend`) en :8787.
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

  const probed = await probeLocalBackend()
  options.push(probed.remote, probed.rtl, probed.hackrf)

  if (typeof window !== 'undefined' && '__RF_MONITOR_SDR__' in window) {
    const bridge = (
      window as unknown as {
        __RF_MONITOR_SDR__?: {
          list?: () => Promise<DetectedHardwareOption[]>
        }
      }
    ).__RF_MONITOR_SDR__
    if (bridge?.list) {
      const extra = await bridge.list()
      options.push(...extra)
    }
  }

  return options
}

async function probeLocalBackend(): Promise<{
  remote: DetectedHardwareOption
  rtl: DetectedHardwareOption
  hackrf: DetectedHardwareOption
}> {
  const downRemote: DetectedHardwareOption = {
    kind: 'remote',
    id: 'remote',
    label: 'Backend local',
    available: false,
    detail: 'No detectado — arranca ./start.sh (Backend en :8787)',
  }
  const downRtl: DetectedHardwareOption = {
    kind: 'rtl-sdr',
    id: 'rtl-sdr',
    label: 'RTL-SDR',
    available: false,
    detail: 'No detectado — conecta el dongle y arranca ./start.sh',
  }
  const hackrf: DetectedHardwareOption = {
    kind: 'hackrf',
    id: 'hackrf',
    label: 'HackRF',
    available: false,
    detail: 'Aún no implementado en el backend local',
  }

  try {
    const health = await fetch(localSdrHttpUrl('/health'), {
      signal: AbortSignal.timeout(600),
    })
    if (!health.ok) {
      return { remote: downRemote, rtl: downRtl, hackrf }
    }

    let remoteDetail = 'Python en :8787 · listo'
    let rtlAvailable = false
    let rtlDetail = 'Backend activo, pero sin dongle RTL-SDR'

    try {
      const res = await fetch(localSdrHttpUrl('/devices'), {
        signal: AbortSignal.timeout(800),
      })
      if (res.ok) {
        const data = (await res.json()) as DevicesResponse
        const list = Array.isArray(data.devices) ? data.devices : []
        const rtlList = list.filter((d) => (d.driver ?? 'rtl-sdr') === 'rtl-sdr')
        if (rtlList.length > 0) {
          const serials = rtlList
            .map((d) => d.serial)
            .filter((s): s is string => Boolean(s))
          const names = rtlList.map((d) => d.name).filter(Boolean)
          rtlAvailable = true
          rtlDetail = serials.length
            ? `Vía backend local · serial ${serials.join(', ')}`
            : `Vía backend local · ${names[0] ?? 'RTL-SDR'}`
          remoteDetail = rtlDetail
        } else if (data.librtlsdr) {
          remoteDetail = 'Python en :8787 · librtlsdr ok, sin dongle (modo prueba)'
        } else {
          remoteDetail = 'Python en :8787 · sin dongle (espectro de prueba)'
        }
      }
    } catch {
      /* health basta para marcar el backend como usable */
    }

    return {
      remote: {
        kind: 'remote',
        id: 'remote',
        label: 'Backend local',
        available: true,
        detail: remoteDetail,
      },
      rtl: {
        kind: 'rtl-sdr',
        id: 'rtl-sdr',
        label: 'RTL-SDR',
        available: rtlAvailable,
        detail: rtlDetail,
      },
      hackrf,
    }
  } catch {
    return { remote: downRemote, rtl: downRtl, hackrf }
  }
}
