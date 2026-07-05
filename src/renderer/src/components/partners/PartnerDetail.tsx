import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import DispatchStockModal from './DispatchStockModal'
import RecordSaleModal from './RecordSaleModal'
import ReturnStockModal from './ReturnStockModal'
import SettleModal from './SettleModal'
import type { PartnerBalance, PartnerContact, PartnerReport, PartnerSoldItem, PartnerStockItem } from './types'

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// get_partner_detail is called directly (not via a wrapper) and returns a
// row-array, matching the admin app's own [id]/index.tsx fetcher exactly.
async function fetchContact(partnerId: string): Promise<PartnerContact> {
  const { data, error } = await supabase.rpc('get_partner_detail', { p_partner_id: partnerId })
  if (error) throw error
  const row = (data as PartnerContact[] | null)?.[0] ?? null
  if (!row) throw new Error('Partner not found.')
  return row
}

async function fetchBalance(partnerId: string): Promise<PartnerBalance> {
  const { data, error } = await supabase.rpc('get_partner_balance', { p_partner_id: partnerId })
  if (error) throw error
  return data as PartnerBalance
}

async function fetchStock(partnerId: string): Promise<PartnerStockItem[]> {
  const { data, error } = await supabase.rpc('get_partner_stock', { p_partner_id: partnerId })
  if (error) throw error
  return (data as { stock: PartnerStockItem[] }).stock
}

async function fetchSoldItems(partnerId: string): Promise<PartnerSoldItem[]> {
  const { data, error } = await supabase.rpc('get_partner_sold_items', { p_partner_id: partnerId })
  if (error) throw error
  return (data as { items: PartnerSoldItem[] }).items
}

async function fetchReport(partnerId: string): Promise<PartnerReport> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase.rpc('get_partner_report', {
    p_partner_id: partnerId,
    p_date_from: '2000-01-01',
    p_date_to: today
  })
  if (error) throw error
  return data as PartnerReport
}

interface PartnerDetailProps {
  partnerId: string
  onBack: () => void
}

