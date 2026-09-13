import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServices } from '@/app/AppProviders'
import { useAppStore } from '@/app/store'
import { getWirelessModel, guessCatalogId } from '@/data/wirelessCatalog'
import { formatFrequencyMhz } from '@/utils/constants'
import type { RfDevice } from '@/types/device'
import { applyAssignments } from './applyAssignments'
import { groupContainingMhz, rescanSingle } from './coordinate'
import { surveyKitBands } from './bandSurvey'
import { kitPrimaryViewRange } from './eventKit'

const recentPicks = new Map<string, number[]>()

function rememberPick(deviceId: string, mhz: number): void {
  const prev = recentPicks.get(deviceId) ?? []
  recentPicks.set(deviceId, [mhz, ...prev].slice(0, 6))
}

export function useEventRescan() {
  const navigate = useNavigate()
  const { devices: deviceService, spectrum, monitor } = useServices()
  const devices = useAppStore((s) => s.devices)
  const setDevices = useAppStore((s) => s.setDevices)
  const setSpectrumRange = useAppStore((s) => s.setSpectrumRange)
  const eventKitCatalogIds = useAppStore((s) => s.eventKitCatalogIds)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rescanAll = () => {
    navigate('/scan?rescan=all')
  }

  const rescanOne = async (device: RfDevice) => {
    const catalogId = guessCatalogId(device)
    if (!catalogId) {
      setError(`No reconozco el modelo de ${device.name}. Elige la banda en Escaneo.`)
      setMessage(null)
      return
    }

    setBusy(true)
    setError(null)
    setMessage('Barriendo la banda de este equipo…')
    try {
      const surveyIds = eventKitCatalogIds.includes(catalogId)
        ? [catalogId]
        : [catalogId]
      const { atlas, viewRange } = await surveyKitBands({
        spectrum,
        catalogIds: surveyIds,
        passesPerWindow: 2,
      })
      if (viewRange) setSpectrumRange(viewRange)

      const model = getWirelessModel(catalogId)
      const floor = atlas.noiseFloorDb()
      const score = (mhz: number) => atlas.score(mhz)
      const blocked = atlas.strongPeaks(12)
      const locked = devices
        .filter((row) => row.enabled && row.id !== device.id)
        .flatMap((row) => {
          const id = guessCatalogId(row)
          return id ? [{ catalogId: id, mhz: row.frequencyMhz }] : []
        })

      let seenAt: string | null = null
      if (model?.groups) {
        let bestCh: { label: string; mhz: number; group: string; energy: number } | null =
          null
        for (const group of model.groups) {
          for (const channel of group.channels) {
            const energy = score(channel.mhz)
            if (energy < floor + 10) continue
            if (!bestCh || energy > bestCh.energy) {
              bestCh = {
                label: channel.label,
                mhz: channel.mhz,
                group: group.label,
                energy,
              }
            }
          }
        }
        if (bestCh && Math.abs(bestCh.mhz - device.frequencyMhz) >= 0.05) {
          const g = groupContainingMhz(model, bestCh.mhz)
          seenAt = `${g?.label ?? bestCh.group} · Canal ${bestCh.label} (${formatFrequencyMhz(bestCh.mhz)})`
        }
      }

      const exclude = [
        device.frequencyMhz,
        ...(recentPicks.get(device.id) ?? []),
      ]

      const result = rescanSingle(
        { id: device.id, name: device.name, catalogId },
        device.frequencyMhz,
        locked,
        blocked,
        score,
        exclude,
      )
      if (!result.ok) {
        setError(result.error)
        setMessage(null)
        return
      }

      rememberPick(device.id, result.assignment.frequencyMhz)

      await applyAssignments({
        assignments: [result.assignment],
        devices,
        deviceService,
        monitor,
        setDevices,
        awaitingHardware: true,
        channelSource: 'software',
      })

      const extra = seenAt
        ? ` El TX se ve ahora en ${seenAt}. `
        : ' '
      setMessage(
        `${device.name} → ${result.assignment.hardware} · ${formatFrequencyMhz(result.assignment.frequencyMhz)}.${extra}Pon ese grupo/canal a mano en el BLX; hasta entonces la card dirá sin portadora.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reescanear')
      setMessage(null)
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    message,
    error,
    rescanAll,
    rescanOne,
    clear: () => {
      setError(null)
      setMessage(null)
    },
  }
}
