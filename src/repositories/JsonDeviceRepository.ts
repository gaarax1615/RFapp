import type { DeviceRepository, RfDevice } from '@/types/device'
import { STORAGE_KEYS } from '@/utils/constants'

const LEGACY_DEVICE_KEYS = ['rf-monitor.devices.v1']

/**
 * Persistencia local. Ya no se siembran equipos de demo.
 */
export class JsonDeviceRepository implements DeviceRepository {
  private readonly key = STORAGE_KEYS.devices

  async list(): Promise<RfDevice[]> {
    for (const legacy of LEGACY_DEVICE_KEYS) {
      try {
        localStorage.removeItem(legacy)
      } catch {
        /* ignore */
      }
    }
    const raw = localStorage.getItem(this.key)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as RfDevice[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  async getById(id: string): Promise<RfDevice | null> {
    const devices = await this.list()
    return devices.find((d) => d.id === id) ?? null
  }

  async upsert(device: RfDevice): Promise<void> {
    const devices = await this.list()
    const index = devices.findIndex((d) => d.id === device.id)
    if (index >= 0) {
      devices[index] = device
    } else {
      devices.push(device)
    }
    await this.persist(devices)
  }

  async remove(id: string): Promise<void> {
    const devices = await this.list()
    await this.persist(devices.filter((d) => d.id !== id))
  }

  async clearAll(): Promise<void> {
    await this.persist([])
  }

  private async persist(devices: RfDevice[]): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(devices))
  }
}
