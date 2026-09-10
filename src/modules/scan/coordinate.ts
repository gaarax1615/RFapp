import {
  getWirelessModel,
  type PresetChannel,
  type PresetGroup,
  type WirelessModel,
} from '@/data/wirelessCatalog'

export interface CoordUnit {
  id: string
  name: string
  catalogId: string
}

export interface FreqChoice {
  frequencyMhz: number
  hardware: string
}

export interface CoordAssignment {
  unitId: string
  name: string
  catalogId: string
  frequencyMhz: number
  hardware: string
  brand: string
  model: string
  bandLabel: string
  type: WirelessModel['type']
  alternatives: FreqChoice[]
}

export interface CoordPlan {
  id: string
  title: string
  why: string
  freeInGroup: number
  assignments: CoordAssignment[]
}

export interface CoordSuccess {
  ok: true
  plans: CoordPlan[]
}

export interface CoordError {
  ok: false
  error: string
}

type Taken = { mhz: number; model: WirelessModel }
type Resolved = { unit: CoordUnit; model: WirelessModel }

const IM_GUARD_MHZ = 0.12

function roundMhz(mhz: number): number {
  return +mhz.toFixed(3)
}

function isIem(model: WirelessModel): boolean {
  return model.type === 'IEM'
}

function minSpacing(a: WirelessModel, b: WirelessModel): number {
  if (isIem(a) && isIem(b)) return 0.8
  if (isIem(a) || isIem(b)) return 0.5
  return 0.4
}

function tooClose(freq: number, model: WirelessModel, taken: Taken[]): boolean {
  return taken.some(
    (t) => Math.abs(t.mhz - freq) < minSpacing(model, t.model) - 1e-6,
  )
}

function blockedNear(freq: number, blocked: number[], guard = 0.2): boolean {
  return blocked.some((b) => Math.abs(b - freq) < guard)
}

function im3Hits(freq: number, taken: { mhz: number }[], guard = IM_GUARD_MHZ): boolean {
  const all = [...taken.map((t) => t.mhz), freq]
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const im1 = 2 * all[i] - all[j]
      const im2 = 2 * all[j] - all[i]
      for (let k = 0; k < all.length; k++) {
        if (k === i || k === j) continue
        if (Math.abs(all[k] - im1) < guard || Math.abs(all[k] - im2) < guard) {
          return true
        }
      }
    }
  }
  return false
}

function candidateOk(
  freq: number,
  model: WirelessModel,
  taken: Taken[],
  blocked: number[],
): boolean {
  if (freq < model.startMhz - 0.001 || freq > model.endMhz + 0.001) return false
  if (tooClose(freq, model, taken)) return false
  if (blockedNear(freq, blocked)) return false
  if (im3Hits(freq, taken)) return false
  return true
}

function viableBlxGroups(
  model: WirelessModel,
  count: number,
  taken: Taken[],
  blocked: number[],
): { group: PresetGroup; usable: PresetChannel[] }[] {
  return (model.groups ?? [])
    .map((group) => ({
      group,
      usable: group.channels.filter((c) => candidateOk(c.mhz, model, taken, blocked)),
    }))
    .filter((g) => g.usable.length >= count)
    .sort((a, b) => b.usable.length - a.usable.length)
}

function pllCandidates(model: WirelessModel): number[] {
  const out: number[] = []
  const step = model.stepMhz || 0.25
  for (let f = model.startMhz; f <= model.endMhz + 1e-9; f += step) {
    out.push(roundMhz(f))
  }
  return out
}

function assignment(
  unit: CoordUnit,
  model: WirelessModel,
  frequencyMhz: number,
  hardware: string,
  alternatives: FreqChoice[],
): CoordAssignment {
  return {
    unitId: unit.id,
    name: unit.name,
    catalogId: model.id,
    frequencyMhz,
    hardware,
    brand: model.brand,
    model: model.model,
    bandLabel: model.bandLabel,
    type: model.type,
    alternatives,
  }
}

