import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type {
  ApproveSuggestionParams,
  ApproveSuggestionResult,
  ProductStyleOption,
  ProductTypeOption,
  ProductVariationOption,
  SuggestionDetail
} from './types'

type TabKey = 'accept' | 'existing' | 'new'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'accept', label: 'Accept' },
  { key: 'existing', label: 'Use Existing' },
  { key: 'new', label: 'New Variation' }
]

const inputClass =
  'w-full rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold'
const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-jokenia-tan'

// Mirrors the admin app's suggestion detail screen
// (app/(drawer)/operations/suggestions/[id].tsx). Note: the admin app's own
// SUGGESTION_SELECT does not fetch colour/size/style_hint even though its
// row mapper reads them — see CLAUDE_LOG.md Session 9 RPC inventory. This
// query includes them since the columns are read elsewhere in the admin
// codebase; verified live in Step 3 of this dispatch.
async function fetchSuggestion(id: string): Promise<SuggestionDetail> {
  const { data, error } = await supabase
    .from('product_suggestions')
    .select(
      'id, product_type_name, variation_name, suggested_by ( profiles!staff_id_fkey(full_name) ), colour, size, style_hint'
    )
    .eq('id', id)
    .single()
  if (error) throw error
  const row = data as any
  return {
    id: row.id,
    product_type_name: row.product_type_name,
    variation_name: row.variation_name,
    staff_name: row.suggested_by?.profiles?.full_name ?? 'Unknown',
    colour: row.colour ?? null,
    size: row.size ?? null,
    style_hint: row.style_hint ?? null
  }
}

async function callApprove(
  suggestionId: string,
  params: ApproveSuggestionParams
): Promise<ApproveSuggestionResult> {
  const { data, error } = await supabase.rpc('approve_product_suggestion', {
    p_suggestion_id: suggestionId,
    ...params
  })
  if (error) throw error
  return data as ApproveSuggestionResult
}

interface SuggestionResolutionModalProps {
  suggestionId: string
  onClose: () => void
  onResolved: (result: ApproveSuggestionResult) => void
  onRejected: () => void
}

