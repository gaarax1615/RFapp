import type { RfListenBand } from '@/types/audio'
import {
  DEFAULT_LISTEN_BW_MHZ,
  MAX_LISTEN_SPAN_MHZ,
  MIN_LISTEN_SPAN_MHZ,
} from '@/types/audio'

export function makeListenBand(
  aMhz: number,
  bMhz: number,
): RfListenBand | null {
  if (!Number.isFinite(aMhz) || !Number.isFinite(bMhz)) return null
  let start = Math.min(aMhz, bMhz)
  let end = Math.max(aMhz, bMhz)
  if (end - start < MIN_LISTEN_SPAN_MHZ) {
    const mid = (start + end) / 2
    start = mid - DEFAULT_LISTEN_BW_MHZ / 2
    end = mid + DEFAULT_LISTEN_BW_MHZ / 2
  }
  if (end - start > MAX_LISTEN_SPAN_MHZ) {
    const mid = (start + end) / 2
    start = mid - MAX_LISTEN_SPAN_MHZ / 2
    end = mid + MAX_LISTEN_SPAN_MHZ / 2
  }
  return {
    startMhz: +start.toFixed(4),
    endMhz: +end.toFixed(4),
  }
}

export function clickListenBand(centerMhz: number): RfListenBand | null {
  return makeListenBand(
    centerMhz - DEFAULT_LISTEN_BW_MHZ / 2,
    centerMhz + DEFAULT_LISTEN_BW_MHZ / 2,
  )
}
