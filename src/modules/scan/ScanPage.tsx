import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import {
  WIRELESS_CATALOG,
  catalogLabel,
  getWirelessModel,
} from '@/data/wirelessCatalog'
import { createId, formatFrequencyMhz, STORAGE_KEYS } from '@/utils/constants'
import { deviceTypeLabel } from '@/utils/i18n'
import type { RfDevice } from '@/types/device'
import type { SpectrumFrame } from '@/types/spectrum'
import {
  coordinateFrequencies,
  type CoordPlan,
  type CoordUnit,
} from './coordinate'

interface InventoryItem extends CoordUnit {}

function readInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.scanInventory)
    if (!raw) return []
    const parsed = JSON.parse(raw) as InventoryItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistInventory(items: InventoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.scanInventory, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

function occupiedFromFrame(frame: SpectrumFrame): number[] {
  const bins = frame.powerDb
  const n = bins.length
  if (n < 8) return []
  const sample: number[] = []
  const step = Math.max(1, Math.floor(n / 400))
  for (let i = 0; i < n; i += step) sample.push(bins[i] ?? -160)
  sample.sort((a, b) => a - b)
  const noise = sample[Math.floor(sample.length * 0.2)] ?? -100
  const thresh = noise + 14
  const peaks: number[] = []
  const win = 4
  for (let i = win; i < n - win; i++) {
    const v = bins[i] ?? -160
    if (v < thresh) continue
    let isMax = true
    for (let k = i - win; k <= i + win; k++) {
      if (k !== i && (bins[k] ?? -160) > v) {
        isMax = false
        break
      }
    }
    if (!isMax) continue
    const freq = frame.startFrequencyMhz + i * frame.binWidthMhz
    if (peaks.some((p) => Math.abs(p - freq) < 0.35)) continue
    peaks.push(freq)
  }
  return peaks
}

export function ScanPage() {
  const { devices: deviceService, spectrum } = useServices()
  const devices = useAppStore((s) => s.devices)
  const setDevices = useAppStore((s) => s.setDevices)
  const [items, setItems] = useState<InventoryItem[]>(readInventory)
  const [name, setName] = useState('')
  const [catalogId, setCatalogId] = useState(WIRELESS_CATALOG[1]?.id ?? WIRELESS_CATALOG[0]!.id)
  const [avoidOccupied, setAvoidOccupied] = useState(true)
  const [blocked, setBlocked] = useState<number[]>([])
  const [plans, setPlans] = useState<CoordPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    persistInventory(items)
  }, [items])

  useEffect(() => {
    if (!avoidOccupied) {
      setBlocked([])
      return
    }
    const unsub = spectrum.subscribe((frame) => {
      setBlocked(occupiedFromFrame(frame))
    })
    return unsub
  }, [avoidOccupied, spectrum])

  const selectedModel = getWirelessModel(catalogId)

  const onAdd = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Ponle un nombre (Vocal 1, Acordeón, IEM…)')
      return
    }
    setItems((current) => [
      ...current,
      { id: createId('scan'), name: trimmed, catalogId },
    ])
    setName('')
    setError(null)
    setPlans([])
    setSelectedPlanId(null)
    setSavedMsg(null)
  }

  const onCalculate = () => {
    const next = coordinateFrequencies(items, avoidOccupied ? blocked : [])
    setSavedMsg(null)
    if (!next.ok) {
      setPlans([])
      setSelectedPlanId(null)
      setError(next.error)
      return
    }
    setError(null)
    setPlans(next.plans)
    setSelectedPlanId(next.plans[0]?.id ?? null)
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null

  const onApply = async () => {
    if (!selectedPlan) return
    setSaving(true)
    setError(null)
    try {
      let list = [...devices]
      for (const row of selectedPlan.assignments) {
        const model = getWirelessModel(row.catalogId)
        const existing = list.find((d) => d.id === row.unitId)
        const device: RfDevice = {
          id: row.unitId,
          name: row.name,
          channel: row.hardware.startsWith('Grupo')
            ? row.hardware.replace('Grupo ', '').replace(' · Canal ', '-')
            : row.bandLabel,
          type: row.type,
          brand: row.brand,
          model: `${row.model} ${row.bandLabel}`,
          frequencyMhz: row.frequencyMhz,
          notes: existing?.notes ?? model?.notes ?? '',
          enabled: existing?.enabled ?? true,
        }
        await deviceService.upsert(device)
        const index = list.findIndex((d) => d.id === device.id)
        if (index >= 0) list[index] = device
        else list = [...list, device]
      }
      setDevices(list)
      setSavedMsg('Frecuencias guardadas. Ya puedes ponerlas a mano en cada inalámbrico.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar')
    } finally {
      setSaving(false)
    }
  }

  const groupedCatalog = useMemo(() => {
    const brands = new Map<string, typeof WIRELESS_CATALOG>()
    for (const model of WIRELESS_CATALOG) {
      const list = brands.get(model.brand) ?? []
      list.push(model)
      brands.set(model.brand, list)
    }
    return [...brands.entries()]
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-auto p-5 md:p-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] text-rf-muted uppercase">
          Coordinación de frecuencias
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Escaneo</h2>
        <p className="mt-1 max-w-2xl text-sm text-rf-muted">
          Mete tus inalámbricos y calcula. Te salen varias opciones de grupo;
          eliges una y en cada BLX4 pones ese Grupo y Canal.
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-[#121820] p-4">
        <h3 className="text-sm font-semibold">1. Inventario</h3>
        <form onSubmit={onAdd} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-0.5 block font-mono text-[10px] text-rf-muted uppercase">
              Nombre
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vocal 1"
              className="w-[10rem] rounded-md border border-white/10 bg-[#0d1117] px-2 py-1.5 text-sm outline-none focus:border-teal-400/50"
            />
          </label>
          <label className="block min-w-[14rem] flex-1">
            <span className="mb-0.5 block font-mono text-[10px] text-rf-muted uppercase">
              Modelo
            </span>
            <select
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-[#0d1117] px-2 py-1.5 text-sm outline-none focus:border-teal-400/50"
            >
              {groupedCatalog.map(([brand, models]) => (
                <optgroup key={brand} label={brand}>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {catalogLabel(model)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-teal-400/20 px-3 py-1.5 text-sm font-medium text-teal-300 hover:bg-teal-400/30"
          >
            Agregar
          </button>
        </form>
        {selectedModel ? (
          <p className="mt-2 text-xs text-rf-muted">{selectedModel.notes}</p>
        ) : null}

        {items.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-rf-muted">
            Todavía no hay equipos. Ejemplo: Vocal 1 → Shure BLX4 H9, IEM → Xtuga
            IEM1200.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
            {items.map((item) => {
              const model = getWirelessModel(item.catalogId)
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="font-mono text-[11px] text-rf-muted">
                      {model ? catalogLabel(model) : item.catalogId}
                      {model ? ` · ${deviceTypeLabel(model.type)}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setItems((current) => current.filter((x) => x.id !== item.id))
                      setPlans([])
                      setSelectedPlanId(null)
                    }}
                    className="text-xs text-rf-muted hover:text-red-300"
                  >
                    Quitar
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-[#121820] p-4">
        <h3 className="text-sm font-semibold">2. Calcular</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={avoidOccupied}
              onChange={(e) => setAvoidOccupied(e.target.checked)}
              className="accent-teal-400"
            />
            Evitar frecuencias ocupadas del espectro
            {avoidOccupied && blocked.length > 0 ? (
              <span className="font-mono text-[11px] text-slate-500">
                ({blocked.length} picos)
              </span>
            ) : null}
          </label>
          <button
            type="button"
            onClick={onCalculate}
            disabled={items.length === 0}
            className="rounded-md bg-teal-400/20 px-3 py-1.5 text-sm font-medium text-teal-300 hover:bg-teal-400/30 disabled:opacity-40"
          >
            Calcular frecuencias
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        {savedMsg ? <p className="mt-2 text-sm text-teal-200/90">{savedMsg}</p> : null}
      </section>

      {plans.length > 0 ? (
        <section className="rounded-xl border border-white/10 bg-[#121820] p-4">
          <h3 className="text-sm font-semibold">3. Elige una opción</h3>
          <p className="mt-2 text-sm text-slate-300">
            En Shure BLX, los equipos de la <span className="text-teal-300">misma banda</span> (por
            ejemplo todos H9) deben ir en el <span className="text-teal-300">mismo grupo</span>.
            Shure ya coordinó los canales de cada grupo entre sí. Tú eliges el
            grupo (A, B, C…) y a cada micrófono le toca un canal distinto de ese
            grupo. No mezcles Grupo A con Grupo B en el mismo escenario.
          </p>
          <p className="mt-2 text-sm text-rf-muted">
            Si un BLX es H9 y otro H10, no pueden compartir grupo: son rangos
            distintos. Los Xtuga no usan grupo de Shure: se les asigna un MHz
            que no choque con los BLX.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plans.map((plan) => {
              const active = plan.id === selectedPlan?.id
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={[
                    'rounded-lg border px-3 py-2 text-left text-sm',
                    active
                      ? 'border-teal-400/60 bg-teal-400/15 text-teal-100'
                      : 'border-white/10 text-slate-300 hover:border-white/25',
                  ].join(' ')}
                >
                  <span className="block font-medium">{plan.title}</span>
                  <span className="block font-mono text-[11px] text-slate-400">
                    {plan.freeInGroup} canales libres en el grupo
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {selectedPlan ? (
        <section className="rounded-xl border border-white/10 bg-[#121820] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">4. Asignación para poner a mano</h3>
            <button
              type="button"
              onClick={() => void onApply()}
              disabled={saving}
              className="rounded-md border border-teal-400/40 px-3 py-1.5 text-sm text-teal-300 hover:bg-teal-400/10 disabled:opacity-40"
            >
              {saving ? 'Guardando…' : 'Usar esta opción'}
            </button>
          </div>
          <p className="mt-1 text-xs text-rf-muted">{selectedPlan.why}</p>
          <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-lg border border-white/10">
            {selectedPlan.assignments.map((row) => (
              <li key={row.unitId} className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{row.name}</p>
                    <p className="font-mono text-[11px] text-rf-muted">
                      {row.brand} {row.model} {row.bandLabel}
                    </p>
                  </div>
                  <p className="font-mono text-lg font-semibold text-teal-300">
                    {formatFrequencyMhz(row.frequencyMhz)}
                  </p>
                  <span className="rounded-md border border-orange-400/35 bg-orange-400/10 px-2 py-1 font-mono text-[11px] text-orange-100">
                    {row.hardware}
                  </span>
                </div>
                {row.alternatives.length > 0 ? (
                  <p className="mt-2 font-mono text-[11px] text-slate-500">
                    Otras opciones:{' '}
                    {row.alternatives
                      .map((alt) => `${alt.hardware} (${alt.frequencyMhz.toFixed(3)})`)
                      .join(' · ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
