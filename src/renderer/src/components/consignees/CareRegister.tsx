import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import type { CareRegisterItem } from './types'

type FilterTab = 'all' | 'unsettled' | 'settled'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function sumValue(items: CareRegisterItem[]): number {
  return items.reduce((acc, item) => acc + item.consignee_price, 0)
}

// Business-wide, cross-consignee register — get_all_consignee_lost_items with
// NO client filter, unlike ConsigneeDetail's per-consignee careItems (which
// filters this same RPC down to one client_id). This is the standalone report
// the parity audit flagged as missing entirely. JOKENIA_GLOBAL euphemism rule
// applied throughout: "Items in Jokenia's Care" (not "Lost Stock Register"),
// same record/RPC underneath as the per-consignee section.
async function fetchCareRegister(): Promise<CareRegisterItem[]> {
  const { data, error } = await supabase.rpc('get_all_consignee_lost_items')
  if (error) throw error
  return (data as { items: CareRegisterItem[] }).items
}

interface CareRegisterProps {
  onBack: () => void
}

function CareRegister({ onBack }: CareRegisterProps): React.JSX.Element {
  const [tab, setTab] = useState<FilterTab>('all')
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['care-register'],
    queryFn: fetchCareRegister
  })

  const allItems = data ?? []
  const unsettled = allItems.filter((item) => !item.settled)
  const settled = allItems.filter((item) => item.settled)
  const visibleItems = tab === 'unsettled' ? unsettled : tab === 'settled' ? settled : allItems

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `All (${allItems.length})` },
    { key: 'unsettled', label: `Unsettled (${unsettled.length})` },
    { key: 'settled', label: `Settled (${settled.length})` }
  ]

  return (
    <div className="flex h-full flex-col p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to consignees
      </button>

      <h2 className="mb-3 font-heading text-lg font-semibold text-jokenia-dark">
        Items in Jokenia&apos;s Care
      </h2>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={allItems.length === 0}
        emptyText="No items are currently in Jokenia's care."
        onRetry={refetch}
      >
        <div className="flex-1 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center">
            <div>
              <p className="text-lg font-bold text-jokenia-dark">{allItems.length}</p>
              <p className="text-[10px] text-jokenia-tan">Total items</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-700">{unsettled.length}</p>
              <p className="text-[10px] text-jokenia-tan">
                Unsettled — {formatKes(sumValue(unsettled))}
              </p>
            </div>
            <div>
              <p className="text-lg font-bold text-green-700">{settled.length}</p>
              <p className="text-[10px] text-jokenia-tan">
                Settled — {formatKes(sumValue(settled))}
              </p>
            </div>
          </div>

          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  tab === t.key
                    ? 'bg-jokenia-dark text-jokenia-gold'
                    : 'border border-jokenia-tan/30 bg-white/70 text-jokenia-dark2'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {visibleItems.length === 0 ? (
            <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
              No records for this filter.
            </p>
          ) : (
            <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
              {visibleItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-jokenia-sand/40 px-1.5 py-0.5 text-[10px] font-semibold text-jokenia-dark2">
                        C{String(item.client_seq).padStart(3, '0')}
                      </span>
                      <p className="text-sm font-medium text-jokenia-dark">{item.client_name}</p>
                    </div>
                    <p className="text-xs text-jokenia-tan">
                      {item.product_type} — {item.variation_name} · {item.serial_number}
                    </p>
                    <p className="text-xs text-jokenia-tan">{formatDate(item.loss_date)}</p>
                    {item.notes && <p className="text-xs italic text-jokenia-tan">{item.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-jokenia-dark">
                      {formatKes(item.consignee_price)}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.settled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.settled ? 'Settled' : 'Unsettled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </QueryState>
    </div>
  )
}

export default CareRegister
