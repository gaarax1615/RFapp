import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import {
  WIRELESS_CATALOG,
  catalogLabel,
  getWirelessModel,
} from '@/data/wirelessCatalog'
import { deviceTypeLabel } from '@/utils/i18n'
import { clampKitRange, kitPrimaryViewRange, kitSummaryLabel } from './eventKit'

interface EventKitEditorProps {
  compact?: boolean
  showSettingsLink?: boolean
}

export function EventKitEditor({
  compact = false,
  showSettingsLink = false,
}: EventKitEditorProps) {
  const { spectrum } = useServices()
  const eventKitCatalogIds = useAppStore((s) => s.eventKitCatalogIds)
  const setEventKitCatalogIds = useAppStore((s) => s.setEventKitCatalogIds)
  const setSpectrumRange = useAppStore((s) => s.setSpectrumRange)
  const [addId, setAddId] = useState(() => firstAvailable(eventKitCatalogIds))

  const grouped = useMemo(() => {
    const mics = WIRELESS_CATALOG.filter((m) => m.type === 'Microphone')
    const iems = WIRELESS_CATALOG.filter((m) => m.type === 'IEM')
    return [
      { label: 'Inalámbricos (mics)', models: mics },
      { label: 'In-ears', models: iems },
    ]
  }, [])

  const applyKit = async (ids: string[], focusId?: string) => {
    const unique = [...new Set(ids.filter((id) => getWirelessModel(id)))]
    if (unique.length === 0) return
    setEventKitCatalogIds(unique)
    const focus = focusId ? getWirelessModel(focusId) : null
    const range = focus
      ? clampKitRange(focus.startMhz, focus.endMhz)
      : kitPrimaryViewRange(unique)
    if (!range) return
    setSpectrumRange(range)
    try {
      await spectrum.setRange(range.startMhz, range.endMhz)
    } catch {
      /* SDR puede no estar listo */
    }
  }

  const onAdd = (event: FormEvent) => {
    event.preventDefault()
    if (!addId || !getWirelessModel(addId)) return
    if (eventKitCatalogIds.includes(addId)) {
      void applyKit(eventKitCatalogIds, addId)
      return
    }
    void applyKit([...eventKitCatalogIds, addId], addId)
    setAddId(firstAvailable([...eventKitCatalogIds, addId]))
  }

  const onChangeRow = (index: number, nextId: string) => {
    if (!getWirelessModel(nextId)) return
    const next = [...eventKitCatalogIds]
    next[index] = nextId
    void applyKit(next, nextId)
  }

  const onRemove = (id: string) => {
    const next = eventKitCatalogIds.filter((x) => x !== id)
    if (next.length === 0) return
    void applyKit(next)
  }

  return (
    <div className={compact ? '' : 'rounded-xl border border-white/10 bg-[#141414] p-4'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Equipos del evento</h3>
          <p className="mt-1 text-xs text-rf-muted">
            Cambia o añade mics e in-ears. El espectro se fija en la banda que
            elijas (K12 = 614–638 MHz).
          </p>
        </div>
        {showSettingsLink ? (
          <Link
            to="/settings"
            className="font-mono text-[11px] text-zinc-300/90 hover:text-zinc-200"
          >
            Cambiar en Ajustes
          </Link>
        ) : null}
      </div>

      <p className="mt-3 font-mono text-[11px] text-slate-400">
        Activo: {kitSummaryLabel(eventKitCatalogIds)}
      </p>

      <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
        {eventKitCatalogIds.map((id, index) => {
          const model = getWirelessModel(id)
          if (!model) return null
          return (
            <li
              key={`${id}-${index}`}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <label className="min-w-[14rem] flex-1">
                <span className="mb-0.5 block font-mono text-[10px] text-rf-muted uppercase">
                  {deviceTypeLabel(model.type)} · {model.startMhz.toFixed(0)}–
                  {model.endMhz.toFixed(0)} MHz
                </span>
                <select
                  value={id}
                  onChange={(e) => onChangeRow(index, e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-[#050505] px-2 py-1.5 text-sm outline-none focus:border-zinc-400/50"
                >
                  {grouped.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.models.map((option) => (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={
                            option.id !== id && eventKitCatalogIds.includes(option.id)
                          }
                        >
                          {catalogLabel(option)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void applyKit(eventKitCatalogIds, id)}
                  className="rounded-md border border-zinc-400/35 px-2 py-1 font-mono text-[11px] text-zinc-200 hover:bg-zinc-400/10"
                >
                  Ver banda
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  disabled={eventKitCatalogIds.length <= 1}
                  className="text-xs text-rf-muted hover:text-red-300 disabled:opacity-30"
                >
                  Quitar
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <form onSubmit={onAdd} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-[14rem] flex-1">
          <span className="mb-0.5 block font-mono text-[10px] text-rf-muted uppercase">
            Añadir al kit
          </span>
          <select
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#050505] px-2 py-1.5 text-sm outline-none focus:border-zinc-400/50"
          >
            {grouped.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {catalogLabel(model)}
                    {eventKitCatalogIds.includes(model.id) ? ' · ya en el kit' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-400/20 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-400/30"
        >
          {eventKitCatalogIds.includes(addId) ? 'Usar esta banda' : 'Añadir'}
        </button>
      </form>
    </div>
  )
}

function firstAvailable(kit: string[]): string {
  return (
    WIRELESS_CATALOG.find((m) => !kit.includes(m.id))?.id ??
    WIRELESS_CATALOG.find((m) => m.id === 'shure-blx4-k12')?.id ??
    WIRELESS_CATALOG[0]?.id ??
    ''
  )
}
