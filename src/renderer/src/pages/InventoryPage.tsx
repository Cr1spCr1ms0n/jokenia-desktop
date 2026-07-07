import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { printLabel } from '@/utils/label'
import Button from '@/components/ui/Button'
import ProductTypesTab from '@/components/inventory/ProductTypesTab'
import PricingTab from '@/components/inventory/PricingTab'
import type { SystemRole } from '@/types'

// get_all_stock_items() verified live: returns item_id, serial_number,
// origin_type, origin_code, variation_id, variation_name, type_name,
// style_name, colour, size, waist_size, inseam, length_label, created_at —
// it does NOT include sku/barcode/price, so those are merged in from a
// second product_variations query keyed by variation_id.
interface StockItem {
  item_id: string
  serial_number: string
  variation_id: string
  type_name: string
  sku: string
  barcode: string
  size: string | null
  waist_size: number | null
  inseam: number | null
  price: number
}

function buildSizeLabel(item: {
  size: string | null
  waist_size: number | null
  inseam: number | null
}): string {
  if (item.size) return item.size
  if (item.waist_size != null && item.inseam != null) {
    return `W${item.waist_size}/L${item.inseam}`
  }
  return ''
}

// Variation-led view (2026-07-07 pivot, paired with the label-template
// dispatch): one row per variation, leading with the barcode that's actually
// printed on labels, with individual serials demoted to a drill-down.
interface VariationGroup {
  variation_id: string
  type_name: string
  sku: string
  barcode: string
  size: string | null
  waist_size: number | null
  inseam: number | null
  price: number
  items: StockItem[]
}

function groupByVariation(items: StockItem[]): VariationGroup[] {
  const map = new Map<string, VariationGroup>()
  for (const item of items) {
    const existing = map.get(item.variation_id)
    if (existing) {
      existing.items.push(item)
      continue
    }
    map.set(item.variation_id, {
      variation_id: item.variation_id,
      type_name: item.type_name,
      sku: item.sku,
      barcode: item.barcode,
      size: item.size,
      waist_size: item.waist_size,
      inseam: item.inseam,
      price: item.price,
      items: [item]
    })
  }
  return [...map.values()]
}

