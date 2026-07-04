import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { ConsigneeVariationOption, ReceiveStockLine } from './types'

const SEARCH_DEBOUNCE_MS = 300

function blankLine(): ReceiveStockLine {
  return { variation: null, quantity: '', consignee_price: '' }
}

async function searchClientVariations(
  clientId: string,
  query: string
): Promise<ConsigneeVariationOption[]> {
  const pattern = `%${query.trim()}%`
  const { data, error } = await supabase
    .from('product_variations')
    .select('id, name, sku, product_types(name)')
    .eq('branding_client_id', clientId)
    .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
    .limit(20)

  if (error || !data) return []

  const rows = data as unknown as Array<{
    id: string
    name: string
    sku: string
    product_types: { name: string } | null
  }>

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    product_type_name: row.product_types?.name ?? '—'
  }))
}

interface LineEditorProps {
  clientId: string
  line: ReceiveStockLine
  index: number
  canRemove: boolean
  onChange: (patch: Partial<ReceiveStockLine>) => void
  onRemove: () => void
}

function LineEditor({ clientId, line, index, canRemove, onChange, onRemove }: LineEditorProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ConsigneeVariationOption[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  function handleQueryChange(value: string): void {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      void searchClientVariations(clientId, value).then((rows) => {
        setResults(rows)
        setSearching(false)
      })
    }, SEARCH_DEBOUNCE_MS)
  }

  return (
    <div className="space-y-2 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-jokenia-tan">
          Line {index + 1}
        </p>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:text-red-600">
            Remove
          </button>
        )}
      </div>

      {line.variation ? (
        <div className="flex items-center justify-between rounded-md border border-jokenia-gold/40 bg-jokenia-cream2 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-jokenia-dark">
              {line.variation.product_type_name} — {line.variation.name}
            </p>
            <p className="text-xs text-jokenia-tan">{line.variation.sku}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ variation: null })}
            className="text-xs text-jokenia-tan hover:text-jokenia-dark"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Search this consignee's variations by name or SKU…"
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
          {searching && <p className="mt-1 text-xs text-jokenia-tan">Searching…</p>}
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-jokenia-tan/30 bg-white shadow-md">
              {results.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange({ variation: option })
                    setQuery('')
                    setResults([])
                  }}
                  className="block w-full border-b border-jokenia-tan/10 px-3 py-2 text-left last:border-b-0 hover:bg-jokenia-cream2"
                >
                  <div className="truncate text-xs font-medium text-jokenia-dark">
                    {option.product_type_name} — {option.name}
                  </div>
                  <div className="truncate text-[11px] text-jokenia-tan">{option.sku}</div>
                </button>
              ))}
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-1 text-xs text-jokenia-tan">
              No variations branded to this consignee match "{query}".
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          value={line.quantity}
          onChange={(event) => onChange({ quantity: event.target.value })}
          placeholder="Quantity"
          min={1}
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
        <input
          type="number"
          value={line.consignee_price}
          onChange={(event) => onChange({ consignee_price: event.target.value })}
          placeholder="Consignee price (KES)"
          min={0}
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
      </div>
    </div>
  )
}

interface ReceiveStockModalProps {
  clientId: string
  isOpen: boolean
  onClose: () => void
  onReceived: () => void
}

function ReceiveStockModal({ clientId, isOpen, onClose, onReceived }: ReceiveStockModalProps): React.JSX.Element {
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<ReceiveStockLine[]>([blankLine()])
  const [formError, setFormError] = useState<string | null>(null)

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('receive_stock', {
        p_client_id: clientId,
        p_received_date: receivedDate,
        p_lines: lines.map((line) => ({
          variation_id: line.variation?.id,
          quantity: parseInt(line.quantity, 10),
          consignee_price: parseFloat(line.consignee_price)
        }))
      })
      if (error) throw error
    },
    onSuccess: () => {
      setLines([blankLine()])
      onReceived()
    }
  })

  function updateLine(index: number, patch: Partial<ReceiveStockLine>): void {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function removeLine(index: number): void {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  function handleSubmit(): void {
    for (const line of lines) {
      if (!line.variation) {
        setFormError('Select a variation for every line.')
        return
      }
      if (!(parseInt(line.quantity, 10) > 0)) {
        setFormError('Enter a quantity greater than zero for every line.')
        return
      }
      if (!(parseFloat(line.consignee_price) >= 0)) {
        setFormError('Enter a valid consignee price for every line.')
        return
      }
    }
    setFormError(null)
    receiveMutation.mutate()
  }

  return (
    <Modal title="Receive stock" isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        {(formError || receiveMutation.error) && (
          <p className="text-xs text-red-500">
            {formError ?? (receiveMutation.error as Error).message}
          </p>
        )}

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Received date
          </p>
          <input
            type="date"
            value={receivedDate}
            onChange={(event) => setReceivedDate(event.target.value)}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>

        {lines.map((line, index) => (
          <LineEditor
            key={index}
            clientId={clientId}
            line={line}
            index={index}
            canRemove={lines.length > 1}
            onChange={(patch) => updateLine(index, patch)}
            onRemove={() => removeLine(index)}
          />
        ))}

        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, blankLine()])}
          className="w-full rounded-md border border-dashed border-jokenia-gold py-2 text-xs font-medium text-jokenia-dark2 hover:bg-white"
        >
          + Add another product
        </button>

        <p className="text-xs text-jokenia-tan">
          Items are generated immediately with C-prefix serial numbers — no verification step is
          required for consignee stock.
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={receiveMutation.isPending} className="flex-1">
            {receiveMutation.isPending ? 'Receiving…' : 'Receive stock'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ReceiveStockModal
