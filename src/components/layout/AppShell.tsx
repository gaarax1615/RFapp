import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-rf-bg text-rf-text">
      <Sidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </main>
    </div>
  )
}
