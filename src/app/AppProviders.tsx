import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { createAppServices, type AppServices } from './createAppServices'
import { useAppStore } from './store'
import { DEFAULT_SPECTRUM_CONFIG } from '@/utils/constants'
import { kitPrimaryViewRange, readEventKit } from '@/modules/scan/eventKit'

const ServicesContext = createContext<AppServices | null>(null)

export function useServices(): AppServices {
  const ctx = useContext(ServicesContext)
  if (!ctx) throw new Error('useServices debe usarse dentro de AppProviders')
  return ctx
}

export function AppProviders({ children }: { children: ReactNode }) {
  const services = useMemo(() => createAppServices(), [])

  useEffect(() => {
    let cancelled = false
    const {
      spectrum,
      devices,
      monitor,
      alerts,
      hardware,
      audio,
      tunnel,
      defaultSpectrumConfig,
    } = services

    const store = useAppStore.getState()

    async function boot() {
      const deviceList = await devices.list()
      if (cancelled) return
      store.setDevices(deviceList)

      const kitIds = readEventKit()
      store.setEventKitCatalogIds(kitIds)
      const kitRange = kitPrimaryViewRange(kitIds)
      const bootRange = kitRange ?? {
        startMhz: defaultSpectrumConfig.startFrequencyMhz,
        endMhz: defaultSpectrumConfig.endFrequencyMhz,
      }
      store.setSpectrumRange(bootRange)
      const bootConfig = {
        ...defaultSpectrumConfig,
        startFrequencyMhz: bootRange.startMhz,
        endFrequencyMhz: bootRange.endMhz,
      }

      const options = await hardware.refresh()
      if (cancelled) return
      store.setHardwareOptions(options)
      store.setSelectedSourceKind(hardware.getSelectedKind())

      const preferred = hardware.getSelectedKind()
      const canUsePreferred = options.some(
        (o) => o.kind === preferred && o.available,
      )

      if (canUsePreferred && preferred !== 'mock') {
        try {
          await hardware.select(preferred, spectrum)
          await spectrum.setRange(bootRange.startMhz, bootRange.endMhz)
        } catch {
          await spectrum.start(bootConfig)
        }
      } else {
        await spectrum.start(bootConfig)
      }
      if (cancelled) return

      store.setHardwareStatus(spectrum.getStatus())
      store.setSelectedSourceKind(hardware.getSelectedKind())

      const enabledIds = deviceList.filter((d) => d.enabled).map((d) => d.id)
      await monitor.start(enabledIds)
      tunnel.bind(spectrum)

      const unsubHardware = hardware.subscribe((state) => {
        useAppStore.getState().setHardwareOptions(state.options)
        useAppStore.getState().setSelectedSourceKind(state.selectedKind)
      })

      const unsubAlerts = alerts.subscribe((list) => {
        useAppStore.getState().setAlerts(list)
      })

      const unsubMetrics = monitor.subscribe((metrics) => {
        useAppStore.getState().setMetrics(metrics)
        const currentDevices = useAppStore.getState().devices
        alerts.evaluateMetrics(metrics, currentDevices)
        const active = metrics.filter(
          (m) => m.status === 'GOOD' || m.status === 'WARNING',
        ).length
        useAppStore.getState().setActiveFrequencyCount(active)

        const pending = currentDevices.filter(
          (d) => d.awaitingHardware && metrics.some((m) => m.deviceId === d.id && m.snrDb >= 8),
        )
        if (pending.length > 0) {
          const next = currentDevices.map((d) =>
            pending.some((p) => p.id === d.id) ? { ...d, awaitingHardware: false } : d,
          )
          useAppStore.getState().setDevices(next)
          for (const d of pending) void devices.upsert({ ...d, awaitingHardware: false })
        }
      })

      let frameCount = 0
      const unsubSpectrum = spectrum.subscribe((frame) => {
        frameCount += 1
        if (frameCount % 10 === 0) {
          useAppStore.getState().setHardwareStatus(spectrum.getStatus())
          alerts.evaluateSpectrum(frame, useAppStore.getState().devices)
        }
      })

      return () => {
        unsubHardware()
        unsubAlerts()
        unsubMetrics()
        unsubSpectrum()
      }
    }

    let cleanup: (() => void) | undefined
    void boot().then((fn) => {
      cleanup = fn
    })

    return () => {
      cancelled = true
      cleanup?.()
      tunnel.unbind()
      void audio.stop(spectrum)
      void spectrum.stop()
      void monitor.stop()
    }
  }, [services])

  return (
    <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
  )
}

export { DEFAULT_SPECTRUM_CONFIG }
