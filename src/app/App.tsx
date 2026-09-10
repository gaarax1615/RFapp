import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProviders } from './AppProviders'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { SpectrumPage } from '@/modules/spectrum/SpectrumPage'
import { DevicesPage } from '@/modules/devices/DevicesPage'
import { MonitorPage } from '@/modules/monitor/MonitorPage'
import { ChannelDetailPage } from '@/modules/monitor/ChannelDetailPage'
import { AlertsPage } from '@/modules/alerts/AlertsPage'
import { SettingsPage } from '@/modules/settings/SettingsPage'
import { ScanPage } from '@/modules/scan/ScanPage'

export function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<SpectrumPage />} />
            <Route path="/spectrum" element={<Navigate to="/" replace />} />
            <Route path="/panel" element={<DashboardPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/monitor/:deviceId" element={<ChannelDetailPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AppProviders>
  )
}