function SuggestionResolutionModal({
  suggestionId,
  onClose,
  onResolved,
  onRejected
}: SuggestionResolutionModalProps): React.JSX.Element {
  const { data: suggestion } = useQuery({
    queryKey: ['suggestion', suggestionId],
    queryFn: () => fetchSuggestion(suggestionId)
  })

  const [activeTab, setActiveTab] = useState<TabKey>('accept')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Accept tab
  const [acceptVarName, setAcceptVarName] = useState('')
  const [acceptTypeName, setAcceptTypeName] = useState('')
  const [acceptColour, setAcceptColour] = useState('')
  const [acceptSize, setAcceptSize] = useState('')
  const [acceptPrice, setAcceptPrice] = useState('')
  const [acceptBarcode, setAcceptBarcode] = useState('')

  // Use Existing tab
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductVariationOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedVariation, setSelectedVariation] = useState<ProductVariationOption | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // New Variation tab
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [styleMode, setStyleMode] = useState<'existing' | 'new'>('existing')
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [newStyleName, setNewStyleName] = useState('')
  const [newColour, setNewColour] = useState('')
  const [newSize, setNewSize] = useState('')
  const [newBarcode, setNewBarcode] = useState('')

  const { data: productTypes } = useQuery({
    queryKey: ['product-types'],
    queryFn: async (): Promise<ProductTypeOption[]> => {
      const { data, error: queryError } = await supabase.from('product_types').select('id, name')
      if (queryError) throw queryError
      return (data ?? []) as ProductTypeOption[]
    },
    enabled: activeTab === 'new'
  })

  const { data: styles, isLoading: stylesLoading } = useQuery({
    queryKey: ['product-styles', selectedTypeId],
    queryFn: async (): Promise<ProductStyleOption[]> => {
      const { data, error: queryError } = await supabase
        .from('product_styles')
        .select('id, name, style_code')
        .eq('product_type_id', selectedTypeId)
      if (queryError) throw queryError
      return (data ?? []) as ProductStyleOption[]
    },
    enabled: !!selectedTypeId && styleMode === 'existing'
  })

  // Pre-fill fields once the suggestion loads.
  useEffect(() => {
    if (!suggestion) return
    setAcceptVarName(suggestion.variation_name)
    setAcceptTypeName(suggestion.product_type_name)
    setAcceptColour(suggestion.colour ?? '')
    setAcceptSize(suggestion.size ?? '')
    setNewColour(suggestion.colour ?? '')
    setNewSize(suggestion.size ?? '')
    setNewStyleName(suggestion.style_hint ?? '')
    setStyleMode(suggestion.style_hint ? 'new' : 'existing')
  }, [suggestion])

  // Auto-select the product type matching the suggestion once types load.
  useEffect(() => {
    if (!productTypes || !suggestion || selectedTypeId) return
    const match = productTypes.find(
      (type) => type.name.toLowerCase() === suggestion.product_type_name.toLowerCase()
    )
    if (match) setSelectedTypeId(match.id)
  }, [productTypes, suggestion, selectedTypeId])

  // Auto-select the only style if exactly one exists.
  useEffect(() => {
    if (styles && styles.length === 1 && !selectedStyleId && styleMode === 'existing') {
      setSelectedStyleId(styles[0].id)
    }
  }, [styles, styleMode, selectedStyleId])

  // Debounced variation search for the Use Existing tab.
  useEffect(() => {
    if (activeTab !== 'existing' || selectedVariation) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const { data, error: searchError } = await supabase
        .from('product_variations')
        .select('id, name, sku, product_types!inner(name)')
        .or(`name.ilike.%${trimmed}%,sku.ilike.%${trimmed}%`)
        .limit(20)
      setSearching(false)
      if (searchError) {
        setSearchResults([])
        return
      }
      setSearchResults(
        (data ?? []).map((row: any) => ({
          id: row.id,
          variation_name: row.name,
          sku: row.sku,
          product_type_name: row.product_types?.name ?? ''
        }))
      )
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, activeTab, selectedVariation])

  async function handleApprove(params: ApproveSuggestionParams): Promise<void> {
    setError(null)
    setLoading(true)
    try {
      const result = await callApprove(suggestionId, params)
      onResolved(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve suggestion.')
    } finally {
      setLoading(false)
    }
  }

  // Reject modal (nested confirmation, mirrors the admin app's separate step)
  const [rejectVisible, setRejectVisible] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  async function handleReject(): Promise<void> {
    if (!rejectReason.trim()) return
    setError(null)
    setLoading(true)
    const { error: rpcError } = await supabase.rpc('reject_product_suggestion', {
      p_suggestion_id: suggestionId,
      p_reason: rejectReason.trim()
    })
    setLoading(false)
    if (rpcError) {
      setError(rpcError.message)
      setRejectVisible(false)
      return
    }
    onRejected()
  }

  const newConfirmEnabled = selectedTypeId
    ? styleMode === 'existing'
      ? selectedStyleId != null
      : newStyleName.trim().length > 0
    : false

  return (
    <Modal title="Resolve Product Suggestion" isOpen onClose={onClose} maxWidthClassName="max-w-2xl">
      {suggestion && (
        <div className="mb-3 rounded-md border border-jokenia-tan/20 bg-white/60 p-3">
          <p className="font-heading text-sm font-semibold text-jokenia-dark">
            {suggestion.product_type_name} — {suggestion.variation_name}
          </p>
          <p className="text-xs text-jokenia-tan">Submitted by {suggestion.staff_name}</p>
        </div>
      )}

      <div className="mb-3 flex gap-1 rounded-md bg-white/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key ? 'bg-jokenia-gold text-jokenia-dark' : 'text-jokenia-dark2 hover:bg-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {activeTab === 'accept' && (
          <>
            <p className="rounded-md border border-jokenia-tan/20 bg-white/40 p-3 text-xs italic text-jokenia-dark2">
              Accept the staff's suggestion verbatim, or correct any field before committing permanently.
            </p>
            <div>
              <label className={labelClass}>Product type *</label>
              <input
                className={inputClass}
                value={acceptTypeName}
                onChange={(event) => setAcceptTypeName(event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Variation name *</label>
              <input
                className={inputClass}
                value={acceptVarName}
                onChange={(event) => setAcceptVarName(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Colour (optional)</label>
                <input
                  className={inputClass}
                  value={acceptColour}
                  onChange={(event) => setAcceptColour(event.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Size (optional)</label>
                <input
                  className={inputClass}
                  value={acceptSize}
                  onChange={(event) => setAcceptSize(event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Price (optional)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={acceptPrice}
                  onChange={(event) => setAcceptPrice(event.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>External barcode (optional)</label>
                <input
                  className={inputClass}
                  value={acceptBarcode}
                  onChange={(event) => setAcceptBarcode(event.target.value)}
                />
              </div>
            </div>
            <Button
              disabled={!acceptVarName.trim() || !acceptTypeName.trim() || loading}
              onClick={() =>
                handleApprove({
                  p_variation_name: acceptVarName.trim() || null,
                  p_product_type_name: acceptTypeName.trim() || null,
                  p_colour: acceptColour.trim() || null,
                  p_size: acceptSize.trim() || null,
                  p_price: acceptPrice.trim() ? parseFloat(acceptPrice) : null,
                  p_external_barcode: acceptBarcode.trim() || null
                })
              }
            >
              {loading ? 'Accepting…' : 'Accept Suggestion'}
            </Button>
          </>
        )}

        {activeTab === 'existing' && (
          <>
            {selectedVariation ? (
              <div className="flex items-center justify-between rounded-md border border-jokenia-gold/40 bg-jokenia-gold/10 p-3">
                <div>
                  <p className="text-sm font-medium text-jokenia-dark">{selectedVariation.variation_name}</p>
                  <p className="text-xs text-jokenia-tan">
                    {selectedVariation.sku} · {selectedVariation.product_type_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVariation(null)
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  className="text-jokenia-tan hover:text-jokenia-dark"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>Search variation</label>
                  <input
                    className={inputClass}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Type variation name or SKU…"
                  />
                </div>
                {searching && <p className="text-xs text-jokenia-tan">Searching…</p>}
                {searchResults.length > 0 && (
                  <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/60">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariation(result)
                          setSearchResults([])
                        }}
                        className="block w-full p-3 text-left hover:bg-white"
                      >
                        <p className="text-sm font-medium text-jokenia-dark">{result.variation_name}</p>
                        <p className="text-xs text-jokenia-tan">
                          {result.sku} · {result.product_type_name}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.trim() && !searching && searchResults.length === 0 && (
                  <p className="text-xs text-jokenia-tan">No variations found.</p>
                )}
              </>
            )}
            <Button
              disabled={!selectedVariation || loading}
              onClick={() => selectedVariation && handleApprove({ p_variation_id: selectedVariation.id })}
            >
              {loading ? 'Confirming…' : 'Confirm'}
            </Button>
          </>
        )}

        {activeTab === 'new' && (
          <>
            <div>
              <label className={labelClass}>Product type</label>
              <div className="flex flex-wrap gap-1.5">
                {(productTypes ?? []).map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setSelectedTypeId(type.id)
                      setSelectedStyleId(null)
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      selectedTypeId === type.id
                        ? 'border-jokenia-gold bg-jokenia-gold/20 text-jokenia-dark'
                        : 'border-jokenia-tan/30 bg-white text-jokenia-dark2 hover:bg-white/80'
                    }`}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedTypeId && (
              <>
                <div>
                  <label className={labelClass}>Style</label>
                  <div className="mb-2 flex gap-2">
                    {(['existing', 'new'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setStyleMode(mode)
                          setSelectedStyleId(null)
                        }}
                        className={`flex-1 rounded-md border py-1.5 text-xs font-medium ${
                          styleMode === mode
                            ? 'border-jokenia-gold bg-jokenia-gold/20 text-jokenia-dark'
                            : 'border-jokenia-tan/30 bg-white text-jokenia-dark2'
                        }`}
                      >
                        {mode === 'existing' ? 'Existing style' : 'New style'}
                      </button>
                    ))}
                  </div>
                  {styleMode === 'existing' ? (
                    stylesLoading ? (
                      <p className="text-xs text-jokenia-tan">Loading styles…</p>
                    ) : (styles ?? []).length === 0 ? (
                      <p className="text-xs italic text-jokenia-tan">
                        No styles for this type. Switch to &quot;New style&quot;.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(styles ?? []).map((style) => (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => setSelectedStyleId(style.id)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                              selectedStyleId === style.id
                                ? 'border-jokenia-gold bg-jokenia-gold/20 text-jokenia-dark'
                                : 'border-jokenia-tan/30 bg-white text-jokenia-dark2'
                            }`}
                          >
                            {style.name}
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    <input
                      className={inputClass}
                      value={newStyleName}
                      onChange={(event) => setNewStyleName(event.target.value)}
                      placeholder="e.g. Fitted, A-Line, Relaxed…"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Colour (optional)</label>
                    <input
                      className={inputClass}
                      value={newColour}
                      onChange={(event) => setNewColour(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Size (optional)</label>
                    <input
                      className={inputClass}
                      value={newSize}
                      onChange={(event) => setNewSize(event.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>External barcode (optional)</label>
                  <input
                    className={inputClass}
                    value={newBarcode}
                    onChange={(event) => setNewBarcode(event.target.value)}
                    placeholder="Consignee original barcode"
                  />
                </div>
              </>
            )}

            <Button
              disabled={!newConfirmEnabled || loading}
              onClick={() =>
                styleMode === 'existing'
                  ? handleApprove({
                      p_style_id: selectedStyleId!,
                      p_colour: newColour.trim() || null,
                      p_size: newSize.trim() || null,
                      p_external_barcode: newBarcode.trim() || null
                    })
                  : handleApprove({
                      p_product_type_id: selectedTypeId!,
                      p_style_name: newStyleName.trim() || null,
                      p_colour: newColour.trim() || null,
                      p_size: newSize.trim() || null,
                      p_external_barcode: newBarcode.trim() || null
                    })
              }
            >
              {loading ? 'Confirming…' : 'Confirm'}
            </Button>
          </>
        )}
      </div>

      {rejectVisible ? (
        <div className="mt-4 rounded-md border border-red-300 bg-white/60 p-3">
          <p className="font-heading text-sm font-semibold text-jokenia-dark">Reject Suggestion</p>
          <p className="mb-2 text-xs text-jokenia-tan">
            This will reject the suggestion and its parent batch. This cannot be undone.
          </p>
          <label className={labelClass}>Reason (required)</label>
          <textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Explain why this suggestion is being rejected…"
            rows={3}
            className={`${inputClass} mb-2`}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRejectVisible(false)
                setRejectReason('')
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleReject} disabled={!rejectReason.trim() || loading}>
              {loading ? 'Rejecting…' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRejectVisible(true)}
          disabled={loading}
          className="mt-4 w-full rounded-md border border-red-300 bg-red-50 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
        >
          Reject Suggestion
        </button>
      )}
    </Modal>
  )
}

export default SuggestionResolutionModal
