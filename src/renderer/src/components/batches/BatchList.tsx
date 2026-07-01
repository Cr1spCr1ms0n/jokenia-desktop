import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { statusBadgeClass } from '@/utils/statusBadge'
import QueryState from '@/components/ui/QueryState'
import { BATCH_STATUS_LABELS, type BatchRow, type BatchStatus } from './types'

const FILTERS: { id: BatchStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_verification', label: 'Pending Verification' },
  { id: 'pending_product_approval', label: 'Pending Product Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' }
]

// Listing is a direct table read in the admin app too (not an RPC) — see
// cacheRefresh.ts BATCH_SELECT. Desktop fetches every status (not just
// pending_*) so the Approved/Rejected filter pills have data to show.
async function fetchBatches(): Promise<BatchRow[]> {
  const [batchesResult, linesResult] = await Promise.all([
    supabase
      .from('production_batches')
      .select('id, staff_id ( profiles!staff_id_fkey(full_name) ), production_date, status')
      .order('production_date', { ascending: false }),
    supabase.from('batch_lines').select('batch_id')
  ])
  if (batchesResult.error) throw batchesResult.error
  if (linesResult.error) throw linesResult.error

  const itemCountByBatch = new Map<string, number>()
  for (const row of (linesResult.data ?? []) as Array<{ batch_id: string }>) {
    itemCountByBatch.set(row.batch_id, (itemCountByBatch.get(row.batch_id) ?? 0) + 1)
  }

  return (batchesResult.data ?? []).map((row: any) => ({
    id: row.id as string,
    status: row.status as BatchStatus,
    production_date: row.production_date as string,
    staff_name: row.staff_id?.profiles?.full_name ?? 'Unknown',
    item_count: itemCountByBatch.get(row.id) ?? 0
  }))
}

interface BatchListProps {
  onSelect: (batchId: string) => void
}

function BatchList({ onSelect }: BatchListProps): React.JSX.Element {
  const [filter, setFilter] = useState<BatchStatus | 'all'>('all')
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['batches'], queryFn: fetchBatches })

  const filtered = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data
    return data.filter((batch) => batch.status === filter)
  }, [data, filter])

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex flex-wrap gap-1 rounded-md bg-white/50 p-1">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === item.id
                ? 'bg-jokenia-gold text-jokenia-dark'
                : 'text-jokenia-dark2 hover:bg-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={filtered.length === 0}
        emptyText="No batches match this filter."
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Batch</th>
                <th className="px-3 py-2 font-medium">Submitted by</th>
                <th className="px-3 py-2 font-medium">Items</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Submitted</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((batch) => (
                <tr
                  key={batch.id}
                  onClick={() => onSelect(batch.id)}
                  className="cursor-pointer border-t border-jokenia-tan/10 hover:bg-white/60"
                >
                  <td className="px-3 py-2 font-mono text-xs text-jokenia-dark2">
                    {batch.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark">{batch.staff_name}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">{batch.item_count}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(batch.status)}`}
                    >
                      {BATCH_STATUS_LABELS[batch.status] ?? batch.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {new Date(batch.production_date).toLocaleDateString('en-KE')}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-jokenia-tan">View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </div>
  )
}

export default BatchList
