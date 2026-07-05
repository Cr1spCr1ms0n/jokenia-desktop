import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { BrandingClientOption, StyleOption } from './types'

interface ProductTypeContext {
  id: string
  name: string
  type_code: string | null
}

interface StyleBasedResult {
  variation_id: string
  barcode: string
  var_seq: number
  sku: string
}

interface ManualResult {
  variation_id: string
  barcode: string
  var_seq: number
}

// Client-side approximation of the server's derive_code(input, 3) — used
// only to preview a SKU before the server confirms the real one.
function deriveCode(input: string): string {
  const letters = input.replace(/[^a-zA-Z]/g, '').toUpperCase()
  if (!letters) return 'XXX'
  const vowels = new Set(['A', 'E', 'I', 'O', 'U'])
  const consonants = [...letters].filter((c) => !vowels.has(c))
  if (consonants.length >= 3) return consonants.slice(0, 3).join('')
  const vowelChars = [...letters].filter((c) => vowels.has(c))
  const result = [...consonants, ...vowelChars]
  while (result.length < 3) result.push('X')
  return result.slice(0, 3).join('')
}

async function fetchStyles(productTypeId: string): Promise<StyleOption[]> {
  const { data, error } = await supabase
    .from('product_styles')
    .select('id, name, style_code, style_seq')
    .eq('product_type_id', productTypeId)
    .order('style_seq')
  if (error) throw error
  return (data ?? []) as StyleOption[]
}

async function fetchActiveClients(): Promise<BrandingClientOption[]> {
  const { data, error } = await supabase
    .from('business_clients')
    .select('id, name, client_seq')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as BrandingClientOption[]
}