function placePll(
  others: Resolved[],
  takenStart: Taken[],
  blocked: number[],
): CoordAssignment[] | null {
  const taken = [...takenStart]
  const out: CoordAssignment[] = []
  for (const row of others) {
    const model = row.model
    const good = pllCandidates(model).filter((f) =>
      candidateOk(f, model, taken, blocked),
    )
    const pick = good[0]
    if (pick == null) return null
    taken.push({ mhz: pick, model })
    out.push(
      assignment(
        row.unit,
        model,
        pick,
        `${pick.toFixed(3)} MHz en el transmisor`,
        good.slice(1, 6).map((f) => ({
          frequencyMhz: f,
          hardware: `${f.toFixed(3)} MHz en el transmisor`,
        })),
      ),
    )
  }
  return out
}

function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]],
  )
}

export function coordinateFrequencies(
  units: CoordUnit[],
  blocked: number[] = [],
): CoordSuccess | CoordError {
  if (units.length === 0) {
    return { ok: false, error: 'Agrega al menos un dispositivo.' }
  }

  const resolved: Resolved[] = []
  for (const unit of units) {
    const model = getWirelessModel(unit.catalogId)
    if (!model) return { ok: false, error: `Modelo no reconocido: ${unit.catalogId}` }
    resolved.push({ unit, model })
  }

  const blxBands: { catalogId: string; model: WirelessModel; units: Resolved[] }[] = []
  const others: Resolved[] = []
  for (const row of resolved) {
    if (row.model.tuning === 'blx-group-channel') {
      let band = blxBands.find((b) => b.catalogId === row.model.id)
      if (!band) {
        band = { catalogId: row.model.id, model: row.model, units: [] }
        blxBands.push(band)
      }
      band.units.push(row)
    } else {
      others.push(row)
    }
  }

  const perBandOptions = blxBands.map((band) => {
    const options = viableBlxGroups(band.model, band.units.length, [], blocked)
    return { band, options }
  })

  const emptyBand = perBandOptions.find((b) => b.options.length === 0)
  if (emptyBand) {
    return {
      ok: false,
      error: `No hay un grupo BLX ${emptyBand.band.model.bandLabel} con ${emptyBand.band.units.length} canales libres. Mira la etiqueta de banda o quita el filtro de ocupadas.`,
    }
  }

  const combos =
    perBandOptions.length === 0
      ? [[]]
      : cartesian(perBandOptions.map((b) => b.options))

  const plans: CoordPlan[] = []
  for (const combo of combos) {
    const taken: Taken[] = []
    const blxAssignments: CoordAssignment[] = []
    const titleParts: string[] = []
    let minFree = 99

    combo.forEach((choice, bandIndex) => {
      const band = perBandOptions[bandIndex]!.band
      const { group, usable } = choice
      minFree = Math.min(minFree, usable.length)
      titleParts.push(`BLX ${band.model.bandLabel} ${group.label}`)
      band.units.forEach((row, index) => {
        const channel = usable[index]!
        taken.push({ mhz: channel.mhz, model: band.model })
        const unused = usable.slice(band.units.length)
        const rest = unused.slice(0, 8).map((c) => ({
          frequencyMhz: c.mhz,
          hardware: `${group.label} · Canal ${c.label}`,
        }))
        blxAssignments.push(
          assignment(
            row.unit,
            band.model,
            channel.mhz,
            `${group.label} · Canal ${channel.label}`,
            rest,
          ),
        )
      })
    })

    const pll = placePll(others, taken, blocked)
    if (!pll) continue

    const order = new Map(units.map((u, i) => [u.id, i]))
    const assignments = [...blxAssignments, ...pll].sort(
      (a, b) => (order.get(a.unitId) ?? 0) - (order.get(b.unitId) ?? 0),
    )

    const why =
      titleParts.length > 0
        ? `Todos los BLX de la misma banda en el mismo grupo (carta Shure). Canales distintos dentro de ese grupo. ${minFree} canales libres en el grupo elegido.`
        : 'Frecuencias PLL separadas y sin intermodulación de 3er orden entre ellas.'

    plans.push({
      id: `plan-${plans.length}-${titleParts.join('-') || 'pll'}`,
      title:
        titleParts.length > 0
          ? `Opción ${plans.length + 1} · ${titleParts.join(' + ')}`
          : `Opción ${plans.length + 1} · Xtuga`,
      why,
      freeInGroup: minFree === 99 ? pll.length : minFree,
      assignments,
    })
    if (plans.length >= 8) break
  }

  if (plans.length === 0) {
    return {
      ok: false,
      error: 'No se pudo armar un plan libre. Quita el filtro de ocupadas o reduce equipos.',
    }
  }

  return { ok: true, plans }
}
