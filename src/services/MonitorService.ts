import type { ChannelMetrics, ChannelMetricsSource } from '@/types/monitor'

export class MonitorService {
  private unsub: (() => void) | null = null
  private listeners = new Set<(metrics: ChannelMetrics[]) => void>()
  private latest: ChannelMetrics[] = []
  private readonly source: ChannelMetricsSource

  constructor(source: ChannelMetricsSource) {
    this.source = source
  }

  async start(deviceIds: string[]): Promise<void> {
    this.unsub?.()
    this.unsub = this.source.subscribe((metrics) => {
      this.latest = metrics
      for (const listener of this.listeners) listener(metrics)
    })
    await this.source.start(deviceIds)
  }

  async stop(): Promise<void> {
    this.unsub?.()
    this.unsub = null
    await this.source.stop()
  }

  getLatest(): ChannelMetrics[] {
    return this.latest
  }

  subscribe(listener: (metrics: ChannelMetrics[]) => void): () => void {
    this.listeners.add(listener)
    if (this.latest.length) listener(this.latest)
    return () => this.listeners.delete(listener)
  }

  getHistory(deviceId: string, windowMs: number): Promise<number[]> {
    return this.source.getHistory(deviceId, windowMs)
  }
}