interface CreateVariationModalProps {
  productType: ProductTypeContext
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

// Mode is derived automatically, not a user toggle — style-based when the
// type has ≥1 style, manual otherwise. Matches the admin app's
// create-variation.tsx exactly, including its trouser/colour+size attribute
// heuristic. The consignee picker is always shown (not gated on a
// `product_types.branding_client_id` lock) — that column does not exist
// live, confirmed by a direct query; the admin app's own enrichment query
// for it silently fails and falls back to null, so its "locked" picker
// state is unreachable in practice too — matching real behavior, not the
// admin app's broken assumption.
function CreateVariationModal({
  productType,
  isOpen,
  onClose,
  onCreated
}: CreateVariationModalProps): React.JSX.Element {
  const stylesQuery = useQuery({
    queryKey: ['product-styles', productType.id],
    queryFn: () => fetchStyles(productType.id),
    enabled: isOpen
  })
  const clientsQuery = useQuery({
    queryKey: ['branding-clients'],
    queryFn: fetchActiveClients,
    enabled: isOpen
  })

  const styles = stylesQuery.data ?? []
  const clients = clientsQuery.data ?? []
  const mode: 'style-based' | 'manual' = styles.length > 0 ? 'style-based' : 'manual'
  const isTrouserLike = /trouser|jean|pant|shorts/i.test(productType.name)

  const [styleId, setStyleId] = useState('')
  const [colour, setColour] = useState('')
  const [size, setSize] = useState('')
  const [waistSize, setWaistSize] = useState('')
  const [inseam, setInseam] = useState('')
  const [lengthLabel, setLengthLabel] = useState<'SRT' | 'REG' | 'LNG' | ''>('')

  const [manualName, setManualName] = useState('')
  const [manualSku, setManualSku] = useState('')
  const skuEdited = useRef(false)

  const [price, setPrice] = useState('')
  const [externalBarcode, setExternalBarcode] = useState('')
  const [brandingClientId, setBrandingClientId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successSku, setSuccessSku] = useState<string | null>(null)

  useEffect(() => {
    if (!skuEdited.current && manualName.trim().length > 0) {
      setManualSku(`${deriveCode(productType.name)}-${deriveCode(manualName)}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualName])

  const selectedStyle = styles.find((s) => s.id === styleId) ?? null
  const skuPreview = selectedStyle
    ? [
        productType.type_code,
        selectedStyle.style_code,
        colour.trim()
          ? deriveCode(colour.trim())
          : size.trim()
            ? size.trim().toUpperCase().slice(0, 4)
            : waistSize
              ? `W${waistSize}`
              : inseam
                ? `L${inseam}`
                : null
      ]
        .filter(Boolean)
        .join('-')
    : null

  const styleBasedMutation = useMutation({
    mutationFn: async (): Promise<StyleBasedResult> => {
      const { data, error } = await supabase.rpc('create_variation', {
        p_style_id: styleId,
        p_colour: colour.trim() || null,
        p_size: size.trim() || null,
        p_waist_size: waistSize ? parseInt(waistSize, 10) : null,
        p_inseam: inseam ? parseInt(inseam, 10) : null,
        p_length_label: lengthLabel || null,
        p_price: parseFloat(price),
        p_branding_client_id: brandingClientId,
        p_external_barcode: externalBarcode.trim() || null
      })
      if (error) throw error
      return (data as StyleBasedResult[])[0]
    },
    onSuccess: (result) => {
      setSuccessSku(result.sku)
      setTimeout(() => {
        resetForm()
        onCreated()
      }, 1500)
    }
  })

  const manualMutation = useMutation({
    mutationFn: async (): Promise<ManualResult> => {
      const { data, error } = await supabase.rpc('create_variation', {
        p_product_type_id: productType.id,
        p_name: manualName.trim(),
        p_sku: manualSku.trim(),
        p_price: parseFloat(price),
        p_branding_client_id: brandingClientId,
        p_external_barcode: externalBarcode.trim() || null
      })
      if (error) throw error
      return (data as ManualResult[])[0]
    },
    onSuccess: () => {
      resetForm()
      onCreated()
    }
  })

  function resetForm(): void {
    setStyleId('')
    setColour('')
    setSize('')
    setWaistSize('')
    setInseam('')
    setLengthLabel('')
    setManualName('')
    setManualSku('')
    skuEdited.current = false
    setPrice('')
    setExternalBarcode('')
    setBrandingClientId(null)
    setSuccessSku(null)
  }

  function handleSubmit(): void {
    const parsedPrice = parseFloat(price)
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError('Enter a valid price greater than 0.')
      return
    }
    if (mode === 'style-based') {
      if (!styleId) {
        setFormError('Select a style.')
        return
      }
      if (!isTrouserLike && !colour.trim() && !size.trim()) {
        setFormError('At least one attribute (colour or size) is required.')
        return
      }
      if (isTrouserLike && !waistSize && !inseam) {
        setFormError('Waist and/or inseam is required for this product type.')
        return
      }
      setFormError(null)
      styleBasedMutation.mutate()
    } else {
      if (!manualName.trim()) {
        setFormError('Variation name is required.')
        return
      }
      if (!manualSku.trim()) {
        setFormError('SKU is required.')
        return
      }
      setFormError(null)
      manualMutation.mutate()
    }
  }

  const pending = styleBasedMutation.isPending || manualMutation.isPending
  const error = styleBasedMutation.error ?? manualMutation.error

  return (
    <Modal title="Create variation" isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-md">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        <p className="text-xs italic text-jokenia-tan">
          {mode === 'style-based' ? 'Style-based mode' : 'Simple mode'} · {productType.name}
        </p>

        {(formError || error) && (
          <p className="text-xs text-red-500">{formError ?? (error as Error).message}</p>
        )}

        {mode === 'style-based' ? (
          <>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">Style</p>
              <select
                value={styleId}
                onChange={(event) => setStyleId(event.target.value)}
                className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
              >
                <option value="">Select a style…</option>
                {styles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name} ({style.style_code})
                  </option>
                ))}
              </select>
            </div>

            {isTrouserLike ? (
              <>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={waistSize}
                    onChange={(event) => setWaistSize(event.target.value)}
                    placeholder="Waist (inches)"
                    className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                  />
                  <input
                    type="number"
                    value={inseam}
                    onChange={(event) => setInseam(event.target.value)}
                    placeholder="Inseam (inches)"
                    className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  {(['SRT', 'REG', 'LNG'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setLengthLabel((prev) => (prev === v ? '' : v))}
                      className={`flex-1 rounded-md border py-2 text-xs font-semibold ${
                        lengthLabel === v
                          ? 'border-jokenia-gold bg-jokenia-cream2 text-jokenia-dark'
                          : 'border-jokenia-tan/30 bg-white text-jokenia-tan'
                      }`}
                    >
                      {v === 'SRT' ? 'Short' : v === 'REG' ? 'Regular' : 'Long'}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={colour}
                  onChange={(event) => setColour(event.target.value)}
                  placeholder="Colour (optional)"
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                />
                <input
                  type="text"
                  value={size}
                  onChange={(event) => setSize(event.target.value)}
                  placeholder="Size (optional)"
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                />
              </div>
            )}

            {skuPreview && (
              <div className="rounded-md border border-jokenia-gold/40 bg-jokenia-cream2 px-3 py-2">
                <p className="text-[9px] font-bold uppercase tracking-wide text-jokenia-tan">
                  Auto-generated SKU
                </p>
                <p className="font-mono text-sm font-bold text-jokenia-dark">{skuPreview}</p>
                <p className="text-[10px] italic text-jokenia-tan">Final SKU confirmed on save</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Variation name
              </p>
              <input
                type="text"
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="e.g. Black, Red Medium"
                className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                SKU (auto-suggested — you can edit)
              </p>
              <input
                type="text"
                value={manualSku}
                onChange={(event) => {
                  skuEdited.current = true
                  setManualSku(event.target.value)
                }}
                placeholder={`${deriveCode(productType.name)}-XXX`}
                className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 font-mono text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
              />
              <p className="mt-1 text-[11px] italic text-jokenia-tan">Must be unique across all products</p>
            </div>
          </>
        )}

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">Price (KES)</p>
          <input
            type="number"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="e.g. 3000"
            min={0}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            External barcode (optional)
          </p>
          <input
            type="text"
            value={externalBarcode}
            onChange={(event) => setExternalBarcode(event.target.value)}
            placeholder="Consignee original barcode"
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Consignee branding (optional)
          </p>
          <select
            value={brandingClientId ?? ''}
            onChange={(event) => setBrandingClientId(event.target.value || null)}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          >
            <option value="">None</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} · C{String(client.client_seq).padStart(3, '0')}
              </option>
            ))}
          </select>
        </div>

        {successSku && (
          <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
            Variation created · SKU: {successSku}
          </p>
        )}

        {!successSku && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={pending} className="flex-1">
              {pending ? 'Creating…' : 'Create variation'}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default CreateVariationModal
