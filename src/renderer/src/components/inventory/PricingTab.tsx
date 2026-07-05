import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import TypePricingView from './TypePricingView'
import PriceDetailModal from './PriceDetailModal'
import BulkUpdateModal from './BulkUpdateModal'
import type { ProductTypeRow, UnpricedItem } from './types'

type SubTab = 'all' | 'unpriced'

// product_types has no branding_client_id column live — see ProductTypesTab.tsx.
async function fetchProductTypes(): Promise<ProductTypeRow[]> {
  const { data, error } = await supabase
    .from('product_types')
    .select('id, name, type_code, type_seq, has_variations')
    .order('name')
  if (error) throw error
  return (data ?? []) as ProductTypeRow[]
}

async function fetchUnpriced(): Promise<UnpricedItem[]> {
  const { data, error } = await supabase.rpc('get_unpriced_items')
  if (error) throw error
  return (data as { items: UnpricedItem[] }).items
}

interface PricingTabProps {
  isSuperAdmin: boolean
}

function PricingTab({ isSuperAdmin }: PricingTabProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<SubTab>('all')
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<{ id: string; name: string } | null>(null)
  const [unpricedVariationId, setUnpricedVariationId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const typesQuery = useQuery({ queryKey: ['product-types'], queryFn: fetchProductTypes })
  const unpricedQuery = useQuery({
    queryKey: ['unpriced-items'],
    queryFn: fetchUnpriced,
    enabled: activeTab === 'unpriced'
  })

  const filteredTypes = useMemo(() => {
    const q = search.trim().toLowerCase()
    const types = typesQuery.data ?? []
    return q ? types.filter((t) => t.name.toLowerCase().includes(q)) : types
  }, [typesQuery.data, search])

  const groupedUnpriced = useMemo(() => {
    const q = search.trim().toLowerCase()
    const items = unpricedQuery.data ?? []
    const filtered = q
      ? items.filter(
          (i) =>
            i.product_type_name.toLowerCase().includes(q) ||
            i.name.toLowerCase().includes(q) ||
            i.sku.toLowerCase().includes(q)
        )
      : items
    const map = new Map<string, UnpricedItem[]>()
    for (const item of filtered) {
      const g = map.get(item.product_type_name) ?? []
      g.push(item)
      map.set(item.product_type_name, g)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [unpricedQuery.data, search])

  const unpricedCount = unpricedQuery.data?.length ?? 0

  if (selectedType) {
    return (
      <TypePricingView
        typeId={selectedType.id}
        typeName={selectedType.name}
        isSuperAdmin={isSuperAdmin}
        onBack={() => setSelectedType(null)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={activeTab === 'all' ? 'Search product types…' : 'Search unpriced…'}
          className="flex-1 rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
        {isSuperAdmin && <Button onClick={() => setBulkOpen(true)}>Bulk update</Button>}
      </div>

      <div className="mb-3 flex gap-1.5">
        {(['all', 'unpriced'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeTab === tab
                ? 'bg-jokenia-dark text-jokenia-gold'
                : 'border border-jokenia-tan/30 bg-white/70 text-jokenia-dark2'
            }`}
          >
            {tab === 'all' ? 'All types' : `Unpriced${unpricedCount > 0 ? ` (${unpricedCount})` : ''}`}
          </button>
        ))}
      </div>

      {activeTab === 'all' ? (
        <QueryState
          isLoading={typesQuery.isLoading}
          error={typesQuery.error as Error | null}
          isEmpty={filteredTypes.length === 0}
          emptyText={search ? 'No results.' : 'No product types yet.'}
          onRetry={typesQuery.refetch}
        >
          <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
            {filteredTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType({ id: type.id, name: type.name })}
                className="flex w-full items-center justify-between border-t border-jokenia-tan/10 bg-white/70 px-3 py-2 text-left first:border-t-0 hover:bg-white"
              >
                <p className="text-sm text-jokenia-dark">{type.name}</p>
                <span className="text-xs text-jokenia-tan">View pricing →</span>
              </button>
            ))}
          </div>
        </QueryState>
      ) : (
        <QueryState
          isLoading={unpricedQuery.isLoading}
          error={unpricedQuery.error as Error | null}
          isEmpty={groupedUnpriced.length === 0}
          emptyText={search ? 'No results.' : 'Nothing needs pricing right now.'}
          onRetry={unpricedQuery.refetch}
        >
          <div className="flex-1 space-y-3 overflow-y-auto">
            {groupedUnpriced.map(([productType, items]) => (
              <div key={productType}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                  {productType}
                </p>
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {items.map((item) => (
                    <button
                      key={item.variation_id}
                      type="button"
                      onClick={() => setUnpricedVariationId(item.variation_id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white"
                    >
                      <div>
                        <p className="text-sm text-jokenia-dark">{item.name}</p>
                        <p className="text-xs text-jokenia-tan">
                          {item.sku}
                          {item.in_stock_count > 0 ? ` · ${item.in_stock_count} in stock` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-jokenia-tan">Set price →</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </QueryState>
      )}

      {unpricedVariationId && (
        <PriceDetailModal
          variationId={unpricedVariationId}
          isSuperAdmin={isSuperAdmin}
          isOpen
          onClose={() => setUnpricedVariationId(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['unpriced-items'] })
          }}
        />
      )}

      <BulkUpdateModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onApplied={() => {
          queryClient.invalidateQueries({ queryKey: ['unpriced-items'] })
          queryClient.invalidateQueries({ queryKey: ['product-types'] })
        }}
      />
    </div>
  )
}

export default PricingTab
