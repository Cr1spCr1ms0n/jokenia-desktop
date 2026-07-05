import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { PriceReason, VariationPriceHistory } from './types'

const REASONS: PriceReason[] = ['Clearance', 'Restock', 'Market Adjustment', 'Other']

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function fetchHistory(variationId: string): Promise<VariationPriceHistory> {
  const { data, error } = await supabase.rpc('get_variation_price_history', {
    p_variation_id: variationId
  })
  if (error) throw error
  return data as VariationPriceHistory
}

interface PriceDetailModalProps {
  variationId: string
  isSuperAdmin: boolean
  isOpen: boolean
  onClose: () => void
  onUpdated: () => void
}

// Edit Price is available to any admin/super_admin here, matching the admin
// app's type-pricing chip → PriceEditModal path (no role gate there). Revert
// stays super_admin-only, matching [vid].tsx's own gate — the one clean,
// consistently-applied restriction in the admin app's price screens.
function PriceDetailModal({
  variationId,
  isSuperAdmin,
  isOpen,
  onClose,
  onUpdated
}: PriceDetailModalProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [showEditForm, setShowEditForm] = useState(false)
  const [newPrice, setNewPrice] = useState('')
  const [reason, setReason] = useState<PriceReason>('Clearance')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const historyQuery = useQuery({
    queryKey: ['variation-price-history', variationId],
    queryFn: () => fetchHistory(variationId),
    enabled: isOpen
  })

  const data = historyQuery.data
  const isInitialPrice = data?.current_price === 0 || data?.current_price == null

  const updateMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseFloat(newPrice)
      const { error } = await supabase.rpc('update_variation_price', {
        p_variation_id: variationId,
        p_new_price: parsed,
        p_reason: isInitialPrice ? 'initial_price' : reason,
        p_notes: notes.trim() || null
      })
      if (error) throw error
    },
    onSuccess: () => {
      setShowEditForm(false)
      setNewPrice('')
      setNotes('')
      queryClient.invalidateQueries({ queryKey: ['variation-price-history', variationId] })
      onUpdated()
    }
  })

  const revertMutation = useMutation({
    mutationFn: async (historyId: string) => {
      const { error } = await supabase.rpc('revert_variation_price', {
        p_history_id: historyId,
        p_notes: null
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variation-price-history', variationId] })
      onUpdated()
    }
  })

  function handleUpdate(): void {
    const parsed = parseFloat(newPrice)
    if (isNaN(parsed) || parsed <= 0) {
      setFormError('Enter a valid price greater than 0.')
      return
    }
    setFormError(null)
    updateMutation.mutate()
  }

  const history = data?.history ?? []
  const mostRecentId = history.length > 0 ? history[0].id : null

  return (
    <Modal title="Price detail" isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        {historyQuery.isLoading ? (
          <p className="text-xs text-jokenia-tan">Loading…</p>
        ) : data ? (
          <>
            <div className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                {data.product_type}
              </p>
              <p className="text-lg font-semibold text-jokenia-dark">{data.variation_name}</p>
              <p className="font-mono text-xs text-jokenia-tan">{data.sku}</p>
              <p className="mt-2 text-2xl font-bold text-jokenia-dark2">
                KES {data.current_price.toLocaleString()}
              </p>
              {!showEditForm && (
                <Button onClick={() => setShowEditForm(true)} className="mt-2">
                  Edit price
                </Button>
              )}
            </div>

            {showEditForm && (
              <div className="space-y-2 rounded-md border border-jokenia-gold/40 bg-jokenia-cream2 p-3">
                {(formError || updateMutation.error) && (
                  <p className="text-xs text-red-500">
                    {formError ?? (updateMutation.error as Error).message}
                  </p>
                )}
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                    New price (KES)
                  </p>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(event) => setNewPrice(event.target.value)}
                    placeholder="0.00"
                    min={0}
                    className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                  />
                </div>
                {!isInitialPrice && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                      Reason
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {REASONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            reason === r
                              ? 'border-jokenia-dark bg-jokenia-dark text-jokenia-gold'
                              : 'border-jokenia-tan/30 bg-white text-jokenia-dark2'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                    Notes (optional)
                  </p>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowEditForm(false)}
                    disabled={updateMutation.isPending}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="flex-1">
                    {updateMutation.isPending ? 'Updating…' : 'Update price'}
                  </Button>
                </div>
              </div>
            )}

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Price history
              </p>
              {history.length === 0 ? (
                <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                  No price changes recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-xs text-jokenia-tan">{formatDate(entry.created_at)}</p>
                        <p className="text-sm text-jokenia-dark">
                          KES {entry.old_price.toLocaleString()} → KES {entry.new_price.toLocaleString()}
                        </p>
                        <p className="text-xs text-jokenia-tan">
                          {entry.is_revert ? 'Revert' : (entry.reason ?? 'System')} · by {entry.changed_by}
                        </p>
                        {entry.notes && <p className="text-xs italic text-jokenia-tan">{entry.notes}</p>}
                      </div>
                      {isSuperAdmin && entry.id === mostRecentId && (
                        <Button
                          variant="secondary"
                          onClick={() => revertMutation.mutate(entry.id)}
                          disabled={revertMutation.isPending}
                        >
                          {revertMutation.isPending ? 'Reverting…' : 'Revert'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {revertMutation.error && (
                <p className="mt-1 text-xs text-red-500">{(revertMutation.error as Error).message}</p>
              )}
            </div>
          </>
        ) : null}

        <Button variant="secondary" onClick={onClose} className="w-full">
          Close
        </Button>
      </div>
    </Modal>
  )
}

export default PriceDetailModal
