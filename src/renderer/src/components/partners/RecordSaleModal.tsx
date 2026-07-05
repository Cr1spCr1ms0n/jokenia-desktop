import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { PartnerStockItem, TransferredPartnerItem } from './types'

interface ItemSaleState {
  selected: boolean
  amount_received: string
}

// Matches the admin app's own record-sale screen exactly: transferred items
// currently held by this partner, read directly off `items` (no RPC exists
// for this listing) — note current_owner_type is 'client' even for
// partners, per the admin app's proven query.
async function fetchTransferredItems(partnerId: string): Promise<TransferredPartnerItem[]> {
  const { data, error } = await supabase
    .from('items')
    .select('id, serial_number, variation_id')
    .eq('status', 'transferred')
    .eq('current_owner_id', partnerId)
    .eq('current_owner_type', 'client')
  if (error) throw error
  return (data ?? []) as TransferredPartnerItem[]
}

async function fetchPartnerStock(partnerId: string): Promise<PartnerStockItem[]> {
  const { data, error } = await supabase.rpc('get_partner_stock', { p_partner_id: partnerId })
  if (error) throw error
  return (data as { stock: PartnerStockItem[] }).stock
}

interface RecordSaleModalProps {
  partnerId: string
  isOpen: boolean
  onClose: () => void
  onRecorded: () => void
}

function RecordSaleModal({ partnerId, isOpen, onClose, onRecorded }: RecordSaleModalProps): React.JSX.Element {
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [itemStates, setItemStates] = useState<Record<string, ItemSaleState>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const itemsQuery = useQuery({
    queryKey: ['partner-transferred-items', partnerId],
    queryFn: () => fetchTransferredItems(partnerId),
    enabled: isOpen
  })
  const stockQuery = useQuery({
    queryKey: ['partner-stock-for-sale', partnerId],
    queryFn: () => fetchPartnerStock(partnerId),
    enabled: isOpen
  })

  const items = itemsQuery.data ?? []
  const stockMap = new Map((stockQuery.data ?? []).map((s) => [s.variation_id, s]))

  function stateFor(itemId: string): ItemSaleState {
    return itemStates[itemId] ?? { selected: false, amount_received: '' }
  }

  const recordMutation = useMutation({
    mutationFn: async () => {
      const selected = items.filter((item) => itemStates[item.id]?.selected)
      const { error } = await supabase.rpc('record_partner_sale', {
        p_partner_id: partnerId,
        p_sale_date: saleDate,
        p_items: selected.map((item) => ({
          item_id: item.id,
          amount_received: parseFloat(itemStates[item.id].amount_received)
        }))
      })
      if (error) throw error
    },
    onSuccess: () => {
      onRecorded()
    }
  })

  function toggleItem(itemId: string): void {
    setItemStates((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], selected: !prev[itemId]?.selected }
    }))
  }

  function setAmount(itemId: string, value: string): void {
    setItemStates((prev) => ({ ...prev, [itemId]: { ...prev[itemId], amount_received: value } }))
  }

  const selectedCount = Object.values(itemStates).filter((s) => s.selected).length

  function handleSubmit(): void {
    if (saleDate > new Date().toISOString().slice(0, 10)) {
      setFormError('Sale date cannot be in the future.')
      return
    }
    const selected = items.filter((item) => itemStates[item.id]?.selected)
    if (selected.length === 0) {
      setFormError('Select at least one item to record a sale.')
      return
    }
    const invalid = selected.some((item) => {
      const amount = parseFloat(itemStates[item.id]?.amount_received ?? '')
      return isNaN(amount) || amount <= 0
    })
    if (invalid) {
      setFormError('All selected items must have a valid amount received.')
      return
    }
    setFormError(null)
    recordMutation.mutate()
  }

  return (
    <Modal title="Record partner sales" isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        {(formError || recordMutation.error) && (
          <p className="text-xs text-red-500">{formError ?? (recordMutation.error as Error).message}</p>
        )}

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">Sale date</p>
          <input
            type="date"
            value={saleDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setSaleDate(event.target.value)}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
          Items at partner{selectedCount > 0 ? ` (${selectedCount} selected)` : ''}
        </p>

        {itemsQuery.isLoading ? (
          <p className="text-xs text-jokenia-tan">Loading…</p>
        ) : items.length === 0 ? (
          <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
            No transferred items currently at this partner.
          </p>
        ) : (
          <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
            {items.map((item) => {
              const state = stateFor(item.id)
              const stock = stockMap.get(item.variation_id)
              return (
                <div key={item.id} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-jokenia-dark">{item.serial_number}</p>
                      {stock && (
                        <p className="text-xs text-jokenia-tan">
                          {stock.product_type} — {stock.variation_name} · {stock.sku}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {stock?.selling_price != null && (
                        <p className="text-xs font-semibold text-jokenia-dark2">
                          KES {stock.selling_price.toLocaleString()}
                        </p>
                      )}
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          state.selected
                            ? 'border-jokenia-dark bg-jokenia-dark text-jokenia-gold'
                            : 'border-jokenia-tan/40 bg-white'
                        }`}
                      >
                        {state.selected && '✓'}
                      </span>
                    </div>
                  </button>
                  {state.selected && (
                    <div className="mt-2 pl-1">
                      <input
                        type="number"
                        value={state.amount_received}
                        onChange={(event) => setAmount(item.id, event.target.value)}
                        placeholder={
                          stock?.selling_price != null ? String(stock.selling_price) : 'Amount received (KES)'
                        }
                        className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={recordMutation.isPending || selectedCount === 0}
            className="flex-1"
          >
            {recordMutation.isPending
              ? 'Recording…'
              : selectedCount > 0
                ? `Record ${selectedCount} Sale${selectedCount > 1 ? 's' : ''}`
                : 'Record Sales'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default RecordSaleModal
