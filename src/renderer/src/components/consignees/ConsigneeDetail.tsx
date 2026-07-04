import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import QueryState from '@/components/ui/QueryState'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import ReceiveStockModal from './ReceiveStockModal'
import SettleModal from './SettleModal'
import type {
  ConsigneeBalance,
  ConsigneeCareItem,
  ConsigneeContact,
  ConsigneeSerializedItem,
  ConsigneeSoldItem,
  ConsigneeStockSummary
} from './types'

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function fetchContact(clientId: string): Promise<ConsigneeContact> {
  const { data, error } = await supabase
    .from('business_clients')
    .select('id, name, client_seq, is_active, contact_person, phone, email, address')
    .eq('id', clientId)
    .single()
  if (error) throw error
  return data as ConsigneeContact
}

async function fetchBalance(clientId: string): Promise<ConsigneeBalance> {
  const { data, error } = await supabase.rpc('get_consignee_balance', { p_client_id: clientId })
  if (error) throw error
  return data as ConsigneeBalance
}

async function fetchStockSummary(clientId: string): Promise<ConsigneeStockSummary[]> {
  const { data, error } = await supabase.rpc('get_consignee_stock', { p_client_id: clientId })
  if (error) throw error
  return (data as { stock: ConsigneeStockSummary[] }).stock
}

async function fetchStockItems(clientId: string): Promise<ConsigneeSerializedItem[]> {
  const { data, error } = await supabase.rpc('get_consignee_stock_items', { p_client_id: clientId })
  if (error) throw error
  return (data as { items: ConsigneeSerializedItem[] }).items
}

async function fetchSoldItems(clientId: string): Promise<ConsigneeSoldItem[]> {
  const { data, error } = await supabase.rpc('get_consignee_sold_items', { p_client_id: clientId })
  if (error) throw error
  return (data as { items: ConsigneeSoldItem[] }).items
}

async function fetchCareItems(clientId: string): Promise<ConsigneeCareItem[]> {
  const { data, error } = await supabase.rpc('get_all_consignee_lost_items')
  if (error) throw error
  const rows = (data as { items: Array<ConsigneeCareItem & { client_id: string }> }).items
  return rows.filter((row) => row.client_id === clientId)
}

interface ConsigneeDetailProps {
  clientId: string
  onBack: () => void
}

