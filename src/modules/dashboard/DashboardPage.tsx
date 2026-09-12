import { PanelMonitorStrip } from './PanelMonitorStrip'

/** El espectro vive en AppShell; aquí solo va la tira de monitor. */
export function DashboardPage() {
  return (
    <div className="shrink-0 p-3 pt-0 md:px-5 md:pb-5">
      <PanelMonitorStrip />
    </div>
  )
}
