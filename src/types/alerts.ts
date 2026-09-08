export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface RfAlert {
  id: string
  timestamp: number
  severity: AlertSeverity
  message: string
  frequencyMhz?: number
  deviceId?: string
}
