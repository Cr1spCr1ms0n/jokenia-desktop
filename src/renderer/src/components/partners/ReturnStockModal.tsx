import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { PartnerSerializedItem } from './types'

async function fetchPartnerStockItems(partnerId: string): Promise<PartnerSerializedItem[]> {
  const { data, error } = await supabase.rpc('get_partner_stock_items', { p_partner_id: partnerId })
  if (error) throw error
  return (data as { items: PartnerSerializedItem[] }).items
}

interface ReturnStockModalProps {
  partnerId: string
  isOpen: boolean
  onClose: () => void
  onReturned: () => void
}

// JOKENIA_GLOBAL euphemism rule applied here too (same as Consignees): the
// admin app's own return screen calls this action "Mark as Lost" — desktop
// renames the label to "Accept liability" while calling the identical
// `mark_partner_item_lost` RPC underneath. Labeling only, no RPC change.
function ReturnStockModal({ partnerId, isOpen, onClose, onReturned }: ReturnStockModalProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [careItem, setCareItem] = useState<PartnerSerializedItem | null>(null)

  const itemsQuery = useQuery({
    queryKey: ['partner-stock-items', partnerId],
    queryFn: () => fetchPartnerStockItems(partnerId),
    enabled: isOpen
  })
  const items = itemsQuery.data ?? []

  const returnMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('return_partner_stock', {
        p_partner_id: partnerId,
        p_item_ids: Array.from(selectedIds),
        p_return_date: returnDate,
        p_notes: notes.trim() || null
      })
      if (error) throw error
    },
    onSuccess: () => {
      setSelectedIds(new Set())
      setNotes('')
      onReturned()
    }
  })

  const careMutation = useMutation({
    mutationFn: async () => {
      if (!careItem) return
      const { error } = await supabase.rpc('mark_partner_item_lost', {
        p_partner_id: partnerId,
        p_item_id: careItem.item_id,
        p_loss_date: new Date().toISOString().slice(0, 10),
        p_notes: null
      })
      if (error) throw error
    },
    onSuccess: () => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (careItem) next.delete(careItem.item_id)
        return next
      })
      setCareItem(null)
      queryClient.invalidateQueries({ queryKey: ['partner-stock-items', partnerId] })
    }
  })

  function toggleItem(itemId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function handleSubmit(): void {
    if (selectedIds.size === 0) {
      setFormError('Select at least one item to return.')
      return
    }
    setFormError(null)
    returnMutation.mutate()
  }

  const grouped = items.reduce<Record<string, PartnerSerializedItem[]>>((acc, item) => {
    if (!acc[item.type_name]) acc[item.type_name] = []
    acc[item.type_name].push(item)
    return acc
  }, {})
  const typeNames = Object.keys(grouped).sort()

  return (
    <>
      <Modal title="Return stock" isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-lg">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto">
          {(formError || returnMutation.error) && (
            <p className="text-xs text-red-500">{formError ?? (returnMutation.error as Error).message}</p>
          )}

          {itemsQuery.isLoading ? (
            <p className="text-xs text-jokenia-tan">Loading…</p>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
              No stock currently at this partner.
            </p>
          ) : (
            typeNames.map((typeName) => (
              <div key={typeName}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                  {typeName}
                </p>
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {grouped[typeName].map((item) => {
                    const selected = selectedIds.has(item.item_id)
                    return (
                      <div key={item.item_id} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleItem(item.item_id)}
                            className="flex flex-1 items-center gap-2 text-left"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                selected
                                  ? 'border-jokenia-dark bg-jokenia-dark text-jokenia-gold'
                                  : 'border-jokenia-tan/40 bg-white'
                              }`}
                            >
                              {selected && '✓'}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-jokenia-dark">{item.serial_number}</p>
                              <p className="text-xs text-jokenia-tan">
                                {item.variation_name}
                                {item.sku ? ` · ${item.sku}` : ''}
                              </p>
                            </div>
                          </button>
                          <p className="text-xs font-semibold text-jokenia-dark2">
                            KES {item.selling_price.toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCareItem(item)}
                          disabled={selected || careMutation.isPending}
                          className="mt-1 w-full rounded-md border border-red-200 bg-red-50 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40"
                        >
                          Accept liability
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
              Return date
            </p>
            <input
              type="date"
              value={returnDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setReturnDate(event.target.value)}
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
              Notes (optional)
            </p>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Reason for return, condition notes…"
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={returnMutation.isPending || selectedIds.size === 0}
              className="flex-1"
            >
              {returnMutation.isPending
                ? 'Returning…'
                : selectedIds.size > 0
                  ? `Return ${selectedIds.size} Item${selectedIds.size > 1 ? 's' : ''}`
                  : 'Return Items'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Accept liability"
        isOpen={careItem !== null}
        onClose={() => {
          if (!careMutation.isPending) setCareItem(null)
        }}
      >
        {careItem && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-jokenia-dark">{careItem.serial_number}</p>
            <p className="text-xs text-jokenia-tan">{careItem.variation_name}</p>
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              This cannot be undone. The partner remains liable for this item at KES{' '}
              {careItem.selling_price.toLocaleString()}.
            </p>
            {careMutation.error && (
              <p className="text-xs text-red-500">{(careMutation.error as Error).message}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setCareItem(null)}
                disabled={careMutation.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={() => careMutation.mutate()} disabled={careMutation.isPending} className="flex-1">
                {careMutation.isPending ? 'Recording…' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default ReturnStockModal
