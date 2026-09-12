import { create } from 'zustand'
import type { RfDevice } from '@/types/device'
import type { RfAlert } from '@/types/alerts'
import type { ChannelMetrics } from '@/types/monitor'
import type { HardwareStatus } from '@/types/spectrum'
import type { DetectedHardwareOption } from '@/hardware/spectrum'
import type { SpectrumSourceKind } from '@/hardware/spectrum'
import type { ListenDemod, RfListenBand } from '@/types/audio'
import { readEventKit, writeEventKit } from '@/modules/scan/eventKit'

interface AppState {
  devices: RfDevice[]
  selectedDeviceId: string | null
  alerts: RfAlert[]
  metrics: ChannelMetrics[]
  hardwareStatus: HardwareStatus
  spectrumRange: { startMhz: number; endMhz: number }
  eventKitCatalogIds: string[]
  viewLocked: boolean
  listenBand: RfListenBand | null
  listenDemod: ListenDemod
  activeFrequencyCount: number
  selectedSourceKind: SpectrumSourceKind
  hardwareOptions: DetectedHardwareOption[]
  setDevices: (devices: RfDevice[]) => void
  setSelectedDeviceId: (id: string | null) => void
  setAlerts: (alerts: RfAlert[]) => void
  setMetrics: (metrics: ChannelMetrics[]) => void
  setHardwareStatus: (status: HardwareStatus) => void
  setSpectrumRange: (range: { startMhz: number; endMhz: number }) => void
  setEventKitCatalogIds: (ids: string[]) => void
  setViewLocked: (locked: boolean) => void
  setListenBand: (band: RfListenBand | null) => void
  setListenDemod: (demod: ListenDemod) => void
  setActiveFrequencyCount: (count: number) => void
  setSelectedSourceKind: (kind: SpectrumSourceKind) => void
  setHardwareOptions: (options: DetectedHardwareOption[]) => void
}

export const useAppStore = create<AppState>((set) => ({
  devices: [],
  selectedDeviceId: null,
  alerts: [],
  metrics: [],
  hardwareStatus: {
    state: 'disconnected',
    deviceName: null,
  },
  spectrumRange: { startMhz: 614, endMhz: 638 },
  eventKitCatalogIds: readEventKit(),
  viewLocked: false,
  listenBand: null,
  listenDemod: 'nfm',
  activeFrequencyCount: 0,
  selectedSourceKind: 'mock',
  hardwareOptions: [],
  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setAlerts: (alerts) => set({ alerts }),
  setMetrics: (metrics) => set({ metrics }),
  setHardwareStatus: (hardwareStatus) => set({ hardwareStatus }),
  setSpectrumRange: (spectrumRange) => set({ spectrumRange }),
  setEventKitCatalogIds: (eventKitCatalogIds) => {
    writeEventKit(eventKitCatalogIds)
    set({ eventKitCatalogIds })
  },
  setViewLocked: (viewLocked) => set({ viewLocked }),
  setListenBand: (listenBand) => set({ listenBand }),
  setListenDemod: (listenDemod) => set({ listenDemod }),
  setActiveFrequencyCount: (activeFrequencyCount) => set({ activeFrequencyCount }),
  setSelectedSourceKind: (selectedSourceKind) => set({ selectedSourceKind }),
  setHardwareOptions: (hardwareOptions) => set({ hardwareOptions }),
}))
