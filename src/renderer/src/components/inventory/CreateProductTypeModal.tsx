import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { BrandingClientOption } from './types'

interface CreateProductTypeResult {
  product_type_id: string
  variation_id: string | null
  barcode: string | null
  type_seq: number
  var_seq: number | null
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

interface CreateProductTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (result: CreateProductTypeResult) => void
}

// SKU is never client-supplied — always server-generated (derive_code on the
// product name → type_code). Flow B (has_variations=false) creates a single
// "Standard" variation server-side using the given price, matching the admin
// app's create.tsx exactly.
function CreateProductTypeModal({
  isOpen,
  onClose,
  onCreated
}: CreateProductTypeModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [hasVariations, setHasVariations] = useState(true)
  const [price, setPrice] = useState('')
  const [externalBarcode, setExternalBarcode] = useState('')
  const [brandingClientId, setBrandingClientId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const clientsQuery = useQuery({
    queryKey: ['branding-clients'],
    queryFn: fetchActiveClients,
    enabled: isOpen
  })
  const clients = clientsQuery.data ?? []
  const selectedClient = clients.find((c) => c.id === brandingClientId) ?? null

  const createMutation = useMutation({
    mutationFn: async (): Promise<CreateProductTypeResult> => {
      const { data, error } = await supabase.rpc('create_product_type', {
        p_name: name.trim(),
        p_has_variations: hasVariations,
        p_sku: null,
        p_price: hasVariations ? null : parseFloat(price),
        p_branding_client_id: brandingClientId,
        p_external_barcode: hasVariations ? null : externalBarcode.trim() || null
      })
      if (error) throw error
      return (data as CreateProductTypeResult[])[0]
    },
    onSuccess: (result) => {
      setName('')
      setPrice('')
      setExternalBarcode('')
      setBrandingClientId(null)
      onCreated(result)
    }
  })

  function handleSubmit(): void {
    if (!name.trim()) {
      setFormError('Product type name is required.')
      return
    }
    if (!hasVariations) {
      const parsed = parseFloat(price)
      if (isNaN(parsed) || parsed <= 0) {
        setFormError('Enter a valid price greater than 0.')
        return
      }
    }
    setFormError(null)
    createMutation.mutate()
  }

  return (
    <Modal title="Create product type" isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-md">
      <div className="space-y-3">
        {(formError || createMutation.error) && (
          <p className="text-xs text-red-500">{formError ?? (createMutation.error as Error).message}</p>
        )}

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Product type name
          </p>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Dress, Hoodie, Bag"
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
          <div>
            <p className="text-sm font-medium text-jokenia-dark">Has variations</p>
            <p className="text-xs text-jokenia-tan">
              {hasVariations
                ? 'Add styles and variations after creating'
                : 'A single Standard variation is created with the price below'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHasVariations((prev) => !prev)}
            className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
              hasVariations ? 'bg-jokenia-dark' : 'bg-jokenia-tan/30'
            }`}
          >
            <span
              className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${
                hasVariations ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {!hasVariations && (
          <>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Price (KES)
              </p>
              <input
                type="number"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="e.g. 2500"
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
              <p className="mt-1 text-[11px] italic text-jokenia-tan">
                SKU is auto-generated from the product name
              </p>
            </div>
          </>
        )}

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Consignee product (optional)
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
          {selectedClient && (
            <p className="mt-1 text-[11px] text-jokenia-tan">
              Branded to {selectedClient.name}
            </p>
          )}
        </div>

        {hasVariations && (
          <p className="rounded-md border border-jokenia-gold/30 bg-jokenia-cream2 px-3 py-2 text-[11px] text-jokenia-dark2">
            After creating, add styles then variations from the Product Types tab.
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} className="flex-1">
            {createMutation.isPending ? 'Creating…' : 'Create product type'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CreateProductTypeModal
