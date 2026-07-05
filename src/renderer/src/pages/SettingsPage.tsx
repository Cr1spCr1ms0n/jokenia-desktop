import { useSearchParams } from 'react-router-dom'
import type { SystemRole } from '@/types'
import UpdatesSection from '@/components/settings/UpdatesSection'
import StartupTraySection from '@/components/settings/StartupTraySection'
import PrintingSection from '@/components/settings/PrintingSection'
import DisplaySection from '@/components/settings/DisplaySection'
import AccountSection from '@/components/settings/AccountSection'
import DiagnosticsSection from '@/components/settings/DiagnosticsSection'
import UsageSection from '@/components/settings/UsageSection'

type SectionId =
  'updates' | 'startup' | 'printing' | 'display' | 'account' | 'diagnostics' | 'usage'

const ALL_SECTIONS: {
  id: SectionId
  label: string
  description: string
  superAdminOnly?: boolean
}[] = [
  { id: 'updates', label: 'Updates', description: 'App version and OTA update checks.' },
  {
    id: 'startup',
    label: 'Startup & Tray',
    description: 'Launch behaviour and system tray options.'
  },
  {
    id: 'printing',
    label: 'Printing',
    description: 'Default printers, silent printing, and auto-print.'
  },
  { id: 'display', label: 'Display', description: 'Adjust the app UI zoom level.' },
  { id: 'account', label: 'Account', description: 'Signed-in user and session controls.' },
  { id: 'diagnostics', label: 'Diagnostics', description: 'Logs and version information.' },
  {
    id: 'usage',
    label: 'Usage',
    description: 'Monitor Supabase free-tier usage.',
    superAdminOnly: true
  }
]

interface SettingsPageProps {
  role: SystemRole
  userEmail: string
}

function SettingsPage({ role, userEmail }: SettingsPageProps): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const SECTIONS = ALL_SECTIONS.filter(
    (section) => !section.superAdminOnly || role === 'super_admin'
  )
  const requested = searchParams.get('section') as SectionId | null
  const activeSection: SectionId = SECTIONS.some((section) => section.id === requested)
    ? (requested as SectionId)
    : 'updates'

  const active = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0]

  return (
    <div className="flex h-full">
      <nav className="w-48 shrink-0 border-r border-jokenia-tan/20 p-4">
        <h1 className="mb-4 font-heading text-lg font-semibold text-jokenia-dark">Settings</h1>
        <ul className="space-y-1">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => setSearchParams({ section: section.id })}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  activeSection === section.id
                    ? 'bg-jokenia-gold font-medium text-jokenia-dark'
                    : 'text-jokenia-dark2 hover:bg-jokenia-cream2'
                }`}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="max-w-md flex-1 overflow-y-auto p-6">
        <h2 className="mb-1 font-heading text-base font-semibold text-jokenia-dark">
          {active.label}
        </h2>
        <p className="mb-5 text-xs text-jokenia-tan">{active.description}</p>

        {activeSection === 'updates' && <UpdatesSection />}
        {activeSection === 'startup' && <StartupTraySection />}
        {activeSection === 'printing' && <PrintingSection />}
        {activeSection === 'display' && <DisplaySection />}
        {activeSection === 'account' && <AccountSection role={role} userEmail={userEmail} />}
        {activeSection === 'diagnostics' && <DiagnosticsSection />}
        {activeSection === 'usage' && <UsageSection role={role} />}
      </div>
    </div>
  )
}

export default SettingsPage
