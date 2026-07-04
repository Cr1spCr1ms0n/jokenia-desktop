import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import type { MarketEventDetail } from './types'

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

function formatSaleDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function fetchMarketEventDetail(eventId: string): Promise<MarketEventDetail> {
  const { data, error } = await supabase.rpc('get_market_event_detail', { p_event_id: eventId })
  if (error) throw error
  return data as MarketEventDetail
}

interface EditForm {
  name: string
  series_name: string
  location: string
  start_date: string
  end_date: string
  notes: string
}

interface MarketDetailProps {
  eventId: string
  onBack: () => void
}

function MarketDetail({ eventId, onBack }: MarketDetailProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const setSaleChannel = useAppStore((state) => state.setSaleChannel)
  const setMarketEventId = useAppStore((state) => state.setMarketEventId)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['market-event-detail', eventId],
    queryFn: () => fetchMarketEventDetail(eventId)
  })

  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error: rpcError } = await supabase.rpc('update_market_event', payload)
      if (rpcError) throw rpcError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-event-detail', eventId] })
      queryClient.invalidateQueries({ queryKey: ['market-events'] })
    }
  })

  function enterEditMode(): void {
    if (!data) return
    setEditForm({
      name: data.event.name,
      series_name: data.event.series_name ?? '',
      location: data.event.location ?? '',
      start_date: data.event.start_date,
      end_date: data.event.end_date,
      notes: data.event.notes ?? ''
    })
    setEditError(null)
    setIsEditing(true)
  }

  async function handleSave(): Promise<void> {
    if (!editForm) return
    if (!editForm.name.trim()) {
      setEditError('Event name is required.')
      return
    }
    if (!editForm.start_date || !editForm.end_date) {
      setEditError('Start and end dates are required.')
      return
    }
    if (editForm.end_date < editForm.start_date) {
      setEditError('End date must be on or after start date.')
      return
    }
    setEditError(null)
    try {
      await updateMutation.mutateAsync({
        p_event_id: eventId,
        p_name: editForm.name.trim(),
        p_series_name: editForm.series_name.trim() || null,
        p_location: editForm.location.trim() || null,
        p_start_date: editForm.start_date,
        p_end_date: editForm.end_date,
        p_notes: editForm.notes.trim() || null
      })
      setIsEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save changes.')
    }
  }

  async function handleArchiveToggle(nextActive: boolean): Promise<void> {
    await updateMutation.mutateAsync({ p_event_id: eventId, p_is_active: nextActive })
  }

  function handleRecordSale(): void {
    if (!data) return
    setSaleChannel('market')
    setMarketEventId(eventId)
    setActiveTab('checkout')
    navigate('/')
  }

  return (
    <div className="flex h-full flex-col p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to markets
      </button>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={!data}
        emptyText="Event not found."
        onRetry={refetch}
      >
        {data && (
          <div className="flex-1 space-y-4 overflow-y-auto">
            {isEditing && editForm ? (
              <div className="space-y-2 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
                {editError && <p className="text-xs text-red-500">{editError}</p>}
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                  placeholder="Event name"
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                />
                <input
                  type="text"
                  value={editForm.series_name}
                  onChange={(event) => setEditForm({ ...editForm, series_name: event.target.value })}
                  placeholder="Series (optional)"
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                />
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(event) => setEditForm({ ...editForm, location: event.target.value })}
                  placeholder="Location (optional)"
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(event) => setEditForm({ ...editForm, start_date: event.target.value })}
                    className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                  />
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(event) => setEditForm({ ...editForm, end_date: event.target.value })}
                    className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                  />
                </div>
                <textarea
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                  placeholder="Notes (optional)"
                  rows={3}
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                />
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setIsEditing(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void handleSave()}
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-heading text-lg font-semibold text-jokenia-dark">
                      {data.event.name}
                    </h2>
                    {data.event.series_name && (
                      <p className="text-xs text-jokenia-tan">{data.event.series_name}</p>
                    )}
                  </div>
                  {!data.event.is_active && (
                    <span className="rounded-full bg-jokenia-sand/60 px-2 py-0.5 text-[10px] font-semibold text-jokenia-dark2">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-sm text-jokenia-dark2">
                  {formatDateRange(data.event.start_date, data.event.end_date)}
                </p>
                {data.event.location && (
                  <p className="text-sm text-jokenia-tan">{data.event.location}</p>
                )}
                {data.event.notes && <p className="text-sm text-jokenia-dark2">{data.event.notes}</p>}

                <div className="flex gap-2 pt-1">
                  <Button variant="secondary" onClick={enterEditMode} className="flex-1">
                    Edit
                  </Button>
                  {data.event.is_active ? (
                    <Button
                      variant="ghost"
                      onClick={() => void handleArchiveToggle(false)}
                      disabled={updateMutation.isPending}
                      className="flex-1 border border-red-300 text-red-600 hover:bg-red-50"
                    >
                      Archive
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => void handleArchiveToggle(true)}
                      disabled={updateMutation.isPending}
                      className="flex-1 border border-green-300 text-green-700 hover:bg-green-50"
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Summary
              </p>
              <div className="flex gap-2">
                <div className="flex-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-2 text-center">
                  <p className="text-lg font-bold text-jokenia-dark">{data.summary.sale_count}</p>
                  <p className="text-[10px] text-jokenia-tan">Sales</p>
                </div>
                <div className="flex-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-2 text-center">
                  <p className="text-lg font-bold text-jokenia-dark">
                    {formatKes(data.summary.total_revenue)}
                  </p>
                  <p className="text-[10px] text-jokenia-tan">Revenue</p>
                </div>
                <div className="flex-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-2 text-center">
                  <p className="text-lg font-bold text-jokenia-dark">
                    {formatKes(data.summary.avg_sale_value)}
                  </p>
                  <p className="text-[10px] text-jokenia-tan">Avg Sale</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Sales at this event
              </p>
              {data.sales.length === 0 ? (
                <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                  No sales recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {data.sales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-jokenia-dark">
                          {capitalise(sale.sale_type)}
                        </p>
                        <p className="text-xs text-jokenia-tan">
                          {formatSaleDateTime(sale.created_at)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-jokenia-dark">
                        {formatKes(sale.net_amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data.event.is_active && !isEditing && (
              <Button onClick={handleRecordSale} className="w-full">
                Record sale
              </Button>
            )}
          </div>
        )}
      </QueryState>
    </div>
  )
}

export default MarketDetail
