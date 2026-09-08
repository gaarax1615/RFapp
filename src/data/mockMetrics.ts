/**
 * Parámetros del simulador de métricas por canal (Monitor).
 */
export const MOCK_METRICS_PARAMS = {
  tickIntervalMs: 500,
  baseSignalMinDbm: -65,
  baseSignalMaxDbm: -45,
  noiseFloorBaseDbm: -88,
  noiseFloorJitterDb: 4,
  historyMaxSamples: 240,
  /** Probabilidad de caída fuerte por tick */
  dropChance: 0.02,
  /** Probabilidad de interferencia fuerte por tick */
  interferenceChance: 0.015,
  thresholds: {
    noSignalDbm: -85,
    noSignalSnrDb: 8,
    interferenceSnrDb: 18,
    warningDbm: -65,
    warningSnrDb: 25,
  },
} as const
