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
  connected: 'bg-white/10 text-white border-zinc-400/50',
  connecting: 'bg-zinc-500/15 text-zinc-200 border-zinc-400/40',
  disconnected: 'bg-black text-zinc-400 border-white/20',
  error: 'bg-black text-white border-white/40',
}

const signalStyles: Record<SignalStatus, string> = {
  GOOD: 'bg-green-500/15 text-green-300 border-green-400/50',
  WARNING: 'bg-yellow-500/15 text-yellow-300 border-yellow-400/50',
  INTERFERENCE: 'bg-red-500/15 text-red-300 border-red-400/50',
  NO_SIGNAL: 'bg-red-500/10 text-red-400 border-red-400/35',
}

const alertStyles: Record<AlertSeverity, string> = {
  info: 'bg-rf-cyan/15 text-rf-cyan border-rf-cyan/40',
  warning: 'bg-zinc-500/15 text-zinc-200 border-zinc-400/40',
  critical: 'bg-black text-white border-white/40',
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
