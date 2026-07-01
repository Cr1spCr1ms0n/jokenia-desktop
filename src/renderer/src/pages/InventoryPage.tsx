import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { printLabel } from '@/utils/label'
import Button from '@/components/ui/Button'

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

function buildSizeLabel(item: StockItem): string {
  if (item.size) return item.size
  if (item.waist_size != null && item.inseam != null) {
    return `W${item.waist_size}/L${item.inseam}`
  }
  return ''
}

function InventoryPage(): React.JSX.Element {
  const [items, setItems] = useState<StockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [printError, setPrintError] = useState<string | null>(null)

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

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return items
    return items.filter(
      (item) =>
        item.sku.toLowerCase().includes(query) || item.type_name.toLowerCase().includes(query)
    )
  }, [items, search])

  async function handlePrint(item: StockItem): Promise<void> {
    setPrintingId(item.item_id)
    setPrintError(null)
    try {
      await printLabel({
        barcode: item.barcode,
        serialNumber: item.serial_number,
        sku: item.sku,
        size: buildSizeLabel(item),
        price: item.price
      })
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
        placeholder="Search by SKU or product type…"
        className="mb-3 rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold"
      />

      {printError && <p className="mb-2 text-sm text-red-600">{printError}</p>}

      {filteredItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-jokenia-tan">No stock items match your search.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-jokenia-cream2">
              <tr className="text-jokenia-dark2">
                <th className="px-3 py-2 font-medium">Serial</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.item_id} className="border-t border-jokenia-tan/10">
                  <td className="px-3 py-2 font-mono text-xs text-jokenia-dark2">
                    {item.serial_number}
                  </td>
                  <td className="px-3 py-2 text-jokenia-dark">{item.type_name}</td>
                  <td className="px-3 py-2 text-jokenia-dark">{item.sku}</td>
                  <td className="px-3 py-2 text-jokenia-dark2">{buildSizeLabel(item)}</td>
                  <td className="px-3 py-2 text-jokenia-dark">
                    KES {item.price.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => handlePrint(item)}
                      disabled={printingId === item.item_id}
                    >
                      {printingId === item.item_id ? 'Printing…' : 'Print label'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default InventoryPage
