import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'

interface ResolveBarcodeRow {
  variation_id: string
  product_type: string
  variation_name: string
  sku: string
  last_price: number
  stock_count: number
}

interface SearchResultRow {
  variation_id: string
  product_type: string
  variation_name: string
  sku: string
  price: number
}

type ScanStatus = 'idle' | 'loading' | 'success' | 'error'

interface ScanInputProps {
  isConfirming: boolean
}

const BORDER_CLASSES: Record<ScanStatus, string> = {
  idle: 'border-jokenia-gold',
  loading: 'border-jokenia-gold',
  success: 'border-green-500',
  error: 'border-red-400'
}

const SEARCH_DEBOUNCE_MS = 300

// Search results don't carry a real stock count (unlike a barcode scan,
// which resolves through resolve_barcode's live count) — server-side
// create_sale enforces stock, surfaced via the existing "Insufficient
// stock" error path, so the cart's client-side +/- cap is left unset here.
const UNCAPPED_STOCK = Number.MAX_SAFE_INTEGER

async function searchVariations(query: string): Promise<SearchResultRow[]> {
  const pattern = `%${query.trim()}%`
  const { data, error } = await supabase
    .from('product_variations')
    .select('id, name, sku, price, product_types(name)')
    .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
    .limit(20)

  if (error || !data) return []

  const rows = data as unknown as Array<{
    id: string
    name: string
    sku: string
    price: number | null
    product_types: { name: string } | null
  }>

  const variationIds = rows.map((row) => row.id)
  const priceById = new Map<string, number>()

  if (variationIds.length > 0) {
    const { data: priceData, error: priceError } = await supabase.rpc('get_all_current_prices')
    if (!priceError) {
      const priceRows =
        (priceData as { prices?: Array<{ variation_id: string; current_price: number | null }> })
          ?.prices ?? []
      for (const priceRow of priceRows) {
        if (priceRow.current_price != null) priceById.set(priceRow.variation_id, priceRow.current_price)
      }
    }
  }

  return rows.map((row) => ({
    variation_id: row.id,
    product_type: row.product_types?.name ?? '—',
    variation_name: row.name,
    sku: row.sku,
    price: priceById.get(row.id) ?? row.price ?? 0
  }))
}

function ScanInput({ isConfirming }: ScanInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [results, setResults] = useState<SearchResultRow[]>([])
  const clearTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const addOrIncrementItem = useAppStore((state) => state.addOrIncrementItem)

  useEffect(() => {
    inputRef.current?.focus()

    // USB HID scanners type into whatever has focus. If nothing else is
    // focused (user clicked off, a modal closed, etc.) route keystrokes
    // back to the scan input so scans are never lost.
    function handleGlobalKeydown(): void {
      if (document.activeElement === document.body) {
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  }, [])

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  function parseScanError(message: string): string {
    if (message === 'Barcode not recognised') return 'Item not found in system'
    if (message === 'No stock available for this product') return 'No stock available'
    return 'Scan error — try again'
  }

  async function handleScan(barcode: string): Promise<void> {
    setStatus('loading')

    const { data, error } = await supabase.rpc('resolve_barcode', { p_barcode: barcode })

    if (error) {
      setStatus('error')
      setErrorMessage(parseScanError(error.message))
      clearTimerRef.current = setTimeout(() => {
        setStatus('idle')
        setErrorMessage('')
        inputRef.current?.focus()
      }, 3000)
      return
    }

    const row = (data as ResolveBarcodeRow[])[0]
    addOrIncrementItem({
      variation_id: row.variation_id,
      product_type: row.product_type,
      variation_name: row.variation_name,
      sku: row.sku,
      unit_price: row.last_price,
      stock_count: row.stock_count
    })

    setStatus('success')
    clearTimerRef.current = setTimeout(() => {
      setStatus('idle')
      inputRef.current?.focus()
    }, 800)

    inputRef.current?.focus()
  }

  async function runSearch(query: string): Promise<void> {
    const rows = await searchVariations(query)
    setResults(rows)
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const nextValue = event.target.value
    setValue(nextValue)

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    const trimmed = nextValue.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }

    searchTimerRef.current = setTimeout(() => {
      void runSearch(trimmed)
    }, SEARCH_DEBOUNCE_MS)
  }

  function selectResult(result: SearchResultRow): void {
    addOrIncrementItem({
      variation_id: result.variation_id,
      product_type: result.product_type,
      variation_name: result.variation_name,
      sku: result.sku,
      unit_price: result.price,
      stock_count: UNCAPPED_STOCK
    })
    setValue('')
    setResults([])
    inputRef.current?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      // Rapid HID keystrokes are terminated by Enter well before the search
      // debounce fires — clearing the timer here means a real scan never
      // races the text-search path.
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      setResults([])
      const barcode = value.trim()
      setValue('')
      if (barcode && status !== 'loading') {
        void handleScan(barcode)
      }
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isConfirming}
          placeholder="Scan barcode or search by name/SKU..."
          autoComplete="off"
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-jokenia-dark placeholder:text-jokenia-tan/60 focus:outline-none disabled:pointer-events-none disabled:opacity-50 ${BORDER_CLASSES[status]}`}
        />
        {status === 'loading' && (
          <span
            className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-jokenia-tan/40 border-t-jokenia-gold"
            aria-hidden="true"
          />
        )}
      </div>
      {status === 'error' && <p className="mt-1 text-xs text-red-500">{errorMessage}</p>}

      {results.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-jokenia-tan/30 bg-white shadow-md">
          {results.map((result) => (
            <button
              key={result.variation_id}
              type="button"
              onClick={() => selectResult(result)}
              className="block w-full border-b border-jokenia-tan/10 px-3 py-2 text-left last:border-b-0 hover:bg-jokenia-cream2"
            >
              <div className="truncate text-xs font-medium text-jokenia-dark">
                {result.product_type} — {result.variation_name}
              </div>
              <div className="truncate text-[11px] text-jokenia-tan">
                {result.sku} · KES {result.price.toLocaleString('en-KE')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ScanInput
