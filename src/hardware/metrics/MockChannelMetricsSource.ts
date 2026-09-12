import { MOCK_METRICS_PARAMS } from '@/data'
import type { ChannelMetrics, ChannelMetricsSource, SignalStatus } from '@/types/monitor'

interface DeviceSimState {
  baseSignal: number
  history: { t: number; signal: number }[]
}

/**
 * Métricas por canal simuladas (datos en `src/data/mockMetrics`).
 */
export class MockChannelMetricsSource implements ChannelMetricsSource {
  private listeners = new Set<(metrics: ChannelMetrics[]) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private deviceIds: string[] = []
  private state = new Map<string, DeviceSimState>()

  async start(deviceIds: string[]): Promise<void> {
    const p = MOCK_METRICS_PARAMS
    this.deviceIds = [...deviceIds]
    for (const id of deviceIds) {
      if (!this.state.has(id)) {
        const span = p.baseSignalMaxDbm - p.baseSignalMinDbm
        this.state.set(id, {
          baseSignal: p.baseSignalMinDbm + Math.random() * span,
          history: [],
        })
      }
    }
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => this.tick(), p.tickIntervalMs)
    this.tick()
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  subscribe(listener: (metrics: ChannelMetrics[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async getHistory(deviceId: string, windowMs: number): Promise<number[]> {
    const entry = this.state.get(deviceId)
    if (!entry) return []
    const cutoff = Date.now() - windowMs
    return entry.history.filter((h) => h.t >= cutoff).map((h) => h.signal)
  }

  private tick(): void {
    const p = MOCK_METRICS_PARAMS
    const now = Date.now()
    const metrics: ChannelMetrics[] = this.deviceIds.map((deviceId, index) => {
      const sim = this.state.get(deviceId)!
      const noiseFloorDbm =
        p.noiseFloorBaseDbm + (Math.random() - 0.5) * p.noiseFloorJitterDb
      let signalDbm =
        sim.baseSignal + Math.sin(now / 1800 + index) * 3 + (Math.random() - 0.5) * 2

      const roll = Math.random()
      if (roll < p.dropChance) signalDbm -= 25
      if (roll > 1 - p.interferenceChance) signalDbm = Math.max(signalDbm, -35)

      const snrDb = signalDbm - noiseFloorDbm
      const status = deriveStatus(signalDbm, snrDb, roll)

      sim.history.push({ t: now, signal: signalDbm })
      if (sim.history.length > p.historyMaxSamples) sim.history.shift()

      return {
        deviceId,
        timestamp: now,
        signalDbm,
        noiseFloorDbm,
        snrDb,
        stabilityDb: 1.2 + Math.abs(Math.sin(now / 4000 + index)),
        sampleCount: sim.history.length,
        status,
      }
    })

    for (const listener of this.listeners) {
      listener(metrics)
    }
  }
}

function deriveStatus(signalDbm: number, snrDb: number, roll: number): SignalStatus {
  const t = MOCK_METRICS_PARAMS.thresholds
  if (signalDbm < t.noSignalDbm || snrDb < t.noSignalSnrDb) return 'NO_SIGNAL'
  if (roll > 1 - MOCK_METRICS_PARAMS.interferenceChance || snrDb < t.interferenceSnrDb) {
    return 'INTERFERENCE'
  }
  if (signalDbm < t.warningDbm || snrDb < t.warningSnrDb) return 'WARNING'
  return 'GOOD'
}
