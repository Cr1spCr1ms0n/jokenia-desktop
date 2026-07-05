import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { ProductionLine, ProductVariationOption } from './types'

const SEARCH_DEBOUNCE_MS = 300

function blankLine(): ProductionLine {
  return { variation: null, quantity: '' }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// Same product_variations search shape as SuggestionResolutionModal's
// existing-variation tab (id, name, sku, product_types!inner(name)) — matched
// here rather than reintroduced with different field names.
async function searchVariations(query: string): Promise<ProductVariationOption[]> {
  const pattern = `%${query.trim()}%`
  const { data, error } = await supabase
    .from('product_variations')
    .select('id, name, sku, product_types!inner(name)')
    .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
    .limit(20)

  if (error || !data) return []

  return (
    data as unknown as Array<{
      id: string
      name: string
      sku: string
      product_types: { name: string } | null
    }>
  ).map((row) => ({
    id: row.id,
    variation_name: row.name,
    sku: row.sku,
    product_type_name: row.product_types?.name ?? ''
  }))
}

interface LineEditorProps {
  line: ProductionLine
  index: number
  canRemove: boolean
  onChange: (patch: Partial<ProductionLine>) => void
  onRemove: () => void
}

function LineEditor({
  line,
  index,
  canRemove,
  onChange,
  onRemove
}: LineEditorProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductVariationOption[]>([])
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
      void searchVariations(value).then((rows) => {
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
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>

      {line.variation ? (
        <div className="flex items-center justify-between rounded-md border border-jokenia-gold/40 bg-jokenia-cream2 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-jokenia-dark">
              {line.variation.product_type_name} — {line.variation.variation_name}
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
            placeholder="Search by name or SKU…"
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
                    {option.product_type_name} — {option.variation_name}
                  </div>
                  <div className="truncate text-[11px] text-jokenia-tan">{option.sku}</div>
                </button>
              ))}
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-1 text-xs text-jokenia-tan">
              No variations match &quot;{query}&quot;.
            </p>
          )}
        </div>
      )}

      <input
        type="number"
        value={line.quantity}
        onChange={(event) => onChange({ quantity: event.target.value })}
        placeholder="Quantity"
        min={1}
        className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
      />
    </div>
  )
}

interface RecordProductionModalProps {
  isOpen: boolean
  onClose: () => void
  onRecorded: (batchId: string) => void
}

function RecordProductionModal({
  isOpen,
  onClose,
  onRecorded
}: RecordProductionModalProps): React.JSX.Element {
  const [productionDate, setProductionDate] = useState(today())
  const [lines, setLines] = useState<ProductionLine[]>([blankLine()])
  const [formError, setFormError] = useState<string | null>(null)

  // create_admin_batch_and_approve — NOT create_admin_batch (that name only
  // exists as the admin app's JS wrapper function, rpc_create_admin_batch).
  // Pre-approves the batch immediately with serial origin 0000; items are
  // generated server-side, never client-side.
  const recordMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('create_admin_batch_and_approve', {
        p_production_date: productionDate,
        p_lines: lines.map((line) => ({
          variation_id: line.variation?.id,
          quantity: parseInt(line.quantity, 10)
        }))
      })
      if (error) throw error
      const rows = data as { batch_id: string }[]
      return rows[0].batch_id
    },
    onSuccess: (batchId) => {
      setLines([blankLine()])
      setProductionDate(today())
      onRecorded(batchId)
    }
  })

  function updateLine(index: number, patch: Partial<ProductionLine>): void {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function removeLine(index: number): void {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  function handleSubmit(): void {
    if (productionDate > today()) {
      setFormError('Production date cannot be in the future.')
      return
    }
    for (const line of lines) {
      if (!line.variation) {
        setFormError('Select a variation for every line.')
        return
      }
      if (!(parseInt(line.quantity, 10) > 0)) {
        setFormError('Enter a quantity greater than zero for every line.')
        return
      }
    }
    setFormError(null)
    recordMutation.mutate()
  }

  return (
    <Modal title="Record production" isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        {(formError || recordMutation.error) && (
          <p className="text-xs text-red-500">
            {formError ?? (recordMutation.error as Error).message}
          </p>
        )}

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Production date
          </p>
          <input
            type="date"
            value={productionDate}
            max={today()}
            onChange={(event) => setProductionDate(event.target.value)}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>

        {lines.map((line, index) => (
          <LineEditor
            key={index}
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

        <p className="text-[11px] italic text-jokenia-tan">
          Items are generated immediately with serial origin 0000 (admin-recorded). No verification
          step is required.
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={recordMutation.isPending} className="flex-1">
            {recordMutation.isPending ? 'Recording…' : 'Record production'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default RecordProductionModal
