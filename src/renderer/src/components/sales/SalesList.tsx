import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import { statusBadgeClass } from '@/utils/statusBadge'
import type { SaleListRow } from './types'

const TYPE_FILTERS = ['all', 'retail', 'manual', 'consignment', 'wholesale'] as const
type TypeFilter = (typeof TYPE_FILTERS)[number]

const CHANNEL_FILTERS = ['all', 'in_shop', 'online', 'market'] as const
type ChannelFilter = (typeof CHANNEL_FILTERS)[number]

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'All types',
  retail: 'Retail',
  manual: 'Manual',
  consignment: 'Consignment',
  wholesale: 'Wholesale'
}

const CHANNEL_LABELS: Record<ChannelFilter, string> = {
  all: 'All channels',
  in_shop: 'In Shop',
  online: 'Online',
  market: 'Market'
}

function defaultSince(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// No get_sales_history RPC exists (matching admin app's sales/list.tsx, which
// also queries the sales table directly) — date range is passed as filter
// params rather than the admin app's fixed 30-day window, since this dispatch's
// scope explicitly calls for date filtering.
async function fetchSales(dateFrom: string, dateTo: string): Promise<SaleListRow[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('id,sale_type,sale_channel,net_amount,created_at,ad_hoc_client_name')
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data ?? []
}

interface SalesListProps {
  onSelect: (saleId: string) => void
}

function SalesList({ onSelect }: SalesListProps): React.JSX.Element {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [dateFrom, setDateFrom] = useState(defaultSince())
  const [dateTo, setDateTo] = useState(today())

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sales-history', dateFrom, dateTo],
    queryFn: () => fetchSales(dateFrom, dateTo)
  })

  const filtered = useMemo(() => {
    if (!data) return []
    return data.filter((sale) => {
      if (typeFilter !== 'all' && sale.sale_type !== typeFilter) return false
      if (channelFilter !== 'all' && sale.sale_channel !== channelFilter) return false
      return true
    })
  }, [data, typeFilter, channelFilter])

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-md bg-white/50 p-1">
          {TYPE_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTypeFilter(id)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === id
                  ? 'bg-jokenia-gold text-jokenia-dark'
                  : 'text-jokenia-dark2 hover:bg-white'
              }`}
            >
              {TYPE_LABELS[id]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 rounded-md bg-white/50 p-1">
          {CHANNEL_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setChannelFilter(id)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                channelFilter === id
                  ? 'bg-jokenia-dark text-jokenia-cream'
                  : 'text-jokenia-dark2 hover:bg-white'
              }`}
            >
              {CHANNEL_LABELS[id]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-jokenia-dark2">
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(event) => setDateFrom(event.target.value)}
            className="rounded-md border border-jokenia-tan/40 bg-white px-2 py-1.5 text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
          <span>–</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={today()}
            onChange={(event) => setDateTo(event.target.value)}
            className="rounded-md border border-jokenia-tan/40 bg-white px-2 py-1.5 text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>
      </div>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={filtered.length === 0}
        emptyText="No sales found for this filter."
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sale) => (
                <tr
                  key={sale.id}
                  onClick={() => onSelect(sale.id)}
                  className="cursor-pointer border-t border-jokenia-tan/10 hover:bg-white/60"
                >
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {new Date(sale.created_at).toLocaleDateString('en-KE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(sale.sale_type)}`}
                    >
                      {sale.sale_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 capitalize text-jokenia-dark2">
                    {sale.sale_channel?.replace('_', ' ') ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark">{sale.ad_hoc_client_name ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-jokenia-dark">
                    KES {Number(sale.net_amount).toLocaleString()}
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

export default SalesList
