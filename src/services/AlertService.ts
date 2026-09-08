import type { RfAlert, AlertSeverity } from '@/types/alerts'
import type { ChannelMetrics } from '@/types/monitor'
import type { RfDevice } from '@/types/device'
import type { SpectrumFrame } from '@/types/spectrum'
import { createId } from '@/utils/constants'

/**
 * Separated alert engine. Consumes metrics/frames from services;
 * UI only reads alerts — never generates detection logic inline.
 */
export class AlertService {
  private alerts: RfAlert[] = []
  private listeners = new Set<(alerts: RfAlert[]) => void>()
  private lastEmit = new Map<string, number>()
  private readonly cooldownMs = 12_000

  getAlerts(): RfAlert[] {
    return [...this.alerts]
  }

  subscribe(listener: (alerts: RfAlert[]) => void): () => void {
    this.listeners.add(listener)
    listener(this.getAlerts())
    return () => this.listeners.delete(listener)
  }

  clear(): void {
    this.alerts = []
    this.notify()
  }

  dismiss(id: string): void {
    this.alerts = this.alerts.filter((a) => a.id !== id)
    this.notify()
  }

  evaluateMetrics(metrics: ChannelMetrics[], devices: RfDevice[]): void {
    const byId = new Map(devices.map((d) => [d.id, d]))
    for (const m of metrics) {
      const device = byId.get(m.deviceId)
      if (!device) continue
      if (m.status === 'NO_SIGNAL') {
        this.push(
          'critical',
          `Caída de señal detectada en ${device.name}`,
          device.frequencyMhz,
          device.id,
          `drop:${device.id}`,
        )
      } else if (m.status === 'INTERFERENCE') {
        this.push(
          'warning',
          `Posible interferencia cerca de ${device.frequencyMhz.toFixed(3)} MHz`,
          device.frequencyMhz,
          device.id,
          `intf:${device.id}`,
        )
      } else if (m.status === 'WARNING' && m.noiseFloorDbm > -80) {
        this.push(
          'warning',
          `Piso de ruido alto cerca de ${device.name}`,
          device.frequencyMhz,
          device.id,
          `noise:${device.id}`,
        )
      }
    }
  }

  evaluateSpectrum(frame: SpectrumFrame, devices: RfDevice[]): void {
    const enabled = devices.filter((d) => d.enabled)
    for (const device of enabled) {
      const power = samplePowerAt(frame, device.frequencyMhz)
      if (power === null) continue
      // Strong unexpected energy within ±0.5 MHz of a quiet device band edge
      const neighbor = samplePowerAt(frame, device.frequencyMhz + 0.6)
      if (neighbor !== null && neighbor > -40 && power > -50) {
        this.push(
          'info',
          `Energía elevada cerca de ${device.name} (${device.frequencyMhz.toFixed(3)} MHz)`,
          device.frequencyMhz,
          device.id,
          `elev:${device.id}`,
        )
      }
    }
  }

  private push(
    severity: AlertSeverity,
    message: string,
    frequencyMhz: number | undefined,
    deviceId: string | undefined,
    key: string,
  ): void {
    const now = Date.now()
    const last = this.lastEmit.get(key) ?? 0
    if (now - last < this.cooldownMs) return
    this.lastEmit.set(key, now)

    const alert: RfAlert = {
      id: createId('alert'),
      timestamp: now,
      severity,
      message,
      frequencyMhz,
      deviceId,
    }
    this.alerts = [alert, ...this.alerts].slice(0, 50)
    this.notify()
  }

  private notify(): void {
    const snapshot = this.getAlerts()
    for (const listener of this.listeners) listener(snapshot)
  }
}

function samplePowerAt(frame: SpectrumFrame, frequencyMhz: number): number | null {
  if (
    frequencyMhz < frame.startFrequencyMhz ||
    frequencyMhz > frame.endFrequencyMhz
  ) {
    return null
  }
  const index = Math.round(
    (frequencyMhz - frame.startFrequencyMhz) / frame.binWidthMhz,
  )
  if (index < 0 || index >= frame.powerDb.length) return null
  return frame.powerDb[index] ?? null
}
