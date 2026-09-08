import type { DeviceType } from '@/types/device'
import type { SignalStatus } from '@/types/monitor'
import type { AlertSeverity } from '@/types/alerts'
import type { HardwareConnectionState } from '@/types/spectrum'

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  Microphone: 'Micrófono',
  Instrument: 'Instrumento',
  IEM: 'IEM',
  Bodypack: 'Bodypack',
  Other: 'Otro',
}

export const SIGNAL_STATUS_LABELS: Record<SignalStatus, string> = {
  GOOD: 'BUENO',
  WARNING: 'AVISO',
  INTERFERENCE: 'INTERFERENCIA',
  NO_SIGNAL: 'SIN SEÑAL',
}

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  info: 'INFO',
  warning: 'AVISO',
  critical: 'CRÍTICA',
}

export const HARDWARE_STATE_LABELS: Record<HardwareConnectionState, string> = {
  disconnected: 'DESCONECTADO',
  connecting: 'CONECTANDO',
  connected: 'CONECTADO',
  error: 'ERROR',
  simulated: 'SIMULADO',
}

export function deviceTypeLabel(type: DeviceType): string {
  return DEVICE_TYPE_LABELS[type] ?? type
}