function StockTab(): React.JSX.Element {
  const [items, setItems] = useState<StockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)
  const [printQuantities, setPrintQuantities] = useState<Record<string, string>>({})
  const [expandedVariations, setExpandedVariations] = useState<Set<string>>(new Set())
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null)

  function getPrintQuantity(variationId: string): number {
    const parsed = parseInt(printQuantities[variationId] ?? '1', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }

  function toggleExpanded(variationId: string): void {
    setExpandedVariations((prev) => {
      const next = new Set(prev)
      if (next.has(variationId)) {
        next.delete(variationId)
      } else {
        next.add(variationId)
      }
      return next
    })
  }

  async function handleCopyBarcode(barcode: string): Promise<void> {
    await navigator.clipboard.writeText(barcode)
    setCopiedBarcode(barcode)
    setTimeout(() => {
      setCopiedBarcode((current) => (current === barcode ? null : current))
    }, 1500)
  }

  async function loadItems(): Promise<void> {
    setIsLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('get_all_stock_items')
    if (rpcError) {
      setError(rpcError.message)
      setIsLoading(false)
      return
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>
    const variationIds = [...new Set(rows.map((row) => row.variation_id as string))]

    const metaById = new Map<string, { sku: string; barcode: string }>()
    const priceById = new Map<string, number>()

    if (variationIds.length > 0) {
      const [variationsResult, pricesResult] = await Promise.all([
        supabase.from('product_variations').select('id, sku, barcode').in('id', variationIds),
        supabase.rpc('get_all_current_prices')
      ])
      if (variationsResult.error) {
        setError(variationsResult.error.message)
        setIsLoading(false)
        return
      }
      for (const variation of variationsResult.data ?? []) {
        metaById.set(variation.id as string, {
          sku: variation.sku as string,
          barcode: variation.barcode as string
        })
      }
      // get_all_current_prices applies price-history overrides on top of the
      // base product_variations.price (which is frequently null) — see
      // JOKENIA_GLOBAL.md's "effective price lookup" rule.
      if (!pricesResult.error) {
        const priceRows =
          (pricesResult.data as { prices?: Array<{ variation_id: string; current_price: number | null }> })
            ?.prices ?? []
        for (const priceRow of priceRows) {
          if (priceRow.current_price != null) priceById.set(priceRow.variation_id, priceRow.current_price)
        }
      }
    }

    setItems(
      rows.map((row) => {
        const variationId = row.variation_id as string
        const meta = metaById.get(variationId)
        return {
          item_id: row.item_id as string,
          serial_number: row.serial_number as string,
          variation_id: variationId,
          type_name: row.type_name as string,
          sku: meta?.sku ?? '—',
          barcode: meta?.barcode ?? '',
          size: row.size as string | null,
          waist_size: row.waist_size as number | null,
          inseam: row.inseam as number | null,
          price: priceById.get(variationId) ?? 0
        }
      })
    )
    setIsLoading(false)
  }

  useEffect(() => {
    loadItems()
  }, [])

  const variations = useMemo(() => groupByVariation(items), [items])

  // Matches barcode too (digit search), alongside the existing SKU/type-name
  // match — barcode is now the field printed on labels, so staff should be
  // able to hand-search it when the scanner misbehaves.
  const filteredVariations = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return variations
    return variations.filter(
      (variation) =>
        variation.sku.toLowerCase().includes(query) ||
        variation.type_name.toLowerCase().includes(query) ||
        variation.barcode.toLowerCase().includes(query)
    )
  }, [variations, search])

  // Every item of a variation gets an identical label, so quantity just
  // repeats the same barcode. No native multi-copy IPC param exists yet
  // (unlike print-receipt's `copies`), so this prints N separate jobs in
  // sequence.
  async function handlePrint(variation: VariationGroup, quantity: number): Promise<void> {
    if (!variation.barcode) {
      setPrintError('This variation has no barcode assigned — cannot print a label.')
      return
    }
    setPrintingId(variation.variation_id)
    setPrintError(null)
    try {
      for (let i = 0; i < quantity; i++) {
        await printLabel({ barcode: variation.barcode })
      }
    } catch {
      setPrintError('Could not print label — check the printer is connected and ready.')
    } finally {
      setPrintingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-jokenia-tan">Loading inventory…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-jokenia-tan">{error}</p>
        <Button variant="secondary" onClick={loadItems}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-4">
      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by barcode, SKU, or product type…"
        className="mb-3 rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
      />

      {printError && <p className="mb-2 text-sm text-red-600">{printError}</p>}

      {filteredVariations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-jokenia-tan">No stock items match your search.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium" />
                <th className="px-3 py-2 font-medium">Barcode</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filteredVariations.map((variation) => {
                const isExpanded = expandedVariations.has(variation.variation_id)
                return (
                  <Fragment key={variation.variation_id}>
                    <tr className="border-t border-jokenia-tan/10">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(variation.variation_id)}
                          aria-label={isExpanded ? 'Collapse serials' : 'Expand serials'}
                          aria-expanded={isExpanded}
                          className="flex h-5 w-5 items-center justify-center rounded text-jokenia-tan hover:bg-jokenia-cream2 hover:text-jokenia-dark"
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void handleCopyBarcode(variation.barcode)}
                          disabled={!variation.barcode}
                          title="Click to copy"
                          className="font-mono text-xs text-jokenia-dark2 hover:text-jokenia-dark disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {copiedBarcode === variation.barcode
                            ? 'Copied!'
                            : (variation.barcode || '—')}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-jokenia-dark">{variation.type_name}</td>
                      <td className="px-3 py-2 text-jokenia-dark">{variation.sku}</td>
                      <td className="px-3 py-2 text-jokenia-dark2">{buildSizeLabel(variation)}</td>
                      <td className="px-3 py-2 text-jokenia-dark2">{variation.items.length}</td>
                      <td className="px-3 py-2 text-jokenia-dark">
                        KES {variation.price.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            min={1}
                            value={printQuantities[variation.variation_id] ?? '1'}
                            onChange={(event) =>
                              setPrintQuantities((prev) => ({
                                ...prev,
                                [variation.variation_id]: event.target.value
                              }))
                            }
                            aria-label="Label quantity"
                            className="w-12 rounded-md border border-jokenia-tan/40 bg-white px-1.5 py-1 text-xs text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                          />
                          <Button
                            variant="secondary"
                            onClick={() =>
                              handlePrint(variation, getPrintQuantity(variation.variation_id))
                            }
                            disabled={printingId === variation.variation_id}
                          >
                            {printingId === variation.variation_id ? 'Printing…' : 'Print label'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-jokenia-cream2/40">
                        <td />
                        <td colSpan={7} className="px-3 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                            Serials ({variation.items.length})
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {variation.items.map((item) => (
                              <span
                                key={item.item_id}
                                className="font-mono text-xs text-jokenia-dark2"
                              >
                                {item.serial_number}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type InventoryTab = 'stock' | 'types' | 'pricing'

interface InventoryPageProps {
  role: SystemRole
}

function InventoryPage({ role }: InventoryPageProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<InventoryTab>('stock')
  const isSuperAdmin = role === 'super_admin'

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1.5 border-b border-jokenia-tan/20 bg-jokenia-cream2 px-4 pt-3">
        {(
          [
            { key: 'stock', label: 'Stock' },
            { key: 'types', label: 'Product Types' },
            { key: 'pricing', label: 'Pricing' }
          ] as Array<{ key: InventoryTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
              activeTab === tab.key
                ? 'bg-jokenia-cream text-jokenia-dark'
                : 'text-jokenia-dark2 hover:text-jokenia-dark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {activeTab === 'stock' && <StockTab />}
        {activeTab === 'types' && <ProductTypesTab />}
        {activeTab === 'pricing' && <PricingTab isSuperAdmin={isSuperAdmin} />}
      </div>
    </div>
  )
}

export default InventoryPage
