import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import CreateProductTypeModal from './CreateProductTypeModal'
import CreateVariationModal from './CreateVariationModal'
import type { ProductTypeRow, StyleOption, TypeVariationRow } from './types'

// product_types has no branding_client_id column live (confirmed — the
// admin app's own create-variation.tsx enrichment query for this same
// column silently fails and falls back to null, so its consignee picker is
// always shown in practice; CreateVariationModal matches that real
// behavior rather than the admin app's broken assumption).
async function fetchProductTypes(): Promise<ProductTypeRow[]> {
  const { data, error } = await supabase
    .from('product_types')
    .select('id, name, type_code, type_seq, has_variations')
    .order('type_seq')
  if (error) throw error
  return (data ?? []) as ProductTypeRow[]
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

async function fetchVariations(productTypeId: string): Promise<TypeVariationRow[]> {
  const { data, error } = await supabase
    .from('product_variations')
    .select('id, name, sku, colour, size, waist_size, inseam, style_id')
    .eq('product_type_id', productTypeId)
    .order('name')
  if (error) throw error
  return (data ?? []) as TypeVariationRow[]
}

function ExpandedTypeRow({ type }: { type: ProductTypeRow }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [addStyleOpen, setAddStyleOpen] = useState(false)
  const [styleName, setStyleName] = useState('')
  const [addVariationOpen, setAddVariationOpen] = useState(false)

  const stylesQuery = useQuery({
    queryKey: ['product-styles', type.id],
    queryFn: () => fetchStyles(type.id)
  })
  const variationsQuery = useQuery({
    queryKey: ['type-variations', type.id],
    queryFn: () => fetchVariations(type.id)
  })

  function invalidate(): void {
    queryClient.invalidateQueries({ queryKey: ['product-types'] })
    queryClient.invalidateQueries({ queryKey: ['product-styles', type.id] })
    queryClient.invalidateQueries({ queryKey: ['type-variations', type.id] })
  }

  const addStyleMutation = useMutation({
    mutationFn: async (): Promise<{ style_code: string }> => {
      const { data, error } = await supabase.rpc('create_style', {
        p_product_type_id: type.id,
        p_name: styleName.trim()
      })
      if (error) throw error
      return (data as Array<{ style_id: string; style_code: string; style_seq: number }>)[0]
    },
    onSuccess: () => {
      setStyleName('')
      setAddStyleOpen(false)
      invalidate()
    }
  })

  const convertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('convert_to_variations', { p_product_type_id: type.id })
      if (error) throw error
    },
    onSuccess: () => invalidate()
  })

  const styles = stylesQuery.data ?? []
  const variations = variationsQuery.data ?? []

  return (
    <div className="border-t border-jokenia-tan/10 bg-jokenia-cream2/50 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {type.has_variations ? (
          <>
            <Button onClick={() => setAddVariationOpen(true)}>+ Add variation</Button>
            <Button variant="secondary" onClick={() => setAddStyleOpen(true)}>
              + Add style
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
          >
            {convertMutation.isPending ? 'Converting…' : 'Convert to variations'}
          </Button>
        )}
      </div>
      {convertMutation.error && (
        <p className="mb-2 text-xs text-red-500">{(convertMutation.error as Error).message}</p>
      )}

      {styles.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">Styles</p>
          <div className="flex flex-wrap gap-1.5">
            {styles.map((style) => (
              <span
                key={style.id}
                className="rounded-full border border-jokenia-tan/30 bg-white px-2 py-0.5 text-xs text-jokenia-dark2"
              >
                {style.name} <span className="text-jokenia-tan">· {style.style_code}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
          Variations ({variations.length})
        </p>
        {variations.length === 0 ? (
          <p className="text-xs text-jokenia-tan">No variations yet.</p>
        ) : (
          <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white">
            {variations.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-3 py-1.5">
                <p className="text-sm text-jokenia-dark">{v.name}</p>
                <p className="font-mono text-xs text-jokenia-tan">{v.sku}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        title="Add style"
        isOpen={addStyleOpen}
        onClose={() => {
          if (!addStyleMutation.isPending) {
            setAddStyleOpen(false)
            setStyleName('')
          }
        }}
      >
        <div className="space-y-2">
          {addStyleMutation.error && (
            <p className="text-xs text-red-500">{(addStyleMutation.error as Error).message}</p>
          )}
          <input
            type="text"
            value={styleName}
            onChange={(event) => setStyleName(event.target.value)}
            placeholder='e.g. "Fitted", "A-Line"'
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAddStyleOpen(false)
                setStyleName('')
              }}
              disabled={addStyleMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addStyleMutation.mutate()}
              disabled={!styleName.trim() || addStyleMutation.isPending}
              className="flex-1"
            >
              {addStyleMutation.isPending ? 'Creating…' : 'Create style'}
            </Button>
          </div>
        </div>
      </Modal>

      <CreateVariationModal
        productType={type}
        isOpen={addVariationOpen}
        onClose={() => setAddVariationOpen(false)}
        onCreated={() => {
          setAddVariationOpen(false)
          invalidate()
        }}
      />
    </div>
  )
}

function ProductTypesTab(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [createTypeOpen, setCreateTypeOpen] = useState(false)

  const typesQuery = useQuery({ queryKey: ['product-types'], queryFn: fetchProductTypes })
  const types = typesQuery.data ?? []

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreateTypeOpen(true)}>+ New product type</Button>
      </div>

      <QueryState
        isLoading={typesQuery.isLoading}
        error={typesQuery.error as Error | null}
        isEmpty={types.length === 0}
        emptyText="No product types yet — create the first one."
        onRetry={typesQuery.refetch}
      >
        <div className="flex-1 overflow-y-auto rounded-md border border-jokenia-tan/20">
          {types.map((type) => (
            <div key={type.id}>
              <button
                type="button"
                onClick={() => setExpandedId((prev) => (prev === type.id ? null : type.id))}
                className="flex w-full items-center justify-between border-t border-jokenia-tan/10 bg-white/70 px-3 py-2 text-left first:border-t-0 hover:bg-white"
              >
                <div>
                  <p className="text-sm font-medium text-jokenia-dark">{type.name}</p>
                  <p className="text-xs text-jokenia-tan">
                    {type.type_code ?? '—'} · {type.has_variations ? 'Has variations' : 'Standard'}
                  </p>
                </div>
                <span className="text-xs text-jokenia-tan">
                  {expandedId === type.id ? '▲' : '▼'}
                </span>
              </button>
              {expandedId === type.id && <ExpandedTypeRow type={type} />}
            </div>
          ))}
        </div>
      </QueryState>

      <CreateProductTypeModal
        isOpen={createTypeOpen}
        onClose={() => setCreateTypeOpen(false)}
        onCreated={(result) => {
          setCreateTypeOpen(false)
          queryClient.invalidateQueries({ queryKey: ['product-types'] })
          setExpandedId(result.product_type_id)
        }}
      />
    </div>
  )
}

export default ProductTypesTab
