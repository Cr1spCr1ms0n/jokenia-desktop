import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { PriceListItem, PriceReason } from './types'

const REASONS: PriceReason[] = ['Clearance', 'Restock', 'Market Adjustment', 'Other']

async function fetchAllPrices(): Promise<PriceListItem[]> {
  const { data, error } = await supabase.rpc('get_all_current_prices')
  if (error) throw error
  return (data as { prices: PriceListItem[] }).prices
}

interface BulkUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  onApplied: () => void
}

// super_admin-only, matching bulk.tsx's own restricted-screen gate exactly
// — enforced by the caller not rendering the entry point for non-super_admin
// roles, same pattern used for the Expenses tab.
function BulkUpdateModal({ isOpen, onClose, onApplied }: BulkUpdateModalProps): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newPrice, setNewPrice] = useState('')
  const [reason, setReason] = useState<PriceReason>('Clearance')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null)

  const pricesQuery = useQuery({
    queryKey: ['all-current-prices-bulk'],
    queryFn: fetchAllPrices,
    enabled: isOpen
  })
  const prices = pricesQuery.data ?? []

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? prices.filter((p) => p.variation_name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      : prices
    const map = new Map<string, PriceListItem[]>()
    for (const item of filtered) {
      const g = map.get(item.product_type) ?? []
      g.push(item)
      map.set(item.product_type, g)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [prices, search])

  const bulkMutation = useMutation({
    mutationFn: async (): Promise<{ updated: number; skipped: number }> => {
      const parsed = parseFloat(newPrice)
      const { data, error } = await supabase.rpc('bulk_update_prices', {
        p_lines: Array.from(selected).map((variation_id) => ({ variation_id, new_price: parsed })),
        p_reason: reason,
        p_notes: notes.trim() || null
      })
      if (error) throw error
      return data as { updated: number; skipped: number; history_ids: string[] }
    },
    onSuccess: (res) => {
      setResult({ updated: res.updated, skipped: res.skipped })
      setSelected(new Set())
      onApplied()
    }
  })

  function toggleItem(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroup(items: PriceListItem[]): void {
    const ids = items.map((i) => i.variation_id)
    const allSelected = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }

  function handleSubmit(): void {
    const parsed = parseFloat(newPrice)
    if (isNaN(parsed) || parsed <= 0) {
      setFormError('Enter a valid price greater than 0.')
      return
    }
    if (selected.size === 0) {
      setFormError('Select at least one variation.')
      return
    }
    setFormError(null)
    setResult(null)
    bulkMutation.mutate()
  }

  function handleClose(): void {
    setSearch('')
    setSelected(new Set())
    setNewPrice('')
    setNotes('')
    setResult(null)
    onClose()
  }

  return (
    <Modal title="Bulk price update" isOpen={isOpen} onClose={handleClose} maxWidthClassName="max-w-2xl">
      <div className="flex max-h-[75vh] flex-col gap-3">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by name or SKU…"
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />

        {selected.size > 0 && (
          <p className="text-xs font-semibold text-jokenia-dark2">{selected.size} selected</p>
        )}

        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          {pricesQuery.isLoading ? (
            <p className="p-3 text-xs text-jokenia-tan">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="p-3 text-xs text-jokenia-tan">No variations found.</p>
          ) : (
            groups.map(([productType, items]) => (
              <div key={productType}>
                <button
                  type="button"
                  onClick={() => toggleGroup(items)}
                  className="flex w-full items-center gap-2 border-t border-jokenia-tan/10 bg-jokenia-cream2 px-3 py-1.5 text-left first:border-t-0"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                      items.every((i) => selected.has(i.variation_id))
                        ? 'border-jokenia-dark bg-jokenia-dark text-jokenia-gold'
                        : 'border-jokenia-tan/40 bg-white'
                    }`}
                  >
                    {items.every((i) => selected.has(i.variation_id)) && '✓'}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-jokenia-dark2">
                    {productType}
                  </span>
                </button>
                {items.map((item) => (
                  <button
                    key={item.variation_id}
                    type="button"
                    onClick={() => toggleItem(item.variation_id)}
                    className="flex w-full items-center gap-2 border-t border-jokenia-tan/10 bg-white px-3 py-1.5 text-left"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                        selected.has(item.variation_id)
                          ? 'border-jokenia-dark bg-jokenia-dark text-jokenia-gold'
                          : 'border-jokenia-tan/40 bg-white'
                      }`}
                    >
                      {selected.has(item.variation_id) && '✓'}
                    </span>
                    <span className="flex-1 text-xs text-jokenia-dark">{item.variation_name}</span>
                    <span className="font-mono text-[11px] text-jokenia-tan">{item.sku}</span>
                    <span className="text-xs font-semibold text-jokenia-dark2">
                      {item.current_price != null ? `KES ${item.current_price.toLocaleString()}` : '—'}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 rounded-md border border-jokenia-tan/20 bg-jokenia-cream2 p-3">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
              New price for all selected (KES)
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
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notes (optional)"
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
          <p className="text-[11px] text-jokenia-tan">
            Will update {selected.size} variation{selected.size !== 1 ? 's' : ''}. This cannot be undone.
          </p>
          {(formError || bulkMutation.error) && (
            <p className="text-xs text-red-500">{formError ?? (bulkMutation.error as Error).message}</p>
          )}
          {result && (
            <p className="text-xs font-semibold text-green-700">
              Updated {result.updated} variation{result.updated !== 1 ? 's' : ''}
              {result.skipped > 0 ? `, skipped ${result.skipped}` : ''}.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose} className="flex-1">
              Close
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={bulkMutation.isPending || selected.size === 0}
              className="flex-1"
            >
              {bulkMutation.isPending ? 'Applying…' : `Apply to ${selected.size} variation${selected.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default BulkUpdateModal
