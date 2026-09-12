export type DeviceType =
  | 'Microphone'
  | 'Instrument'
  | 'IEM'
  | 'Bodypack'
  | 'Other'

export interface RfDevice {
  id: string
  name: string
  channel: string
  type: DeviceType
  brand: string
  model: string
  frequencyMhz: number
  notes: string
  enabled: boolean
  /** Id del catálogo de Escaneo (BLX H9, Xtuga, etc.) para reescanear. */
  catalogId?: string
  /** Hay frecuencia nueva en software; el receptor aún no está en ese grupo/canal. */
  awaitingHardware?: boolean
}

export interface DeviceRepository {
  list(): Promise<RfDevice[]>
  getById(id: string): Promise<RfDevice | null>
  upsert(device: RfDevice): Promise<void>
  remove(id: string): Promise<void>
  clearAll(): Promise<void>
}
