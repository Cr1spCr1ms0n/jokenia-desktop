import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import type { SystemRole, TabId } from '@/types'
import TabNav from './TabNav'

const TAB_PATHS: Record<TabId, string> = {
  dashboard: '/dashboard',
  checkout: '/',
  inventory: '/inventory',
  batches: '/batches',
  staff: '/staff',
  consignees: '/consignees',
  partners: '/partners',
  markets: '/markets',
  services: '/services',
  reconciliation: '/reconciliation',
  expenses: '/expenses',
  settings: '/settings'
}

interface TopBarProps {
  role: SystemRole
  userEmail: string
}

function TopBar({ role, userEmail }: TopBarProps): React.JSX.Element {
  const activeTab = useAppStore((state) => state.activeTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const isOnline = useAppStore((state) => state.isOnline)
  const navigate = useNavigate()

  function handleTabChange(tab: TabId): void {
    setActiveTab(tab)
    navigate(TAB_PATHS[tab])
  }

  // Both entry points open Settings, but the avatar deep-links straight to
  // the Account section rather than duplicating the sign-out/profile UI —
  // the previous placeholder page had no distinct account content for either
  // to point at, so this is the differentiation the dispatch asked for.
  function handleAvatarClick(): void {
    setActiveTab('settings')
    navigate('/settings?section=account')
  }

  const initials = userEmail.split('@')[0].slice(0, 2).toUpperCase()

  return (
    <header className="flex h-11 shrink-0 items-center justify-between bg-jokenia-dark px-4">
      <div className="font-heading text-lg font-bold tracking-wide text-jokenia-gold">JOKENIA</div>

      <TabNav activeTab={activeTab} onTabChange={handleTabChange} role={role} />

      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
        <button
          type="button"
          onClick={handleAvatarClick}
          title="Account settings"
          aria-label="Account settings"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-jokenia-dark2 text-xs font-semibold text-jokenia-cream hover:bg-jokenia-tan"
        >
          {initials}
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('settings')}
          aria-label="Settings"
          className="text-jokenia-cream hover:text-jokenia-gold"
        >
          ⚙
        </button>
      </div>
    </header>
  )
}

export default TopBar
