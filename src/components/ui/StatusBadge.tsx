import type { HardwareConnectionState } from '@/types/spectrum'
import type { SignalStatus } from '@/types/monitor'
import type { AlertSeverity } from '@/types/alerts'
import {
  ALERT_SEVERITY_LABELS,
  HARDWARE_STATE_LABELS,
  SIGNAL_STATUS_LABELS,
} from '@/utils/i18n'

const hardwareStyles: Record<HardwareConnectionState, string> = {
  simulated: 'bg-rf-cyan/15 text-rf-cyan border-rf-cyan/40',
  connected: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  connecting: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  disconnected: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40',
  error: 'bg-red-500/15 text-red-400 border-red-500/40',
}

const signalStyles: Record<SignalStatus, string> = {
  GOOD: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  WARNING: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  INTERFERENCE: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  NO_SIGNAL: 'bg-red-500/15 text-red-400 border-red-500/40',
}

const alertStyles: Record<AlertSeverity, string> = {
  info: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  critical: 'bg-red-500/15 text-red-400 border-red-500/40',
}

type Props =
  | { kind: 'hardware'; value: HardwareConnectionState; label?: string }
  | { kind: 'signal'; value: SignalStatus; label?: string }
  | { kind: 'alert'; value: AlertSeverity; label?: string }

export function StatusBadge(props: Props) {
  const style =
    props.kind === 'hardware'
      ? hardwareStyles[props.value]
      : props.kind === 'signal'
        ? signalStyles[props.value]
        : alertStyles[props.value]

  const text =
    props.label ??
    (props.kind === 'hardware'
      ? HARDWARE_STATE_LABELS[props.value]
      : props.kind === 'signal'
        ? SIGNAL_STATUS_LABELS[props.value]
        : ALERT_SEVERITY_LABELS[props.value])

  return (
    <span
      className={[
        'inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase',
        style,
      ].join(' ')}
    >
      {text}
    </span>
  )
}
