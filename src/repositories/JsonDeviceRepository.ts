import { SEED_DEVICES } from '@/data'
import type { DeviceRepository, RfDevice } from '@/types/device'
import { STORAGE_KEYS } from '@/utils/constants'

/**
 * Local JSON persistence via localStorage.
 * Swap for Tauri FS / SQLite later without changing DeviceService.
 */
export class JsonDeviceRepository implements DeviceRepository {
  private readonly key = STORAGE_KEYS.devices

  async list(): Promise<RfDevice[]> {
    const raw = localStorage.getItem(this.key)
    if (!raw) {
      await this.persist(SEED_DEVICES)
      return structuredClone(SEED_DEVICES)
    }
    try {
      const parsed = JSON.parse(raw) as RfDevice[]
      return Array.isArray(parsed) ? parsed : structuredClone(SEED_DEVICES)
    } catch {
      return structuredClone(SEED_DEVICES)
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

  private async persist(devices: RfDevice[]): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(devices))
  }
}