function PartnerDetail({ partnerId, onBack }: PartnerDetailProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const isOnline = useAppStore((state) => state.isOnline)

  const contactQuery = useQuery({
    queryKey: ['partner-contact', partnerId],
    queryFn: () => fetchContact(partnerId)
  })
  const balanceQuery = useQuery({
    queryKey: ['partner-balance', partnerId],
    queryFn: () => fetchBalance(partnerId)
  })
  const stockQuery = useQuery({
    queryKey: ['partner-stock', partnerId],
    queryFn: () => fetchStock(partnerId)
  })
  const soldQuery = useQuery({
    queryKey: ['partner-sold', partnerId],
    queryFn: () => fetchSoldItems(partnerId)
  })
  const reportQuery = useQuery({
    queryKey: ['partner-report', partnerId],
    queryFn: () => fetchReport(partnerId)
  })

  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [recordSaleOpen, setRecordSaleOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)

  function invalidateAll(): void {
    queryClient.invalidateQueries({ queryKey: ['partner-balance', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partner-stock', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partner-stock-items', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partner-sold', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partner-report', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partner-report-for-settle', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partner-transferred-items', partnerId] })
    queryClient.invalidateQueries({ queryKey: ['partner-stock-for-sale', partnerId] })
  }

  const contact = contactQuery.data
  const balance = balanceQuery.data
  const stock = stockQuery.data ?? []
  const soldItems = soldQuery.data ?? []
  const settlements = reportQuery.data?.settlements ?? []
  const unsettledSold = soldItems.filter((item) => !item.is_settled)
  const settledSold = soldItems.filter((item) => item.is_settled)

  return (
    <div className="flex h-full flex-col p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to partners
      </button>

      <QueryState
        isLoading={contactQuery.isLoading}
        error={contactQuery.error as Error | null}
        isEmpty={!contact}
        emptyText="Partner not found."
        onRetry={contactQuery.refetch}
      >
        {contact && (
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold text-jokenia-dark">{contact.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    contact.is_active ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                  }`}
                >
                  {contact.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="font-mono text-xs text-jokenia-tan">{contact.partner_code}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs text-jokenia-dark2">
                <p>Contact: {contact.contact_person ?? '—'}</p>
                <p>Phone: {contact.phone ?? '—'}</p>
                <p>Email: {contact.email ?? '—'}</p>
                <p>Address: {contact.address ?? '—'}</p>
              </div>
            </div>

            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-800">
                {balance ? formatKes(balance.outstanding) : '—'}
              </p>
              <p className="text-xs text-amber-700">Outstanding — all time</p>
              {balance && (
                <div className="mt-1 space-y-0.5 text-[11px] text-amber-700">
                  {balance.stock_owed > 0 && <p>Stock at partner: {formatKes(balance.stock_owed)}</p>}
                  {balance.sales_owed > 0 && <p>Unsettled sales: {formatKes(balance.sales_owed)}</p>}
                  {balance.lost_owed > 0 && (
                    <p>Accepted liability (unsettled): {formatKes(balance.lost_owed)}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setDispatchOpen(true)}>Dispatch stock</Button>
              <Button onClick={() => setReturnOpen(true)}>Return stock</Button>
              <Button onClick={() => setRecordSaleOpen(true)}>Record sales</Button>
              <Button onClick={() => setSettleOpen(true)} variant="secondary">
                Settle
              </Button>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Current stock
              </p>
              <p className="mb-1 text-[11px] text-jokenia-tan">
                Selling price shown is the dispatch rate set by the business.
              </p>
              {stockQuery.isLoading ? (
                <p className="text-xs text-jokenia-tan">Loading…</p>
              ) : stock.length === 0 ? (
                <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                  No stock currently at this partner.
                </p>
              ) : (
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {stock.map((item) => (
                    <div key={item.variation_id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-jokenia-dark">
                          {item.product_type} — {item.variation_name}
                        </p>
                        <p className="text-xs text-jokenia-tan">{item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-jokenia-dark">{item.units_at_partner} units</p>
                        {item.selling_price != null && (
                          <p className="text-xs text-jokenia-tan">{formatKes(item.selling_price)}/unit</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Sold items — unsettled
              </p>
              {unsettledSold.length === 0 ? (
                <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                  None.
                </p>
              ) : (
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {unsettledSold.map((item) => (
                    <div key={item.item_id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-jokenia-dark">{item.serial_number}</p>
                        <p className="text-xs text-jokenia-tan">
                          {item.variation_name} · {formatDate(item.sale_date)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-jokenia-dark">{formatKes(item.amount_received)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Sold items — settled
              </p>
              {settledSold.length === 0 ? (
                <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                  None yet.
                </p>
              ) : (
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {settledSold.map((item) => (
                    <div key={item.item_id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-jokenia-dark">{item.serial_number}</p>
                        <p className="text-xs text-jokenia-tan">
                          {item.variation_name} · {formatDate(item.sale_date)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-jokenia-dark">{formatKes(item.amount_received)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {settlements.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                  Settlement history
                </p>
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {settlements.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2">
                      <p className="text-sm font-medium text-jokenia-dark">{formatDate(s.settlement_date)}</p>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-700">{formatKes(s.total_amount)}</p>
                        {s.notes && <p className="text-xs text-jokenia-tan">{s.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </QueryState>

      <DispatchStockModal
        partnerId={partnerId}
        isOpen={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
        onDispatched={() => {
          setDispatchOpen(false)
          invalidateAll()
        }}
      />
      <ReturnStockModal
        partnerId={partnerId}
        isOpen={returnOpen}
        onClose={() => setReturnOpen(false)}
        onReturned={() => {
          setReturnOpen(false)
          invalidateAll()
        }}
      />
      <RecordSaleModal
        partnerId={partnerId}
        isOpen={recordSaleOpen}
        onClose={() => setRecordSaleOpen(false)}
        onRecorded={() => {
          setRecordSaleOpen(false)
          invalidateAll()
        }}
      />
      <SettleModal
        partnerId={partnerId}
        isOpen={settleOpen}
        onClose={() => setSettleOpen(false)}
        onSettled={() => {
          setSettleOpen(false)
          invalidateAll()
        }}
      />

      {!isOnline && (
        <p className="mt-2 text-center text-xs text-red-500">
          Offline — Dispatch, Return, Record Sales and Settle are unavailable until reconnected.
        </p>
      )}
    </div>
  )
}

export default PartnerDetail
