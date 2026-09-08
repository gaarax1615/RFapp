export type CarrierShape = 'narrow' | 'digital' | 'wide' | 'spur'

export interface SimulatedCarrier {
  frequencyMhz: number
  peakDb: number
  /** Ancho ocupado / característico en MHz */
  bwMhz: number
  shape: CarrierShape
  fadeHz: number
  phase: number
}

export interface SimulatedNoiseBand {
  startMhz: number
  endMhz: number
  liftDb: number
}

/** Parámetros globales del generador de espectro simulado. */
export const MOCK_SPECTRUM_PARAMS = {
  noiseFloorDb: -96,
  noiseFloorDrift: 1.2,
  interferenceChance: 0.012,
  interferenceDurationMsMin: 1800,
  interferenceDurationMsMax: 5000,
  interferencePeakDb: -26,
  interferenceWidthMhz: 1.2,
} as const

/**
 * Portadoras simuladas (alineadas con seedDevices + ambiente del venue).
 */
export const MOCK_CARRIERS: SimulatedCarrier[] = [
  { frequencyMhz: 518.5, peakDb: -41, bwMhz: 0.22, shape: 'digital', fadeHz: 0.7, phase: 0.2 },
  { frequencyMhz: 526.2, peakDb: -44, bwMhz: 0.2, shape: 'digital', fadeHz: 0.9, phase: 1.1 },
  { frequencyMhz: 542.3, peakDb: -38, bwMhz: 0.18, shape: 'narrow', fadeHz: 1.2, phase: 2.4 },
  { frequencyMhz: 556.75, peakDb: -52, bwMhz: 0.16, shape: 'narrow', fadeHz: 0.5, phase: 0.8 },
  { frequencyMhz: 580.1, peakDb: -36, bwMhz: 0.35, shape: 'digital', fadeHz: 0.4, phase: 3.0 },
  // Ambiente / otros sistemas
  { frequencyMhz: 488.0, peakDb: -58, bwMhz: 5.5, shape: 'wide', fadeHz: 0.15, phase: 0.5 },
  { frequencyMhz: 512.0, peakDb: -55, bwMhz: 5.8, shape: 'wide', fadeHz: 0.12, phase: 1.7 },
  { frequencyMhz: 605.0, peakDb: -62, bwMhz: 0.08, shape: 'spur', fadeHz: 2.5, phase: 4.2 },
  { frequencyMhz: 620.25, peakDb: -48, bwMhz: 0.25, shape: 'digital', fadeHz: 0.6, phase: 2.1 },
  { frequencyMhz: 650.0, peakDb: -68, bwMhz: 0.05, shape: 'spur', fadeHz: 3.0, phase: 0.3 },
  { frequencyMhz: 674.0, peakDb: -57, bwMhz: 4.0, shape: 'wide', fadeHz: 0.1, phase: 5.5 },
]

/** Bandas con piso de ruido elevado (LTE / congestión simulada). */
export const MOCK_NOISE_BANDS: SimulatedNoiseBand[] = [
  { startMhz: 470, endMhz: 500, liftDb: 4 },
  { startMhz: 600, endMhz: 650, liftDb: 6 },
  { startMhz: 680, endMhz: 698, liftDb: 3 },
]
