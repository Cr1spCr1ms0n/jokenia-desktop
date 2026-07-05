import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import PriceDetailModal from './PriceDetailModal'
import type { TypePricingRow } from './types'

async function fetchTypePricing(typeId: string): Promise<TypePricingRow[]> {
  const { data, error } = await supabase.rpc('get_type_pricing', { p_type_id: typeId })
  if (error) throw error
  return (data ?? []) as TypePricingRow[]
}

interface TypePricingViewProps {
  typeId: string
  typeName: string
  isSuperAdmin: boolean
  onBack: () => void
}

function TypePricingView({ typeId, typeName, isSuperAdmin, onBack }: TypePricingViewProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null)

  const pricingQuery = useQuery({
    queryKey: ['type-pricing', typeId],
    queryFn: () => fetchTypePricing(typeId)
  })
  const rows = pricingQuery.data ?? []

  const grouped = rows.reduce<Record<string, { title: string; rows: TypePricingRow[] }>>((acc, row) => {
    const key = row.style_id ?? 'no_style'
    const title = row.style_id ? (row.style_name ?? 'Unnamed style') : 'No style'
    if (!acc[key]) acc[key] = { title, rows: [] }
    acc[key].rows.push(row)
    return acc
  }, {})
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'no_style') return 1
    if (b === 'no_style') return -1
    return grouped[a].title.localeCompare(grouped[b].title)
  })

  return (
    <div className="flex h-full flex-col p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to product types
      </button>
      <h2 className="mb-3 font-heading text-lg font-semibold text-jokenia-dark">{typeName}</h2>

      <QueryState
        isLoading={pricingQuery.isLoading}
        error={pricingQuery.error as Error | null}
        isEmpty={rows.length === 0}
        emptyText="This product type has no variations yet."
        onRetry={pricingQuery.refetch}
      >
        <div className="flex-1 space-y-4 overflow-y-auto">
          {groupKeys.map((key) => (
            <div key={key}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                {grouped[key].title}
              </p>
              <div className="flex flex-wrap gap-2">
                {grouped[key].rows.map((row) => {
                  const unpriced = row.current_price == null
                  const overridden = row.override_price != null
                  return (
                    <button
                      key={row.variation_id}
                      type="button"
                      onClick={() => setSelectedVariationId(row.variation_id)}
                      className={`min-w-[110px] rounded-md border px-3 py-2 text-left ${
                        overridden
                          ? 'border-amber-300 bg-amber-50'
                          : unpriced
                            ? 'border-jokenia-tan/20 bg-jokenia-cream2'
                            : 'border-jokenia-tan/20 bg-white'
                      }`}
                    >
                      <p className={`text-xs font-medium ${unpriced ? 'text-jokenia-tan' : 'text-jokenia-dark'}`}>
                        {row.variation_name}
                      </p>
                      <p className={`text-sm font-bold ${unpriced ? 'text-jokenia-tan' : 'text-jokenia-dark2'}`}>
                        {unpriced ? '—' : `KES ${row.current_price!.toLocaleString()}`}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </QueryState>

      {selectedVariationId && (
        <PriceDetailModal
          variationId={selectedVariationId}
          isSuperAdmin={isSuperAdmin}
          isOpen
          onClose={() => setSelectedVariationId(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['type-pricing', typeId] })
          }}
        />
      )}
    </div>
  )
}

export default TypePricingView
