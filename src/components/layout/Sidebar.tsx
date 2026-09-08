import { NavLink } from 'react-router-dom'

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Panel', end: true },
  { to: '/spectrum', label: 'Espectro' },
  { to: '/devices', label: 'Dispositivos' },
  { to: '/monitor', label: 'Monitor' },
  { to: '/alerts', label: 'Alertas' },
  { to: '/settings', label: 'Ajustes' },
]

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-rf-border bg-rf-panel">
      <div className="border-b border-rf-border px-4 py-5">
        <p className="font-mono text-[10px] tracking-[0.2em] text-rf-cyan uppercase">
          RF Monitor
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-rf-text">
          Coordinación en vivo
        </h1>
        <p className="mt-1 text-xs text-rf-muted">Beta 1 · Sin internet</p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-rf-elevated text-rf-cyan'
                  : 'text-rf-muted hover:bg-rf-elevated/60 hover:text-rf-text',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-rf-border px-4 py-3 text-[11px] text-rf-muted">
        Local · Sin nube
      </div>
    </aside>
  )
}
