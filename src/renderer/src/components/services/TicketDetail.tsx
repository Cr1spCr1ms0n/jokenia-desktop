import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import QueryState from '@/components/ui/QueryState'
import {
  STATUS_LABELS,
  formatDaysOpen,
  formatFee,
  type DispatchMethod,
  type ServiceTicketDetail
} from './types'

async function fetchTicketDetail(ticketId: string): Promise<ServiceTicketDetail> {
  const { data, error } = await supabase.rpc('get_ticket_detail', { p_ticket_id: ticketId })
  if (error) throw error
  return data as ServiceTicketDetail
}

interface TicketDetailProps {
  ticketId: string
  onBack: () => void
}

function TicketDetail({ ticketId, onBack }: TicketDetailProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['ticket-detail', ticketId],
    queryFn: () => fetchTicketDetail(ticketId)
  })

  const [showDispatchForm, setShowDispatchForm] = useState(false)
  const [finalFee, setFinalFee] = useState('')
  const [dispatchMethod, setDispatchMethod] = useState<DispatchMethod | null>(null)
  const [dispatchNote, setDispatchNote] = useState('')
  const [dispatchError, setDispatchError] = useState<string | null>(null)

  const [showCloseForm, setShowCloseForm] = useState(false)
  const [closeNote, setCloseNote] = useState('')
  const [closeError, setCloseError] = useState<string | null>(null)

  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  function refreshAfterAction(): void {
    queryClient.invalidateQueries({ queryKey: ['ticket-detail', ticketId] })
    queryClient.invalidateQueries({ queryKey: ['service-tickets'] })
  }

  async function handleDispatch(): Promise<void> {
    const fee = parseFloat(finalFee)
    if (isNaN(fee) || fee < 0) {
      setDispatchError('Enter a valid final fee (0 or greater).')
      return
    }
    if (!dispatchMethod) {
      setDispatchError('Select a dispatch method.')
      return
    }
    setDispatchError(null)
    setActionPending(true)
    setActionError(null)
    const { error: rpcError } = await supabase.rpc('mark_ticket_dispatched', {
      p_ticket_id: ticketId,
      p_final_fee: fee,
      p_dispatch_method: dispatchMethod,
      p_note: dispatchNote.trim() || undefined
    })
    setActionPending(false)
    if (rpcError) {
      setActionError(rpcError.message)
      return
    }
    setShowDispatchForm(false)
    setFinalFee('')
    setDispatchMethod(null)
    setDispatchNote('')
    refreshAfterAction()
  }

  async function handleClose(): Promise<void> {
    const trimmedNote = closeNote.trim()
    if (trimmedNote && trimmedNote.length < 3) {
      setCloseError('Note must be at least 3 characters.')
      return
    }
    setCloseError(null)
    setActionPending(true)
    setActionError(null)
    const { error: rpcError } = await supabase.rpc('close_ticket', {
      p_ticket_id: ticketId,
      p_note: trimmedNote || undefined
    })
    setActionPending(false)
    if (rpcError) {
      setActionError(rpcError.message)
      return
    }
    setShowCloseForm(false)
    setCloseNote('')
    refreshAfterAction()
  }

  const showAssigned =
    ticket &&
    ['in_progress', 'ready', 'awaiting_dispatch'].includes(ticket.status) &&
    !!ticket.assigned_to_name

  return (
    <div className="flex h-full flex-col p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to tickets
      </button>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={!ticket}
        emptyText="Ticket not found."
        onRetry={refetch}
      >
        {ticket && (
          <div className="flex-1 overflow-y-auto">
            <div className="mb-4 rounded-md border border-jokenia-tan/20 bg-white/60 p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-heading text-lg font-semibold text-jokenia-dark">{ticket.ticket_number}</p>
                <span className="rounded-full bg-jokenia-gold px-2 py-0.5 text-xs font-semibold text-jokenia-dark">
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
              </div>
              <p className="text-xs text-jokenia-tan">
                {ticket.service_type === 'fix' ? 'Fix' : 'Adjustment'} · {formatDaysOpen(ticket)}
              </p>
              {showAssigned && (
                <p className="mt-1 text-xs text-jokenia-tan">Assigned to {ticket.assigned_to_name}</p>
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-jokenia-tan/20 bg-white/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">Client</p>
                <p className="text-sm font-medium text-jokenia-dark">{ticket.client?.name ?? 'Unknown'}</p>
                {ticket.client?.phone && <p className="text-xs text-jokenia-dark2">{ticket.client.phone}</p>}
                {ticket.client?.email && <p className="text-xs text-jokenia-dark2">{ticket.client.email}</p>}
              </div>
              <div className="rounded-md border border-jokenia-tan/20 bg-white/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">Fees</p>
                <p className="text-xs text-jokenia-dark2">Quoted: {formatFee(ticket.quoted_fee)}</p>
                <p className="text-xs text-jokenia-dark2">Final: {formatFee(ticket.final_fee)}</p>
                {ticket.dispatch_method && (
                  <p className="text-xs text-jokenia-dark2">
                    Dispatch: {ticket.dispatch_method === 'pickup' ? 'Pickup' : 'Delivery'}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4 rounded-md border border-jokenia-tan/20 bg-white/60 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Item description
              </p>
              <p className="text-sm text-jokenia-dark">{ticket.item_description}</p>
            </div>

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-jokenia-dark2">Activity log</p>
            <div className="mb-4 space-y-2">
              {ticket.logs.length === 0 ? (
                <p className="text-xs text-jokenia-tan">No activity yet.</p>
              ) : (
                ticket.logs.map((log) => (
                  <div key={log.id} className="rounded-md border border-jokenia-tan/20 bg-white/40 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                        {STATUS_LABELS[log.status_at] ?? log.status_at}
                      </span>
                      <span className="text-[10px] text-jokenia-tan">
                        {new Date(log.created_at).toLocaleString('en-KE')}
                      </span>
                    </div>
                    {log.note && <p className="mt-1 text-xs text-jokenia-dark2">{log.note}</p>}
                    {log.created_by_name && (
                      <p className="mt-0.5 text-[10px] text-jokenia-tan">by {log.created_by_name}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

            {showDispatchForm && (
              <div className="mb-4 rounded-md border border-jokenia-tan/30 bg-white/60 p-4">
                <p className="font-heading text-sm font-semibold text-jokenia-dark">Mark Dispatched</p>
                {dispatchError && <p className="mb-2 text-xs text-red-600">{dispatchError}</p>}
                <label className="mb-1 mt-2 block text-[10px] font-bold uppercase tracking-wide text-jokenia-tan">
                  Final fee (KES)
                </label>
                <input
                  type="number"
                  value={finalFee}
                  onChange={(event) => setFinalFee(event.target.value)}
                  className="mb-2 w-full rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
                />
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-jokenia-tan">
                  Dispatch method
                </label>
                <div className="mb-2 flex gap-2">
                  {(['pickup', 'delivery'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setDispatchMethod(method)}
                      className={`flex-1 rounded-md border py-1.5 text-xs font-medium ${
                        dispatchMethod === method
                          ? 'border-jokenia-gold bg-jokenia-gold/20 text-jokenia-dark'
                          : 'border-jokenia-tan/30 bg-white text-jokenia-dark2'
                      }`}
                    >
                      {method === 'pickup' ? 'Pickup' : 'Delivery'}
                    </button>
                  ))}
                </div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-jokenia-tan">
                  Note (optional)
                </label>
                <textarea
                  value={dispatchNote}
                  onChange={(event) => setDispatchNote(event.target.value)}
                  rows={2}
                  className="mb-3 w-full rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowDispatchForm(false)
                      setDispatchError(null)
                    }}
                    disabled={actionPending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleDispatch} disabled={actionPending}>
                    {actionPending ? 'Saving…' : 'Confirm dispatch'}
                  </Button>
                </div>
              </div>
            )}

            {showCloseForm && (
              <div className="mb-4 rounded-md border border-jokenia-tan/30 bg-white/60 p-4">
                <p className="font-heading text-sm font-semibold text-jokenia-dark">Close Ticket</p>
                {closeError && <p className="mb-2 text-xs text-red-600">{closeError}</p>}
                <label className="mb-1 mt-2 block text-[10px] font-bold uppercase tracking-wide text-jokenia-tan">
                  Note (optional)
                </label>
                <textarea
                  value={closeNote}
                  onChange={(event) => setCloseNote(event.target.value)}
                  rows={2}
                  className="mb-3 w-full rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowCloseForm(false)
                      setCloseError(null)
                    }}
                    disabled={actionPending}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleClose} disabled={actionPending}>
                    {actionPending ? 'Saving…' : 'Confirm close'}
                  </Button>
                </div>
              </div>
            )}

            {!showDispatchForm && !showCloseForm && (
              <div className="flex gap-2">
                {ticket.status === 'ready' && (
                  <Button onClick={() => setShowDispatchForm(true)} disabled={actionPending}>
                    Mark Dispatched
                  </Button>
                )}
                {ticket.status === 'awaiting_dispatch' && (
                  <Button onClick={() => setShowCloseForm(true)} disabled={actionPending}>
                    Close Ticket
                  </Button>
                )}
                {(ticket.status === 'intake' || ticket.status === 'in_progress') && (
                  <p className="text-xs italic text-jokenia-tan">
                    This ticket is awaiting staff action and has no admin action available yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </QueryState>
    </div>
  )
}

export default TicketDetail
