import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import { statusBadgeClass } from '@/utils/statusBadge'
import { printReceipt } from '@/utils/receipt'
import type { SaleDetail as SaleDetailRow, ReceiptDataResponse } from './types'

async function fetchSaleDetail(saleId: string): Promise<SaleDetailRow> {
  const { data, error } = await supabase
    .from('sales')
    .select(
      `
      id, sale_type, sale_channel, gross_amount, discount_amount, net_amount,
      is_invoiced, is_manual, manual_description, ad_hoc_client_name, customer_email, created_at,
      sold_by ( full_name ),
      sale_items (
        id, unit_price, discount_amount, line_total,
        items (
          id, serial_number, status,
          product_variations ( name, sku, product_types ( name ) )
        )
      ),
      sale_payments ( id, payment_method, amount, reference_number ),
      invoices!sale_id ( id )
    `
    )
    .eq('id', saleId)
    .single()
  if (error) throw error
  return data as unknown as SaleDetailRow
}

// get_receipt_data is the same RPC the admin app's sales/[id].tsx uses for its
// view/download-receipt actions — reused here so reprint reflects the exact
// stored sale rather than a hand-reconstructed approximation.
async function fetchReceiptData(saleId: string): Promise<ReceiptDataResponse> {
  const { data, error } = await supabase.rpc('get_receipt_data', { p_sale_id: saleId })
  if (error) throw error
  return data as ReceiptDataResponse
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true })
  )
}

function formatKes(amount: number): string {
  return `KES ${Number(amount).toLocaleString()}`
}

const PM_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', mpesa: 'M-Pesa' }

interface SaleDetailProps {
  saleId: string
  onBack: () => void
  onViewInvoice: (invoiceId: string) => void
}

function SaleDetail({ saleId, onBack, onViewInvoice }: SaleDetailProps): React.JSX.Element {
  const {
    data: sale,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['sale-detail', saleId],
    queryFn: () => fetchSaleDetail(saleId)
  })

  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  async function handleReprint(): Promise<void> {
    setPrintError(null)
    setPrinting(true)
    try {
      const receipt = await fetchReceiptData(saleId)
      await printReceipt({
        saleId: receipt.sale_id,
        items: receipt.items.map((item) => ({
          name: `${item.product_type} / ${item.variation_name}`,
          sku: item.sku,
          quantity: 1,
          unitPrice: item.unit_price,
          discountType: item.discount_amount > 0 ? 'fixed' : null,
          discountValue: item.discount_amount > 0 ? item.discount_amount : null
        })),
        payments: receipt.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          reference: p.reference_number
        })),
        total: receipt.net_amount,
        customerEmail: receipt.client_name ?? receipt.customer_email,
        saleDate: new Date(receipt.created_at).toLocaleDateString('en-KE', { dateStyle: 'full' }),
        channel: receipt.sale_type
      })
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : 'Failed to reprint receipt.')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to sales
      </button>

      <QueryState
        isLoading={isLoading}
        error={error as Error | null}
        isEmpty={!sale}
        emptyText="Sale not found."
        onRetry={refetch}
      >
        {sale && (
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <p className="font-heading text-2xl font-bold text-jokenia-dark">
                  {formatKes(sale.net_amount)}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(sale.sale_type)}`}
                >
                  {sale.sale_type}
                </span>
              </div>
              <p className="text-xs text-jokenia-tan">{formatDateTime(sale.created_at)}</p>
              <p className="text-xs text-jokenia-dark2">
                Processed by {sale.sold_by?.full_name ?? 'Unknown'}
                {sale.sale_channel ? ` · ${sale.sale_channel.replace('_', ' ')}` : ''}
              </p>
              {sale.ad_hoc_client_name && (
                <p className="text-xs text-jokenia-dark2">Client: {sale.ad_hoc_client_name}</p>
              )}
              {sale.is_manual && sale.manual_description && (
                <p className="text-xs text-jokenia-dark2">{sale.manual_description}</p>
              )}
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Summary
              </p>
              <div className="space-y-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-jokenia-dark2">Gross amount</span>
                  <span className="text-jokenia-dark">{formatKes(sale.gross_amount)}</span>
                </div>
                {sale.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-jokenia-dark2">Discount</span>
                    <span className="text-red-600">− {formatKes(sale.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span className="text-jokenia-dark2">Net amount</span>
                  <span className="text-jokenia-dark">{formatKes(sale.net_amount)}</span>
                </div>
              </div>
            </div>

            {sale.is_invoiced && sale.invoices?.[0]?.id && (
              <button
                type="button"
                onClick={() => onViewInvoice(sale.invoices[0].id)}
                className="flex w-full items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                View Invoice
                <span>›</span>
              </button>
            )}

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Items ({sale.sale_items?.length ?? 0})
              </p>
              {!sale.sale_items || sale.sale_items.length === 0 ? (
                <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                  {sale.is_manual ? 'Manual sale — no inventory items.' : 'No serialised items.'}
                </p>
              ) : (
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {sale.sale_items.map((si) => (
                    <div key={si.id} className="flex items-start justify-between px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-jokenia-dark">
                          {si.items?.serial_number ?? '—'}
                        </p>
                        <p className="text-xs text-jokenia-tan">
                          {si.items?.product_variations?.product_types?.name ?? 'Unknown'} —{' '}
                          {si.items?.product_variations?.name ?? 'Unknown'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-jokenia-dark2">{formatKes(si.unit_price)}</p>
                        {si.discount_amount > 0 && (
                          <p className="text-xs text-red-600">− {formatKes(si.discount_amount)}</p>
                        )}
                        <p className="text-sm font-semibold text-jokenia-dark">
                          {formatKes(si.line_total)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {sale.is_invoiced ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
                Payment is deferred via invoice. No payment entries are recorded until the invoice
                is settled.
              </div>
            ) : (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                  Payments ({sale.sale_payments?.length ?? 0})
                </p>
                {!sale.sale_payments || sale.sale_payments.length === 0 ? (
                  <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                    No payment records.
                  </p>
                ) : (
                  <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                    {sale.sale_payments.map((pmt) => (
                      <div key={pmt.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-jokenia-dark">
                            {PM_LABEL[pmt.payment_method] ?? pmt.payment_method}
                          </p>
                          {pmt.reference_number && (
                            <p className="text-xs text-jokenia-tan">Ref: {pmt.reference_number}</p>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-jokenia-dark">
                          {formatKes(pmt.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Button onClick={() => void handleReprint()} disabled={printing} className="w-full">
                {printing ? 'Printing…' : 'Reprint receipt'}
              </Button>
              {printError && <p className="text-center text-xs text-red-500">{printError}</p>}
            </div>
          </div>
        )}
      </QueryState>
    </div>
  )
}

export default SaleDetail
