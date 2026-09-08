import type { DeviceRepository, RfDevice } from '@/types/device'

export class DeviceService {
  private readonly repository: DeviceRepository

  constructor(repository: DeviceRepository) {
    this.repository = repository
  }

  list(): Promise<RfDevice[]> {
    return this.repository.list()
  }

  getById(id: string): Promise<RfDevice | null> {
    return this.repository.getById(id)
  }

  async listEnabled(): Promise<RfDevice[]> {
    const devices = await this.repository.list()
    return devices.filter((d) => d.enabled)
  }

  upsert(device: RfDevice): Promise<void> {
    return this.repository.upsert(device)
  }

  remove(id: string): Promise<void> {
    return this.repository.remove(id)
  }
}
