import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import type { MarketEvent } from './types'

function formatDateRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`)
  const e = new Date(`${end}T00:00:00`)
  const endFull = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (start === end) return endFull
  return `${s.getDate()}–${endFull}`
}

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString()}`
}

async function fetchMarketEvents(includeInactive: boolean): Promise<MarketEvent[]> {
  const { data, error } = await supabase.rpc('get_market_events', {
    p_include_inactive: includeInactive
  })
  if (error) throw error
  return (data ?? []) as MarketEvent[]
}

interface MarketListProps {
  onSelect: (eventId: string) => void
  onCreate: () => void
}

function MarketList({ onSelect, onCreate }: MarketListProps): React.JSX.Element {
  const [showArchived, setShowArchived] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['market-events', showArchived],
    queryFn: () => fetchMarketEvents(showArchived)
  })

  const events = data ?? []

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-medium text-jokenia-dark2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
        <Button onClick={onCreate}>+ New Event</Button>
      </div>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={events.length === 0}
        emptyText={
          showArchived ? 'No market events found.' : 'No market events — create the first one.'
        }
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Sales</th>
                <th className="px-3 py-2 font-medium">Revenue</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  onClick={() => onSelect(event.id)}
                  className="cursor-pointer border-t border-jokenia-tan/10 hover:bg-white/60"
                >
                  <td className="px-3 py-2 text-jokenia-dark">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{event.name}</span>
                      {!event.is_active && (
                        <span className="rounded-full bg-jokenia-sand/60 px-2 py-0.5 text-[10px] font-semibold text-jokenia-dark2">
                          Archived
                        </span>
                      )}
                    </div>
                    {event.series_name && (
                      <div className="text-xs text-jokenia-tan">{event.series_name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {formatDateRange(event.start_date, event.end_date)}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark2">{event.location ?? '—'}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">{event.sale_count}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">{formatKes(event.total_revenue)}</td>
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

export default MarketList
