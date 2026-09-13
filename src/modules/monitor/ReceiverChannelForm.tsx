import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import {
  getWirelessModel,
  guessCatalogId,
  lookupGroupChannel,
} from '@/data/wirelessCatalog'
import { formatFrequencyMhz } from '@/utils/constants'
import { channelSourceLabel, formatDeviceChannel } from '@/utils/i18n'
import type { RfDevice } from '@/types/device'

export function ReceiverChannelForm({ device }: { device: RfDevice }) {
  const { devices: deviceService, monitor } = useServices()
  const devices = useAppStore((s) => s.devices)
  const setDevices = useAppStore((s) => s.setDevices)
  const eventKitCatalogIds = useAppStore((s) => s.eventKitCatalogIds)
  const [raw, setRaw] = useState(() => formatDeviceChannel(device.channel))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRaw(formatDeviceChannel(device.channel))
  }, [device.id, device.channel])

  const model =
    getWirelessModel(guessCatalogId(device) ?? '') ??
    getWirelessModel(eventKitCatalogIds[0] ?? '')
  const preview = useMemo(
    () => (model ? lookupGroupChannel(model, raw) : null),
    [model, raw],
  )

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!model) {
      setError('Elige la banda de este equipo en Escaneo (kit del evento).')
      return
    }
    const hit = lookupGroupChannel(model, raw)
    if (!hit) {
      setError(`Ese grupo/canal no existe en ${model.bandLabel}. Prueba C6, B3…`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next: RfDevice = {
        ...device,
        catalogId: device.catalogId ?? model.id,
        channel: hit.compact,
        frequencyMhz: hit.mhz,
        awaitingHardware: false,
        channelSource: 'receiver',
      }
      await deviceService.upsert(next)
      const list = devices.map((row) => (row.id === next.id ? next : row))
      setDevices(list)
      await monitor.start(list.filter((row) => row.enabled).map((row) => row.id))
      setRaw(hit.compact)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const source = channelSourceLabel(device.channelSource)
  const shown = formatDeviceChannel(device.channel)

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-1.5">
      <p className="font-mono text-[10px] tracking-wider text-rf-muted uppercase">
        En el receptor
      </p>
      <p className="text-[11px] text-slate-400">
        Si el BLX escaneó solo, escribe lo que ves (ej. C6).
      </p>
      {shown !== '—' ? (
        <p className="font-mono text-[11px] text-zinc-200">
          Está en {shown}
          {source ? ` · ${source}` : ''}
          {` · ${formatFrequencyMhz(device.frequencyMhz)}`}
        </p>
      ) : null}
      <div className="flex gap-1.5">
        <input
          className="field min-w-0 flex-1 font-mono uppercase"
          value={raw}
          placeholder="C6"
          spellCheck={false}
          onChange={(e) => {
            setRaw(e.target.value)
            setError(null)
          }}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border border-zinc-400/40 px-2.5 py-1 font-mono text-[11px] text-zinc-200 hover:bg-zinc-400/15 disabled:opacity-40"
        >
          {saving ? '…' : 'Poner'}
        </button>
      </div>
      {preview ? (
        <p className="font-mono text-[10px] text-slate-400">
          {preview.hardware} · {formatFrequencyMhz(preview.mhz)}
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
    </form>
  )
}
