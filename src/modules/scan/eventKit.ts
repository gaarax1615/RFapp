import {
  getWirelessModel,
  catalogLabel,
  type WirelessModel,
} from '@/data/wirelessCatalog'
import { STORAGE_KEYS } from '@/utils/constants'
import { ABS_MAX_MHZ, ABS_MIN_MHZ, MIN_SPAN_MHZ } from '@/modules/spectrum/spectrumRange'

/** Tope al anclar el kit (bandas BLX ~12–30 MHz + unión cercana). */
export const MAX_KIT_SPAN_MHZ = 40
/** Si la unión de mics+ears supera esto, la vista RTA se queda en la banda de mics. */
export const VIEW_UNION_LIMIT_MHZ = 40

export interface MhzRange {
  startMhz: number
  endMhz: number
}

const DEFAULT_KIT = ['shure-blx4-k12']

export function readEventKit(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.eventKitCatalogIds)
    if (!raw) return [...DEFAULT_KIT]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_KIT]
    const ids = parsed.filter((id): id is string => typeof id === 'string' && !!getWirelessModel(id))
    return ids.length > 0 ? ids : [...DEFAULT_KIT]
  } catch {
    return [...DEFAULT_KIT]
  }
}

export function writeEventKit(catalogIds: string[]): void {
  const unique = [...new Set(catalogIds.filter((id) => getWirelessModel(id)))]
  try {
    localStorage.setItem(STORAGE_KEYS.eventKitCatalogIds, JSON.stringify(unique))
  } catch {
    /* ignore */
  }
}

export function resolveKitModels(catalogIds: string[]): WirelessModel[] {
  return catalogIds
    .map((id) => getWirelessModel(id))
    .filter((m): m is WirelessModel => !!m)
}

export function kitBandRanges(catalogIds: string[]): MhzRange[] {
  return resolveKitModels(catalogIds).map((m) => ({
    startMhz: m.startMhz,
    endMhz: m.endMhz,
  }))
}

function mergeOverlapping(ranges: MhzRange[]): MhzRange[] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.startMhz - b.startMhz)
  const out: MhzRange[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.startMhz <= last.endMhz + 1) {
      last.endMhz = Math.max(last.endMhz, cur.endMhz)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

/** Ventanas a barrer al buscar óptimas (una por banda del kit, partidas si hace falta). */
export function kitSurveyWindows(catalogIds: string[]): MhzRange[] {
  const merged = mergeOverlapping(kitBandRanges(catalogIds))
  const windows: MhzRange[] = []
  for (const band of merged) {
    let start = band.startMhz
    while (start < band.endMhz - 0.01) {
      const end = Math.min(band.endMhz, start + MAX_KIT_SPAN_MHZ)
      windows.push({
        startMhz: +start.toFixed(4),
        endMhz: +end.toFixed(4),
      })
      if (end >= band.endMhz) break
      start = end
    }
  }
  return windows
}

/**
 * Vista RTA anclada al kit:
 * - Unión si cabe en VIEW_UNION_LIMIT_MHZ
 * - Si no, primera banda de micrófono (o primer modelo)
 */
export function kitPrimaryViewRange(catalogIds: string[]): MhzRange | null {
  const models = resolveKitModels(catalogIds)
  if (models.length === 0) return null

  const merged = mergeOverlapping(
    models.map((m) => ({ startMhz: m.startMhz, endMhz: m.endMhz })),
  )
  if (merged.length === 1) {
    const only = merged[0]!
    if (only.endMhz - only.startMhz <= VIEW_UNION_LIMIT_MHZ) {
      return clampKitRange(only.startMhz, only.endMhz)
    }
  }

  const mic = models.find((m) => m.type === 'Microphone') ?? models[0]!
  return clampKitRange(mic.startMhz, mic.endMhz)
}

export function clampKitRange(startMhz: number, endMhz: number): MhzRange | null {
  if (!Number.isFinite(startMhz) || !Number.isFinite(endMhz)) return null
  let start = Math.max(ABS_MIN_MHZ, Math.min(ABS_MAX_MHZ, startMhz))
  let end = Math.max(ABS_MIN_MHZ, Math.min(ABS_MAX_MHZ, endMhz))
  if (start > end) [start, end] = [end, start]
  if (end - start < MIN_SPAN_MHZ) {
    const mid = (start + end) / 2
    start = mid - MIN_SPAN_MHZ / 2
    end = mid + MIN_SPAN_MHZ / 2
  }
  if (end - start > MAX_KIT_SPAN_MHZ) {
    const mid = (start + end) / 2
    start = mid - MAX_KIT_SPAN_MHZ / 2
    end = mid + MAX_KIT_SPAN_MHZ / 2
  }
  start = Math.max(ABS_MIN_MHZ, start)
  end = Math.min(ABS_MAX_MHZ, end)
  if (end - start < MIN_SPAN_MHZ) return null
  return { startMhz: +start.toFixed(4), endMhz: +end.toFixed(4) }
}

export function kitSummaryLabel(catalogIds: string[]): string {
  const models = resolveKitModels(catalogIds)
  if (models.length === 0) return 'Sin equipos'
  return models.map((m) => catalogLabel(m)).join(' + ')
}

export type ChannelQuality = 'clean' | 'ok' | 'dirty'

export function qualityFromEnergy(
  energyDb: number,
  noiseFloorDb: number,
): ChannelQuality {
  const above = energyDb - noiseFloorDb
  if (above < 8) return 'clean'
  if (above < 14) return 'ok'
  return 'dirty'
}

export function qualityLabelEs(q: ChannelQuality): string {
  if (q === 'clean') return 'Limpia'
  if (q === 'ok') return 'Aceptable'
  return 'Sucia'
}
