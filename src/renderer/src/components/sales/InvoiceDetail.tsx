import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { statusBadgeClass } from '@/utils/statusBadge'
import type { PaymentMethodOption } from '@/types'
import type { InvoiceDetail as InvoiceDetailRow } from './types'

async function fetchInvoice(invoiceId: string): Promise<InvoiceDetailRow> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id,amount_due,due_date,status,settled_at,sale_id,ad_hoc_name,client_id')
    .eq('id', invoiceId)
    .single()
  if (error) throw error
  return data
}

const PAYMENT_METHODS: { id: PaymentMethodOption; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'mpesa', label: 'M-Pesa' }
]

interface InvoiceDetailProps {
  invoiceId: string
  onBack: () => void
  onViewSale: (saleId: string) => void
}

function InvoiceDetail({ invoiceId, onBack, onViewSale }: InvoiceDetailProps): React.JSX.Element {
  const isOnline = useAppStore((state) => state.isOnline)
  const queryClient = useQueryClient()

  const {
    data: invoice,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: () => fetchInvoice(invoiceId)
  })

  const [settleOpen, setSettleOpen] = useState(false)
  const [method, setMethod] = useState<PaymentMethodOption>('cash')
  const [reference, setReference] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error('Invoice not loaded.')
      const { error: rpcError } = await supabase.rpc('settle_invoice', {
        p_invoice_id: invoiceId,
        p_payments: [
          {
            method,
            amount: Number(invoice.amount_due),
            reference_number: reference.trim() || null
          }
        ]
      })
      if (rpcError) throw rpcError
    },
    onSuccess: () => {
      setSettleOpen(false)
      setReference('')
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    }
  })

  function handleOpenSettle(): void {
    setMethod('cash')
    setReference('')
    setFormError(null)
    setSettleOpen(true)
  }

  function handleSubmitSettle(): void {
    if (!isOnline) {
      setFormError('Settling an invoice requires an internet connection.')
      return
    }
    if (method === 'mpesa' && !reference.trim()) {
      setFormError('M-Pesa reference is required.')
      return
    }
    setFormError(null)
    settleMutation.mutate()
  }

  const canSettle = invoice ? invoice.status === 'pending' || invoice.status === 'overdue' : false

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to invoices
      </button>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={!invoice}
        emptyText="Invoice not found."
        onRetry={refetch}
      >
        {invoice && (
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <p className="font-heading text-2xl font-bold text-jokenia-dark">
                  KES {Number(invoice.amount_due).toLocaleString()}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(invoice.status)}`}
                >
                  {invoice.status}
                </span>
              </div>
              <p className="text-xs text-jokenia-tan">
                Due: {new Date(invoice.due_date).toLocaleDateString('en-KE')}
              </p>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Details
              </p>
              <div className="space-y-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-jokenia-dark2">Client</span>
                  <span className="text-jokenia-dark">
                    {invoice.ad_hoc_name ?? 'Business client'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-jokenia-dark2">Status</span>
                  <span className="capitalize text-jokenia-dark">{invoice.status}</span>
                </div>
                {invoice.settled_at && (
                  <div className="flex justify-between">
                    <span className="text-jokenia-dark2">Settled at</span>
                    <span className="text-jokenia-dark">
                      {new Date(invoice.settled_at).toLocaleString('en-KE')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {invoice.sale_id && (
              <Button
                variant="ghost"
                onClick={() => onViewSale(invoice.sale_id!)}
                className="w-full"
              >
                View Linked Sale
              </Button>
            )}

            {!isOnline && canSettle && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                Settling an invoice requires an internet connection.
              </p>
            )}

            {canSettle && (
              <Button onClick={handleOpenSettle} className="w-full">
                Mark as Settled
              </Button>
            )}
          </div>
        )}
      </QueryState>

      <Modal title="Settle invoice" isOpen={settleOpen} onClose={() => setSettleOpen(false)}>
        <div className="space-y-3">
          {invoice && (
            <p className="text-center text-sm text-jokenia-dark2">
              Amount due:{' '}
              <span className="font-semibold text-jokenia-dark">
                KES {Number(invoice.amount_due).toLocaleString()}
              </span>
            </p>
          )}

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
              Payment method
            </p>
            <div className="flex gap-1 rounded-md bg-white/50 p-1">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setMethod(pm.id)}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                    method === pm.id
                      ? 'bg-jokenia-dark text-jokenia-cream'
                      : 'text-jokenia-dark2 hover:bg-white'
                  }`}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>

          {(method === 'mpesa' || method === 'card') && (
            <input
              type="text"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder={method === 'mpesa' ? 'M-Pesa transaction code' : 'Card approval code'}
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
            />
          )}

          {(formError || settleMutation.error) && (
            <p className="text-xs text-red-500">
              {formError ?? (settleMutation.error as Error).message}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSettleOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitSettle}
              disabled={settleMutation.isPending || !isOnline}
              className="flex-1"
            >
              {settleMutation.isPending ? 'Settling…' : 'Settle'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default InvoiceDetail
