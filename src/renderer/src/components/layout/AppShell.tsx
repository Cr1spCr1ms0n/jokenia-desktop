import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import Register from '@/components/register/Register'
import CheckoutPage from '@/pages/CheckoutPage'
import InventoryPage from '@/pages/InventoryPage'
import BatchesPage from '@/pages/BatchesPage'
import StaffPage from '@/pages/StaffPage'
import ConsigneesPage from '@/pages/ConsigneesPage'
import PartnersPage from '@/pages/PartnersPage'
import MarketsPage from '@/pages/MarketsPage'
import ServicesPage from '@/pages/ServicesPage'
import ReconciliationPage from '@/pages/ReconciliationPage'
import ExpensesPage from '@/pages/ExpensesPage'
import SettingsPage from '@/pages/SettingsPage'
import type { SystemRole } from '@/types'

interface AppShellProps {
  role: SystemRole
  userEmail: string
}

function AppShell({ role, userEmail }: AppShellProps): React.JSX.Element {
  useEffect(() => {
    window.electron.getPreference('settings.zoomLevel').then((value) => {
      window.electron.webFrame.setZoomFactor(typeof value === 'number' ? value : 1)
    })
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TopBar role={role} userEmail={userEmail} />
      <div className="flex min-h-0 flex-1">
        <Register />
        <main className="flex-1 overflow-y-auto bg-jokenia-cream2">
          <Routes>
            <Route path="/" element={<CheckoutPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/batches" element={<BatchesPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/consignees" element={<ConsigneesPage />} />
            <Route path="/partners" element={<PartnersPage />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            {role === 'super_admin' && <Route path="/expenses" element={<ExpensesPage />} />}
            <Route path="/settings" element={<SettingsPage role={role} userEmail={userEmail} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default AppShell
