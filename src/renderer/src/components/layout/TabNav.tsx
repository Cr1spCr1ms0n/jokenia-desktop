import type { SystemRole, TabDefinition, TabId } from '@/types'

const TABS: TabDefinition[] = [
  { id: 'checkout', label: 'Checkout' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'batches', label: 'Batches' },
  { id: 'staff', label: 'Staff' },
  { id: 'consignees', label: 'Consignees' },
  { id: 'partners', label: 'Partners' },
  { id: 'markets', label: 'Markets' },
  { id: 'services', label: 'Services' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'settings', label: 'Settings' }
]

interface TabNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  role: SystemRole
  pendingBatchCount?: number
}

function TabNav({
  activeTab,
  onTabChange,
  role,
  pendingBatchCount = 0
}: TabNavProps): React.JSX.Element {
  const visibleTabs = TABS.filter((tab) => tab.id !== 'expenses' || role === 'super_admin')

  return (
    <nav className="flex h-full items-center gap-1">
      {visibleTabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`relative flex h-full items-center px-3 text-sm font-medium transition-colors ${
              isActive
                ? 'border-b-[2.5px] border-jokenia-gold text-jokenia-gold'
                : 'border-b-[2.5px] border-transparent text-jokenia-cream hover:text-jokenia-gold'
            }`}
          >
            {tab.label}
            {tab.id === 'batches' && pendingBatchCount > 0 && (
              <span className="ml-1.5 rounded-full bg-jokenia-gold px-1.5 py-0.5 text-[10px] font-semibold text-jokenia-dark">
                {pendingBatchCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

export default TabNav
