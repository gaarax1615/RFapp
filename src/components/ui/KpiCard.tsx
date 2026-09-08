import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: ReactNode
  hint?: string
  accent?: 'cyan' | 'amber' | 'default'
}

export function KpiCard({ label, value, hint, accent = 'default' }: KpiCardProps) {
  const valueColor =
    accent === 'cyan'
      ? 'text-rf-cyan'
      : accent === 'amber'
        ? 'text-rf-amber'
        : 'text-rf-text'

  return (
    <div className="rounded-lg border border-rf-border bg-rf-panel p-4">
      <p className="text-[11px] font-medium tracking-[0.12em] text-rf-muted uppercase">
        {label}
      </p>
      <div className={`mt-2 font-mono text-2xl font-semibold tracking-tight md:text-3xl ${valueColor}`}>
        {value}
      </div>
      {hint ? <p className="mt-2 text-xs text-rf-muted">{hint}</p> : null}
    </div>
  )
}
