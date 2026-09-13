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

/** Variación del nivel RF: bajo = la frecuencia se mantiene. */
export function stabilityLabel(stabilityDb: number, sampleCount = 8): string {
  if (sampleCount < 3) return 'Midiendo…'
  if (stabilityDb < 2) return 'Estable'
  if (stabilityDb < 4) return 'Aceptable'
  if (stabilityDb < 8) return 'Irregular'
  return 'Inestable'
}

export function formatStability(stabilityDb: number, sampleCount = 8): string {
  if (sampleCount < 3) return 'Midiendo…'
  return `${stabilityLabel(stabilityDb, sampleCount)} · ${stabilityDb.toFixed(1)} dB`
}

export function channelSourceLabel(
  source: 'software' | 'receiver' | undefined,
): string {
  if (source === 'receiver') return 'Receptor'
  if (source === 'software') return 'App'
  return ''
}

/** Grupo B Canal 8 → B8 (no B-8). */
export function formatDeviceChannel(channel: string | undefined): string {
  if (!channel?.trim()) return '—'
  const raw = channel.trim()
  const fromHardware = raw.match(/^Grupo\s+([A-Za-z0-9]+)\s*·\s*Canal\s+([A-Za-z0-9]+)$/i)
  if (fromHardware) return `${fromHardware[1]!.toUpperCase()}${fromHardware[2]}`
  const dashed = raw.match(/^([A-Za-z0-9]+)\s*[-–]\s*([A-Za-z0-9]+)$/)
  if (dashed) return `${dashed[1]!.toUpperCase()}${dashed[2]}`
  return raw
}
