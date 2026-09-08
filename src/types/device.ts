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
}

export interface DeviceRepository {
  list(): Promise<RfDevice[]>
  getById(id: string): Promise<RfDevice | null>
  upsert(device: RfDevice): Promise<void>
  remove(id: string): Promise<void>
}
