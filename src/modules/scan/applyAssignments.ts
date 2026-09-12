import { getWirelessModel } from '@/data/wirelessCatalog'
import { formatDeviceChannel } from '@/utils/i18n'
import type { DeviceService } from '@/services/DeviceService'
import type { MonitorService } from '@/services/MonitorService'
import type { RfDevice } from '@/types/device'
import type { CoordAssignment } from './coordinate'

export async function applyAssignments(options: {
  assignments: CoordAssignment[]
  devices: RfDevice[]
  deviceService: DeviceService
  monitor: MonitorService
  setDevices: (devices: RfDevice[]) => void
  awaitingHardware?: boolean
}): Promise<RfDevice[]> {
  let list = [...options.devices]
  for (const row of options.assignments) {
    const model = getWirelessModel(row.catalogId)
    const existing =
      list.find((device) => device.id === row.unitId) ??
      list.find((device) => device.name.trim().toLowerCase() === row.name.trim().toLowerCase())
    const device: RfDevice = {
      id: existing?.id ?? row.unitId,
      name: existing?.name ?? row.name,
      channel: row.hardware.startsWith('Grupo')
        ? formatDeviceChannel(row.hardware)
        : row.bandLabel,
      type: row.type,
      brand: row.brand,
      model: `${row.model} ${row.bandLabel}`,
      frequencyMhz: row.frequencyMhz,
      notes: existing?.notes ?? model?.notes ?? '',
      enabled: existing?.enabled ?? true,
      catalogId: row.catalogId,
      awaitingHardware: options.awaitingHardware ?? existing?.awaitingHardware,
    }
    await options.deviceService.upsert(device)
    const index = list.findIndex((item) => item.id === device.id)
    if (index >= 0) list[index] = device
    else list = [...list, device]
  }
  options.setDevices(list)
  await options.monitor.start(list.filter((device) => device.enabled).map((device) => device.id))
  return list
}
