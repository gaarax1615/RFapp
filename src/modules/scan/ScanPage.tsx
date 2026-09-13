import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import {
  WIRELESS_CATALOG,
  catalogLabel,
  getWirelessModel,
  guessCatalogId,
} from '@/data/wirelessCatalog'
import { createId, formatFrequencyMhz, STORAGE_KEYS } from '@/utils/constants'
import { deviceTypeLabel } from '@/utils/i18n'
import type { RfDevice } from '@/types/device'
import type { SpectrumFrame } from '@/types/spectrum'
import { applyAssignments } from './applyAssignments'
import { surveyKitBands, scoreFromFrame } from './bandSurvey'
import {
  annotatePlanQuality,
  coordinateFrequencies,
  type CoordAssignment,
  type CoordPlan,
  type CoordUnit,
} from './coordinate'
import { EventFlowSteps } from './EventFlowSteps'
import { EventKitEditor } from './EventKitEditor'
import {
  qualityLabelEs,
  type ChannelQuality,
} from './eventKit'
import { occupiedFromFrame } from './scanSpectrum'

interface InventoryItem extends CoordUnit {}

function readInventory(): InventoryItem[] {
  try {
    localStorage.removeItem('rf-monitor.scan-inventory.v1')
  } catch {
    /* ignore */
  }
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

function qualityClass(q: ChannelQuality | undefined): string {
  if (q === 'clean') return 'border-zinc-400/40 bg-zinc-400/10 text-zinc-200'
  if (q === 'ok') return 'border-amber-400/40 bg-amber-400/10 text-amber-100'
  if (q === 'dirty') return 'border-red-400/40 bg-red-400/10 text-red-200'
  return 'border-white/15 bg-white/5 text-slate-300'
}

export function ScanPage() {
  const { devices: deviceService, spectrum, monitor } = useServices()
  const devices = useAppStore((s) => s.devices)
  const setDevices = useAppStore((s) => s.setDevices)
  const setSpectrumRange = useAppStore((s) => s.setSpectrumRange)
  const eventKitCatalogIds = useAppStore((s) => s.eventKitCatalogIds)
  const [items, setItems] = useState<InventoryItem[]>(readInventory)
  const [name, setName] = useState('')
  const [catalogId, setCatalogId] = useState(
    () => eventKitCatalogIds[0] ?? WIRELESS_CATALOG[0]!.id,
  )
  const [avoidOccupied, setAvoidOccupied] = useState(true)
  const [blocked, setBlocked] = useState<number[]>([])
  const [plans, setPlans] = useState<CoordPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [surveying, setSurveying] = useState(false)
  const [surveyMsg, setSurveyMsg] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const autoRescanDone = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const frameRef = useRef<SpectrumFrame | null>(spectrum.getLatestFrame())

  useEffect(() => {
    persistInventory(items)
  }, [items])

  useEffect(() => {
    if (eventKitCatalogIds.length > 0 && !eventKitCatalogIds.includes(catalogId)) {
      setCatalogId(eventKitCatalogIds[0]!)
    }
  }, [eventKitCatalogIds, catalogId])

  useEffect(() => {
    if (!avoidOccupied) {
      setBlocked([])
      return
    }
    const unsub = spectrum.subscribe((frame) => {
      frameRef.current = frame
      if (avoidOccupied) setBlocked(occupiedFromFrame(frame))
    })
    return unsub
  }, [avoidOccupied, spectrum])

  const selectedModel = getWirelessModel(catalogId)

  const catalogOptions = useMemo(() => {
    const kitModels = eventKitCatalogIds
      .map((id) => getWirelessModel(id))
      .filter((m): m is NonNullable<typeof m> => !!m)
    const rest = WIRELESS_CATALOG.filter((m) => !eventKitCatalogIds.includes(m.id))
    return { kitModels, rest }
  }, [eventKitCatalogIds])

  const devicesToUnits = (list: RfDevice[]): { items: InventoryItem[]; skipped: string[] } => {
    const next: InventoryItem[] = []
    const skipped: string[] = []
    for (const device of list) {
      const catalogIdGuess = guessCatalogId(device)
      if (!catalogIdGuess) {
        skipped.push(device.name)
        continue
      }
      next.push({
        id: device.id,
        name: device.name,
        catalogId: catalogIdGuess,
      })
    }
    return { items: next, skipped }
  }

  const loadExistingDevices = (): InventoryItem[] | null => {
    const { items: loaded, skipped } = devicesToUnits(devices)
    if (loaded.length === 0) {
      setError(
        skipped.length > 0
          ? `No pude reconocer el modelo de: ${skipped.join(', ')}. Elige el modelo y agrégalos una vez.`
          : 'No hay dispositivos guardados. Agrégalos arriba o en Dispositivos.',
      )
      return null
    }
    setItems(loaded)
    setPlans([])
    setSelectedPlanId(null)
    setSavedMsg(null)
    setError(
      skipped.length > 0
        ? `Cargados ${loaded.length}. Sin modelo: ${skipped.join(', ')}.`
        : null,
    )
    return loaded
  }

  const finishPlans = (
    units: InventoryItem[],
    score: (mhz: number) => number,
    blockedPeaks: number[],
    noiseFloor: number,
  ) => {
    const next = coordinateFrequencies(
      units,
      avoidOccupied ? blockedPeaks : [],
      score,
    )
    setSavedMsg(null)
    if (!next.ok) {
      setPlans([])
      setSelectedPlanId(null)
      setError(next.error)
      return
    }
    const annotated = next.plans.map((plan) =>
      annotatePlanQuality(plan, score, noiseFloor, (energy, floor) => {
        const above = energy - floor
        if (above < 8) return 'clean'
        if (above < 14) return 'ok'
        return 'dirty'
      }),
    )
    setError(null)
    setPlans(annotated)
    setSelectedPlanId(annotated[0]?.id ?? null)
  }

  const runQuickCalculate = (units: InventoryItem[]) => {
    const frame = frameRef.current ?? spectrum.getLatestFrame()
    finishPlans(
      units,
      scoreFromFrame(frame),
      avoidOccupied && frame ? occupiedFromFrame(frame) : blocked,
      -100,
    )
  }

  const runOptimalSurvey = async (units: InventoryItem[]) => {
    if (units.length === 0) {
      setError('Agrega al menos un dispositivo.')
      return
    }
    if (eventKitCatalogIds.length === 0) {
      setError('Elige los equipos del evento (mics / in-ears) arriba o en Ajustes.')
      return
    }

    const status = spectrum.getStatus()
    if (status.state === 'error') {
      setError(status.message ?? 'SDR con error. Revisa Ajustes.')
      return
    }

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setSurveying(true)
    setSurveyMsg('Preparando barrido…')
    setError(null)
    setSavedMsg(null)

    try {
      const { atlas, viewRange } = await surveyKitBands({
        spectrum,
        catalogIds: eventKitCatalogIds,
        signal: ac.signal,
        onProgress: (p) => setSurveyMsg(p.message),
      })
      if (viewRange) setSpectrumRange(viewRange)
      setSurveyMsg('Calculando plan óptimo…')
      finishPlans(
        units,
        (mhz) => atlas.score(mhz),
        avoidOccupied ? atlas.blockedPeaks() : [],
        atlas.noiseFloorDb(),
      )
      setSurveyMsg(null)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setSurveyMsg(null)
        return
      }
      setError(e instanceof Error ? e.message : 'No se pudo barrer el kit')
      setSurveyMsg(null)
    } finally {
      setSurveying(false)
    }
  }

  const onLoadExisting = () => {
    loadExistingDevices()
  }

  const onRescanExisting = () => {
    const loaded = items.length > 0 ? items : loadExistingDevices()
    if (!loaded || loaded.length === 0) return
    void runOptimalSurvey(loaded)
  }

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

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null

  const pickAlternative = (unitId: string, altIndex: number) => {
    if (!selectedPlan) return
    const row = selectedPlan.assignments.find((a) => a.unitId === unitId)
    if (!row || !row.alternatives[altIndex]) return
    const alt = row.alternatives[altIndex]!
    const nextAssignments: CoordAssignment[] = selectedPlan.assignments.map((a) => {
      if (a.unitId !== unitId) return a
      const previous: typeof a.alternatives[number] = {
        frequencyMhz: a.frequencyMhz,
        hardware: a.hardware,
      }
      const rest = a.alternatives.filter((_, i) => i !== altIndex)
      return {
        ...a,
        frequencyMhz: alt.frequencyMhz,
        hardware: alt.hardware,
        alternatives: [previous, ...rest].slice(0, 8),
      }
    })
    const updated: CoordPlan = { ...selectedPlan, assignments: nextAssignments }
    setPlans((current) => current.map((p) => (p.id === updated.id ? updated : p)))
  }

  const onApply = async () => {
    if (!selectedPlan) return
    setSaving(true)
    setError(null)
    try {
      await applyAssignments({
        assignments: selectedPlan.assignments,
        devices,
        deviceService,
        monitor,
        setDevices,
        channelSource: 'software',
        awaitingHardware: true,
      })
      setSavedMsg(
        'Frecuencias guardadas. Pon grupo/canal (o MHz) a mano en cada receptor y ve al Panel.',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (searchParams.get('rescan') !== 'all' || autoRescanDone.current) return
    if (devices.length === 0 && items.length === 0) return
    autoRescanDone.current = true
    const loaded = items.length > 0 ? items : loadExistingDevices()
    if (loaded && loaded.length > 0) void runOptimalSurvey(loaded)
    setSearchParams({}, { replace: true })
  }, [searchParams, devices, items.length])

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-auto p-5 md:p-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] text-rf-muted uppercase">
          Coordinación de frecuencias
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Escaneo</h2>
        <p className="mt-1 max-w-2xl text-sm text-rf-muted">
          Elige mics e in-ears del evento → barre esas bandas → te dice qué poner
          a mano en cada receptor. Luego monitoreas en el Panel.
        </p>
        <EventFlowSteps />
      </header>

      <EventKitEditor showSettingsLink />

      <section className="rounded-xl border border-white/10 bg-[#141414] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">1. Inventario</h3>
          {devices.length > 0 ? (
            <button
              type="button"
              onClick={onLoadExisting}
              className="rounded-md border border-white/10 px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:border-zinc-400/40 hover:text-zinc-300"
            >
              Cargar los {devices.length} ya guardados
            </button>
          ) : null}
        </div>
        <form onSubmit={onAdd} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-0.5 block font-mono text-[10px] text-rf-muted uppercase">
              Nombre
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vocal 1"
              className="w-[10rem] rounded-md border border-white/10 bg-[#050505] px-2 py-1.5 text-sm outline-none focus:border-zinc-400/50"
            />
          </label>
          <label className="block min-w-[14rem] flex-1">
            <span className="mb-0.5 block font-mono text-[10px] text-rf-muted uppercase">
              Modelo
            </span>
            <select
              value={catalogId}
              onChange={(e) => setCatalogId(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-[#050505] px-2 py-1.5 text-sm outline-none focus:border-zinc-400/50"
            >
              {catalogOptions.kitModels.length > 0 ? (
                <optgroup label="Kit del evento">
                  {catalogOptions.kitModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {catalogLabel(model)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label="Otros">
                {catalogOptions.rest.map((model) => (
                  <option key={model.id} value={model.id}>
                    {catalogLabel(model)}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-zinc-400/20 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-400/30"
          >
            Agregar
          </button>
        </form>
        {selectedModel ? (
          <p className="mt-2 text-xs text-rf-muted">{selectedModel.notes}</p>
        ) : null}

        {items.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-sm text-rf-muted">
            Lista vacía. Ejemplo: Vocal 1 → BLX K12, IEM L → Xtuga IEM1200.
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
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setItems([])
              setPlans([])
              setSelectedPlanId(null)
              setSavedMsg(null)
              setError(null)
            }}
            className="mt-3 text-xs text-rf-muted hover:text-red-300"
          >
            Vaciar lista
          </button>
        ) : null}
      </section>

      <section className="rounded-xl border border-white/10 bg-[#141414] p-4">
        <h3 className="text-sm font-semibold">2. Buscar óptimas</h3>
        <p className="mt-1 text-xs text-rf-muted">
          Barre las bandas del kit (mics + ears), puntúa canales legales y te
          dice qué programar a mano. Mejor con transmisores apagados.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={avoidOccupied}
              onChange={(e) => setAvoidOccupied(e.target.checked)}
              className="accent-zinc-400"
            />
            Evitar frecuencias ocupadas
            {avoidOccupied && blocked.length > 0 ? (
              <span className="font-mono text-[11px] text-slate-500">
                ({blocked.length} picos en vista)
              </span>
            ) : null}
          </label>
          <button
            type="button"
            onClick={() => void runOptimalSurvey(items)}
            disabled={items.length === 0 || surveying}
            className="rounded-md bg-zinc-400/20 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-400/30 disabled:opacity-40"
          >
            {surveying ? 'Barriendo…' : 'Buscar óptimas'}
          </button>
          <button
            type="button"
            onClick={() => runQuickCalculate(items)}
            disabled={items.length === 0 || surveying}
            className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:border-white/30 disabled:opacity-40"
          >
            Calcular con vista actual
          </button>
          <button
            type="button"
            onClick={onRescanExisting}
            disabled={(items.length === 0 && devices.length === 0) || surveying}
            className="rounded-md border border-zinc-400/40 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-400/10 disabled:opacity-40"
          >
            Reescanear los de ahora
          </button>
          {surveying ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="text-xs text-red-300 hover:text-red-200"
            >
              Cancelar
            </button>
          ) : null}
        </div>
        {surveyMsg ? (
          <p className="mt-2 font-mono text-xs text-zinc-200/90">{surveyMsg}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        {savedMsg ? (
          <p className="mt-2 text-sm text-zinc-200/90">
            {savedMsg}{' '}
            <Link to="/panel" className="underline hover:text-zinc-100">
              Ir al Panel
            </Link>
          </p>
        ) : null}
      </section>

      {plans.length > 0 ? (
        <section className="rounded-xl border border-white/10 bg-[#141414] p-4">
          <h3 className="text-sm font-semibold">3. Elige una opción</h3>
          <p className="mt-2 text-sm text-slate-300">
            En Shure BLX se prefiere misma banda = mismo grupo. Si ese grupo se
            llena, el resto pasa al siguiente grupo más limpio. Los in-ears van en
            MHz que no choquen con las petacas.
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
                      ? 'border-zinc-400/60 bg-zinc-400/15 text-zinc-100'
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
        <section className="rounded-xl border border-white/10 bg-[#141414] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">4. Pon esto a mano en el receptor</h3>
            <button
              type="button"
              onClick={() => void onApply()}
              disabled={saving}
              className="rounded-md border border-zinc-400/40 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-400/10 disabled:opacity-40"
            >
              {saving ? 'Guardando…' : 'Actualizar frecuencias'}
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
                  <span
                    className={[
                      'rounded-md border px-2 py-1 font-mono text-[11px]',
                      qualityClass(row.quality),
                    ].join(' ')}
                  >
                    {row.quality ? qualityLabelEs(row.quality) : '—'}
                  </span>
                  <p className="font-mono text-lg font-semibold text-zinc-300">
                    {formatFrequencyMhz(row.frequencyMhz)}
                  </p>
                  <span className="rounded-md border border-orange-400/35 bg-orange-400/10 px-2.5 py-1.5 font-mono text-sm text-orange-100">
                    {row.hardware}
                  </span>
                </div>
                {row.alternatives.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="w-full font-mono text-[10px] text-slate-500 uppercase">
                      Otras opciones (clic para usar)
                    </span>
                    {row.alternatives.map((alt, index) => (
                      <button
                        key={`${alt.frequencyMhz}-${index}`}
                        type="button"
                        onClick={() => pickAlternative(row.unitId, index)}
                        className="rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-zinc-400/40 hover:text-zinc-200"
                      >
                        {alt.hardware} · {alt.frequencyMhz.toFixed(3)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
