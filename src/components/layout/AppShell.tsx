import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { SpectrumAnalyzer } from '@/modules/spectrum/SpectrumAnalyzer'
import { STORAGE_KEYS } from '@/utils/constants'

function readCollapsed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

function isLiveSpectrumPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/panel'
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const { pathname } = useLocation()
  const live = isLiveSpectrumPath(pathname)
  const onPanel = pathname === '/panel'

  const onToggle = () => {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-rf-bg text-rf-text">
      <Sidebar collapsed={collapsed} onToggle={onToggle} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className={
            live
              ? onPanel
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-3 pb-0 md:p-5 md:pb-0'
                : 'flex min-h-0 flex-1 flex-col overflow-hidden pt-4'
              : 'hidden'
          }
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#050505]">
            <SpectrumAnalyzer showWaterfall solo />
          </div>
        </div>
        <div
          className={
            live
              ? onPanel
                ? 'shrink-0 overflow-auto'
                : 'hidden'
              : 'min-h-0 flex-1 overflow-auto'
          }
        >
          {children}
        </div>
      </main>
    </div>
  )
}
