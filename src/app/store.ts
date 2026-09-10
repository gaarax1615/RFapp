import { create } from 'zustand'
import type { RfDevice } from '@/types/device'
import type { RfAlert } from '@/types/alerts'
import type { ChannelMetrics } from '@/types/monitor'
import type { HardwareStatus } from '@/types/spectrum'
import type { DetectedHardwareOption } from '@/hardware/spectrum'
import type { SpectrumSourceKind } from '@/hardware/spectrum'
import type { RfListenBand } from '@/types/audio'

interface AppState {
  devices: RfDevice[]
  selectedDeviceId: string | null
  alerts: RfAlert[]
  metrics: ChannelMetrics[]
  hardwareStatus: HardwareStatus
  spectrumRange: { startMhz: number; endMhz: number }
  viewLocked: boolean
  listenBand: RfListenBand | null
  activeFrequencyCount: number
  selectedSourceKind: SpectrumSourceKind
  hardwareOptions: DetectedHardwareOption[]
  setDevices: (devices: RfDevice[]) => void
  setSelectedDeviceId: (id: string | null) => void
  setAlerts: (alerts: RfAlert[]) => void
  setMetrics: (metrics: ChannelMetrics[]) => void
  setHardwareStatus: (status: HardwareStatus) => void
  setSpectrumRange: (range: { startMhz: number; endMhz: number }) => void
  setViewLocked: (locked: boolean) => void
  setListenBand: (band: RfListenBand | null) => void
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
  spectrumRange: { startMhz: 470, endMhz: 698 },
  viewLocked: false,
  listenBand: null,
  activeFrequencyCount: 0,
  selectedSourceKind: 'mock',
  hardwareOptions: [],
  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setAlerts: (alerts) => set({ alerts }),
  setMetrics: (metrics) => set({ metrics }),
  setHardwareStatus: (hardwareStatus) => set({ hardwareStatus }),
  setSpectrumRange: (spectrumRange) => set({ spectrumRange }),
  setViewLocked: (viewLocked) => set({ viewLocked }),
  setListenBand: (listenBand) => set({ listenBand }),
  setActiveFrequencyCount: (activeFrequencyCount) => set({ activeFrequencyCount }),
  setSelectedSourceKind: (selectedSourceKind) => set({ selectedSourceKind }),
  setHardwareOptions: (hardwareOptions) => set({ hardwareOptions }),
}))
