import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { statusBadgeClass } from '@/utils/statusBadge'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import {
  STATUS_LABELS,
  formatDaysOpen,
  type ServiceTicketStatus,
  type ServiceTicketSummary
} from './types'

const FILTERS: { id: ServiceTicketStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'intake', label: 'Intake' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'ready', label: 'Ready' },
  { id: 'awaiting_dispatch', label: 'Awaiting Dispatch' },
  { id: 'closed', label: 'Closed' }
]

// get_service_tickets verified live (Sessions 8 and 10) — returns client as a
// nested object, not a string. Admin app fetches with no params and filters
// client-side; desktop matches that rather than round-tripping per filter click.
async function fetchTickets(): Promise<ServiceTicketSummary[]> {
  const { data, error } = await supabase.rpc('get_service_tickets')
  if (error) throw error
  return (data ?? []) as ServiceTicketSummary[]
}

interface TicketListProps {
  onSelect: (ticketId: string) => void
  onNewTicket: () => void
}

function TicketList({ onSelect, onNewTicket }: TicketListProps): React.JSX.Element {
  const [filter, setFilter] = useState<ServiceTicketStatus | 'all'>('all')
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['service-tickets'], queryFn: fetchTickets })

  const filtered = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data
    return data.filter((ticket) => ticket.status === filter)
  }, [data, filter])

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex flex-wrap gap-1 rounded-md bg-white/50 p-1">
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
        <Button onClick={onNewTicket}>New ticket</Button>
      </div>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={filtered.length === 0}
        emptyText="No service tickets match this filter."
        onRetry={refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Ticket</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Open</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => onSelect(ticket.id)}
                  className="cursor-pointer border-t border-jokenia-tan/10 hover:bg-white/60"
                >
                  <td className="px-3 py-2 font-mono text-xs text-jokenia-dark2">{ticket.ticket_number}</td>
                  <td className="px-3 py-2 text-jokenia-dark">{ticket.client?.name ?? 'Unknown client'}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {ticket.service_type === 'fix' ? 'Fix' : 'Adjustment'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(ticket.status)}`}
                    >
                      {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark2">{formatDaysOpen(ticket)}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">
                    {new Date(ticket.created_at).toLocaleDateString('en-KE')}
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

export default TicketList
