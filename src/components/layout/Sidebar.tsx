import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'

const NAV: { to: string; label: string; short: string; end?: boolean }[] = [
  { to: '/', label: 'Espectro', short: 'ES', end: true },
  { to: '/panel', label: 'Panel', short: 'PA' },
  { to: '/scan', label: 'Escaneo', short: 'SC' },
  { to: '/devices', label: 'Dispositivos', short: 'DI' },
  { to: '/monitor', label: 'Monitor', short: 'MO' },
  { to: '/alerts', label: 'Alertas', short: 'AL' },
  { to: '/settings', label: 'Ajustes', short: 'AJ' },
]

function BrandLogo({ compact }: { compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    const play = () => {
      void video.play().catch(() => {
        /* autoplay bloqueado: queda el póster */
      })
    }
    play()
    video.addEventListener('canplay', play)
    return () => video.removeEventListener('canplay', play)
  }, [])

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      loop
      playsInline
      disablePictureInPicture
      preload="auto"
      poster="/corona_plata_logo.png"
      aria-label="RF Monitor"
      className={[
        'pointer-events-none shrink-0 object-contain',
        compact ? 'h-9 w-9' : 'h-12 w-[4.6rem]',
      ].join(' ')}
    >
      <source src="/corona_plata_logo.webm" type="video/webm" />
      <source src="/corona_plata_logo.mp4" type="video/mp4" />
    </video>
  )
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <aside
      className={[
        'flex shrink-0 flex-col border-r border-rf-border bg-rf-panel transition-[width] duration-200',
        collapsed ? 'w-12' : 'w-56',
      ].join(' ')}
    >
      <div
        className={[
          'flex border-b border-rf-border',
          collapsed ? 'flex-col items-center gap-2 px-1 py-3' : 'items-start justify-between gap-2 px-3 py-4',
        ].join(' ')}
      >
        {collapsed ? (
          <BrandLogo compact />
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandLogo />
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.2em] text-rf-cyan uppercase">
                RF Monitor
              </p>
              <h1 className="mt-0.5 text-base font-semibold tracking-tight text-rf-text">
                Coordinación en vivo
              </h1>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? 'Mostrar menú' : 'Ocultar menú'}
          aria-label={collapsed ? 'Mostrar menú' : 'Ocultar menú'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-rf-muted hover:bg-rf-elevated hover:text-rf-cyan"
        >
          <Chevron collapsed={collapsed} />
        </button>
      </div>

      <nav className={['flex flex-1 flex-col gap-0.5', collapsed ? 'p-1' : 'p-2'].join(' ')}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              [
                'rounded-md text-sm font-medium transition-colors',
                collapsed
                  ? 'flex h-10 items-center justify-center font-mono text-[10px]'
                  : 'px-3 py-2.5',
                isActive
                  ? 'bg-rf-elevated text-rf-cyan'
                  : 'text-rf-muted hover:bg-rf-elevated/60 hover:text-rf-text',
              ].join(' ')
            }
          >
            {collapsed ? item.short : item.label}
          </NavLink>
        ))}
      </nav>

      {collapsed ? null : (
        <div className="border-t border-rf-border px-4 py-3 text-[11px] text-rf-muted">
          Local · Sin nube
        </div>
      )}
    </aside>
  )
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {collapsed ? (
        <path
          d="M6 3.5 11 8l-5 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M10 3.5 5 8l5 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}
