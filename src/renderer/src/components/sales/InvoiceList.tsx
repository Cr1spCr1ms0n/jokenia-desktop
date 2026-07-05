import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import { statusBadgeClass } from '@/utils/statusBadge'
import type { InvoiceListRow } from './types'

const FILTERS = ['all', 'pending', 'overdue', 'settled'] as const
type Filter = (typeof FILTERS)[number]

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  pending: 'Pending',
  overdue: 'Overdue',
  settled: 'Settled'
}

async function fetchInvoices(filter: Filter): Promise<InvoiceListRow[]> {
  const q = supabase
    .from('invoices')
    .select('id,amount_due,due_date,status,client_id,ad_hoc_name')
    .order('due_date', { ascending: true })
    .limit(200)
  const { data, error } = filter !== 'all' ? await q.eq('status', filter) : await q
  if (error) throw error
  return data ?? []
}

interface InvoiceListProps {
  onSelect: (invoiceId: string) => void
}

function InvoiceList({ onSelect }: InvoiceListProps): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoices', filter],
    queryFn: () => fetchInvoices(filter)
  })

  const rows = data ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap gap-1 rounded-md bg-white/50 p-1 w-fit">
        {FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === id
                ? 'bg-jokenia-gold text-jokenia-dark'
                : 'text-jokenia-dark2 hover:bg-white'
            }`}
          >
            {FILTER_LABELS[id]}
          </button>
        ))}
      </div>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={rows.length === 0}
        emptyText="No invoices found for this filter."
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Due date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Amount due</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => onSelect(inv.id)}
                  className="cursor-pointer border-t border-jokenia-tan/10 hover:bg-white/60"
                >
                  <td className="px-3 py-2 text-jokenia-dark">{inv.ad_hoc_name ?? 'Client'}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {new Date(inv.due_date).toLocaleDateString('en-KE')}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(inv.status)}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-jokenia-dark">
                    KES {Number(inv.amount_due).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </div>
  )
}

export default InvoiceList
