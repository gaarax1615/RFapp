import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
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

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)

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
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </main>
    </div>
  )
}