function ConsigneeDetail({ clientId, onBack }: ConsigneeDetailProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const isOnline = useAppStore((state) => state.isOnline)

  const contactQuery = useQuery({
    queryKey: ['consignee-contact', clientId],
    queryFn: () => fetchContact(clientId)
  })
  const balanceQuery = useQuery({
    queryKey: ['consignee-balance', clientId],
    queryFn: () => fetchBalance(clientId)
  })
  const stockQuery = useQuery({
    queryKey: ['consignee-stock', clientId],
    queryFn: () => fetchStockSummary(clientId)
  })
  const stockItemsQuery = useQuery({
    queryKey: ['consignee-stock-items', clientId],
    queryFn: () => fetchStockItems(clientId)
  })
  const soldQuery = useQuery({
    queryKey: ['consignee-sold', clientId],
    queryFn: () => fetchSoldItems(clientId)
  })
  const careQuery = useQuery({
    queryKey: ['consignee-care', clientId],
    queryFn: () => fetchCareItems(clientId)
  })

  const [priceEditItem, setPriceEditItem] = useState<ConsigneeStockSummary | null>(null)
  const [priceEditValue, setPriceEditValue] = useState('')
  const [careItem, setCareItem] = useState<ConsigneeSerializedItem | null>(null)
  const [careNotes, setCareNotes] = useState('')
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)

  function invalidateAll(): void {
    queryClient.invalidateQueries({ queryKey: ['consignee-balance', clientId] })
    queryClient.invalidateQueries({ queryKey: ['consignee-stock', clientId] })
    queryClient.invalidateQueries({ queryKey: ['consignee-stock-items', clientId] })
    queryClient.invalidateQueries({ queryKey: ['consignee-sold', clientId] })
    queryClient.invalidateQueries({ queryKey: ['consignee-care', clientId] })
  }

  const priceMutation = useMutation({
    mutationFn: async () => {
      if (!priceEditItem) return
      const newPrice = parseFloat(priceEditValue)
      const { error } = await supabase.rpc('update_consignee_batch_price', {
        p_batch_line_id: priceEditItem.batch_line_id,
        p_new_price: newPrice
      })
      if (error) throw error
    },
    onSuccess: () => {
      setPriceEditItem(null)
      setPriceEditValue('')
      queryClient.invalidateQueries({ queryKey: ['consignee-stock', clientId] })
    }
  })

  const careMutation = useMutation({
    mutationFn: async () => {
      if (!careItem) return
      const { error } = await supabase.rpc('record_consignee_loss', {
        p_item_id: careItem.item_id,
        p_notes: careNotes.trim() || null
      })
      if (error) throw error
    },
    onSuccess: () => {
      setCareItem(null)
      setCareNotes('')
      queryClient.invalidateQueries({ queryKey: ['consignee-stock-items', clientId] })
      queryClient.invalidateQueries({ queryKey: ['consignee-care', clientId] })
      queryClient.invalidateQueries({ queryKey: ['consignee-balance', clientId] })
    }
  })

  const contact = contactQuery.data
  const balance = balanceQuery.data
  const stock = stockQuery.data ?? []
  const stockItems = stockItemsQuery.data ?? []
  const soldItems = soldQuery.data ?? []
  const careItems = careQuery.data ?? []
  const unsettledSold = soldItems.filter((item) => !item.is_settled)
  const settledSold = soldItems.filter((item) => item.is_settled)

  return (
    <div className="flex h-full flex-col p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to consignees
      </button>

      <QueryState
        isLoading={contactQuery.isLoading}
        error={contactQuery.error as Error | null}
        isEmpty={!contact}
        emptyText="Consignee not found."
        onRetry={contactQuery.refetch}
      >
        {contact && (
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-1 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-semibold text-jokenia-dark">
                  {contact.name}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    contact.is_active ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                  }`}
                >
                  {contact.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="font-mono text-xs text-jokenia-tan">
                C{String(contact.client_seq).padStart(3, '0')}
              </p>
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
              <p className="text-xs text-amber-700">Outstanding balance (unsettled sold + care items)</p>
              {balance && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Sold: {formatKes(balance.sold_total)} · In Jokenia's care: {formatKes(balance.lost_total)}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setReceiveOpen(true)} className="flex-1">
                Receive stock
              </Button>
              <Button onClick={() => setSettleOpen(true)} className="flex-1">
                Settle
              </Button>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Current stock
              </p>
              {stockQuery.isLoading ? (
                <p className="text-xs text-jokenia-tan">Loading…</p>
              ) : stock.length === 0 ? (
                <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                  No stock currently held.
                </p>
              ) : (
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {stock.map((item) => (
                    <div key={item.batch_line_id}>
                      <div className="flex items-center justify-between px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-jokenia-dark">
                            {item.product_type} — {item.variation_name}
                          </p>
                          <p className="text-xs text-jokenia-tan">{item.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-jokenia-dark">
                            {item.units_in_stock} units
                          </p>
                          <div className="flex items-center gap-2">
                            {item.consignee_price != null && (
                              <p className="text-xs text-jokenia-tan">
                                {formatKes(item.consignee_price)}/unit
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setPriceEditItem(item)
                                setPriceEditValue(
                                  item.consignee_price != null ? String(item.consignee_price) : ''
                                )
                              }}
                              className="text-xs text-jokenia-dark2 underline hover:text-jokenia-dark"
                            >
                              Edit price
                            </button>
                          </div>
                        </div>
                      </div>
                      {priceEditItem?.batch_line_id === item.batch_line_id && (
                        <div className="space-y-2 border-t border-jokenia-tan/10 bg-jokenia-cream2 px-3 py-2">
                          <p className="text-[11px] text-jokenia-tan">
                            Correct price for {item.variation_name} — only affects unsettled items,
                            this action is audited.
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={priceEditValue}
                              onChange={(event) => setPriceEditValue(event.target.value)}
                              placeholder="New price (KES)"
                              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-2 py-1.5 text-xs text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
                            />
                          </div>
                          {priceMutation.error && (
                            <p className="text-xs text-red-500">
                              {(priceMutation.error as Error).message}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setPriceEditItem(null)
                                setPriceEditValue('')
                              }}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => priceMutation.mutate()}
                              disabled={priceMutation.isPending}
                              className="flex-1"
                            >
                              {priceMutation.isPending ? 'Saving…' : 'Confirm'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                Stock items
              </p>
              {stockItemsQuery.isLoading ? (
                <p className="text-xs text-jokenia-tan">Loading…</p>
              ) : stockItems.length === 0 ? (
                <p className="rounded-md border border-jokenia-tan/20 bg-white/70 p-3 text-center text-xs text-jokenia-tan">
                  No serialized items in stock.
                </p>
              ) : (
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {stockItems.map((item) => (
                    <div key={item.item_id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-jokenia-dark">{item.serial_number}</p>
                        <p className="text-xs text-jokenia-tan">
                          {item.product_type} — {item.variation_name} · Received {formatDate(item.received_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-jokenia-dark">
                          {formatKes(item.consignee_price)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setCareItem(item)
                            setCareNotes('')
                          }}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Accept liability
                        </button>
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
                      <p className="text-sm font-semibold text-jokenia-dark">
                        {formatKes(item.consignee_price)}
                      </p>
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
                      <p className="text-sm font-semibold text-jokenia-dark">
                        {formatKes(item.consignee_price)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {careItems.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
                  Items in Jokenia&apos;s care
                </p>
                <div className="divide-y divide-jokenia-tan/10 rounded-md border border-jokenia-tan/20 bg-white/70">
                  {careItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-jokenia-dark">{item.serial_number}</p>
                        <p className="text-xs text-jokenia-tan">
                          {item.variation_name} · {formatDate(item.loss_date)}
                        </p>
                        {item.notes && <p className="text-xs italic text-jokenia-tan">{item.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-jokenia-dark">
                          {formatKes(item.consignee_price)}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            item.settled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.settled ? 'Settled' : 'Unsettled'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </QueryState>

      <Modal
        title="Accept liability"
        isOpen={careItem !== null}
        onClose={() => {
          if (!careMutation.isPending) {
            setCareItem(null)
            setCareNotes('')
          }
        }}
      >
        {careItem && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-jokenia-dark">{careItem.serial_number}</p>
            <p className="text-xs text-jokenia-tan">
              {careItem.product_type} — {careItem.variation_name}
            </p>
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              This cannot be undone. The item moves into Jokenia&apos;s care and Jokenia accepts
              liability at the consignee price ({formatKes(careItem.consignee_price)}).
            </p>
            <textarea
              value={careNotes}
              onChange={(event) => setCareNotes(event.target.value)}
              rows={3}
              placeholder="Notes (optional)"
              maxLength={500}
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
            />
            {careMutation.error && (
              <p className="text-xs text-red-500">{(careMutation.error as Error).message}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setCareItem(null)
                  setCareNotes('')
                }}
                disabled={careMutation.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => careMutation.mutate()}
                disabled={careMutation.isPending}
                className="flex-1"
              >
                {careMutation.isPending ? 'Recording…' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ReceiveStockModal
        clientId={clientId}
        isOpen={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        onReceived={() => {
          setReceiveOpen(false)
          invalidateAll()
        }}
      />

      <SettleModal
        clientId={clientId}
        isOpen={settleOpen}
        onClose={() => setSettleOpen(false)}
        onSettled={() => {
          setSettleOpen(false)
          invalidateAll()
        }}
      />

      {!isOnline && (
        <p className="mt-2 text-center text-xs text-red-500">
          Offline — Settle and other financial actions are unavailable until reconnected.
        </p>
      )}
    </div>
  )
}

export default ConsigneeDetail
