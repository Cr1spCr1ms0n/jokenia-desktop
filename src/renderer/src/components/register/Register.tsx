import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { selectCartTotal, useAppStore } from '@/store/appStore'
import type {
  MarketEvent,
  OnlinePlatform,
  PaymentMethodOption,
  SaleChannel,
  SaleTypeOption
} from '@/types'
import { printReceipt, type ReceiptData } from '@/utils/receipt'
import ScanInput from './ScanInput'
import CartItem from './CartItem'

const SALE_TYPES: { id: SaleTypeOption; label: string }[] = [
  { id: 'retail', label: 'Retail' },
  { id: 'manual', label: 'Manual' }
]

const CHANNEL_OPTIONS: { id: SaleChannel; label: string }[] = [
  { id: 'in_shop', label: 'In Shop' },
  { id: 'online', label: 'Online' },
  { id: 'market', label: 'Market' }
]

const PLATFORM_OPTIONS: { id: OnlinePlatform; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'other', label: 'Other' }
]

const PAYMENT_METHODS: { id: PaymentMethodOption; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'mpesa', label: 'M-Pesa' }
]

function formatKes(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseConfirmError(message: string): string {
  if (message.includes('unpriced_item')) return 'One or more items have no price set.'
  if (message.includes('Insufficient stock')) return 'Insufficient stock — rescan items.'
  if (message.includes('does not match')) return 'Payment total mismatch — contact support.'
  return message
}

function Register(): React.JSX.Element {
  const cart = useAppStore((state) => state.cart)
  const cartTotal = useAppStore(selectCartTotal)
  const saleType = useAppStore((state) => state.saleType)
  const setSaleType = useAppStore((state) => state.setSaleType)
  const saleChannel = useAppStore((state) => state.saleChannel)
  const setSaleChannel = useAppStore((state) => state.setSaleChannel)
  const onlinePlatform = useAppStore((state) => state.onlinePlatform)
  const setOnlinePlatform = useAppStore((state) => state.setOnlinePlatform)
  const marketEventId = useAppStore((state) => state.marketEventId)
  const setMarketEventId = useAppStore((state) => state.setMarketEventId)
  const payments = useAppStore((state) => state.payments)
  const addPayment = useAppStore((state) => state.addPayment)
  const removePayment = useAppStore((state) => state.removePayment)
  const updatePaymentMethod = useAppStore((state) => state.updatePaymentMethod)
  const updatePaymentAmount = useAppStore((state) => state.updatePaymentAmount)
  const updatePaymentReference = useAppStore((state) => state.updatePaymentReference)
  const customerEmail = useAppStore((state) => state.customerEmail)
  const setCustomerEmail = useAppStore((state) => state.setCustomerEmail)
  const isConfirming = useAppStore((state) => state.isConfirming)
  const setIsConfirming = useAppStore((state) => state.setIsConfirming)
  const lastSaleId = useAppStore((state) => state.lastSaleId)
  const setLastSaleId = useAppStore((state) => state.setLastSaleId)
  const clearCart = useAppStore((state) => state.clearCart)
  const hydrateChannelState = useAppStore((state) => state.hydrateChannelState)

  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null)
  const [lastSaleReceipt, setLastSaleReceipt] = useState<Omit<
    ReceiptData,
    'saleId' | 'total' | 'saleDate'
  > | null>(null)

  const { data: marketEvents } = useQuery({
    queryKey: ['market-events-active'],
    queryFn: async (): Promise<MarketEvent[]> => {
      const { data, error } = await supabase.rpc('get_market_events', {
        p_include_inactive: false
      })
      if (error) throw error
      return (data ?? []) as MarketEvent[]
    },
    enabled: saleChannel === 'market'
  })

  // Register only ever mounts once authenticated (Zone 2 of AppShell), so this
  // doubles as "hydrate persisted channel state on app start after auth"
  // without needing App.tsx in scope. Runs once; a stale/inactive market
  // event is validated and falls back to in_shop inside the store action.
  useEffect(() => {
    void hydrateChannelState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Manual sale fields — not shared elsewhere, kept local to this component.
  const [manualDescription, setManualDescription] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [manualQuantity, setManualQuantity] = useState('1')
  const [manualAffectsInventory, setManualAffectsInventory] = useState(false)

  const isManual = saleType === 'manual'
  const manualNet = (parseFloat(manualPrice) || 0) * (parseInt(manualQuantity, 10) || 1)
  const total = isManual ? manualNet : cartTotal
  const hasItems = isManual ? manualNet > 0 : cart.length > 0

  const paymentsTotal = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const paymentValid =
    hasItems && Math.abs(paymentsTotal - total) < 0.01 && payments.every((p) => p.method !== null)
  const marketEventRequired = saleChannel === 'market' && !marketEventId

  function resetManualFields(): void {
    setManualDescription('')
    setManualPrice('')
    setManualQuantity('1')
    setManualAffectsInventory(false)
  }

  async function handleConfirm(): Promise<void> {
    if (isConfirming) return
    setConfirmError(null)

    if (isManual) {
      if (!manualDescription.trim()) {
        setConfirmError('Enter a description for this manual sale.')
        return
      }
      if (!(parseFloat(manualPrice) > 0)) {
        setConfirmError('Enter a valid unit price.')
        return
      }
      if (!(parseInt(manualQuantity, 10) >= 1)) {
        setConfirmError('Enter a valid quantity.')
        return
      }
    } else if (cart.length === 0) {
      return
    }

    if (marketEventRequired) {
      setConfirmError('Select a market event to continue.')
      return
    }

    if (!paymentValid) {
      setConfirmError(
        `Payments total KES ${paymentsTotal.toLocaleString()} must equal sale total KES ${total.toLocaleString()}.`
      )
      return
    }

    setIsConfirming(true)

    const paymentPayload = payments.map((p) => ({
      method: p.method as PaymentMethodOption,
      amount: parseFloat(p.amount) || 0,
      reference_number: p.reference_number.trim() || null
    }))
    const effectivePlatform = saleChannel === 'online' ? onlinePlatform : null
    const effectiveMarketEventId = saleChannel === 'market' ? marketEventId : null

    const { data: saleId, error } = isManual
      ? await supabase.rpc('create_manual_sale', {
          p_sale_type: 'manual',
          p_net_amount: manualNet,
          p_payments: paymentPayload,
          p_affects_inventory: manualAffectsInventory,
          p_manual_description: manualDescription.trim(),
          p_sale_channel: saleChannel,
          p_market_event_id: effectiveMarketEventId,
          p_online_platform: effectivePlatform
        })
      : await supabase.rpc('create_sale', {
          p_items: cart.map((item) => ({
            variation_id: item.variation_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            ...(item.discountType && item.discountValue != null
              ? { discount_type: item.discountType, discount_value: item.discountValue }
              : {})
          })),
          p_payments: paymentPayload,
          p_customer_email: customerEmail.trim() || null,
          p_sale_channel: saleChannel,
          p_market_event_id: effectiveMarketEventId,
          p_online_platform: effectivePlatform
        })

    setIsConfirming(false)

    if (error) {
      setConfirmError(parseConfirmError(error.message))
      return
    }

    setLastSaleReceipt({
      items: isManual
        ? [
            {
              name: manualDescription.trim(),
              sku: '—',
              quantity: parseInt(manualQuantity, 10) || 1,
              unitPrice: parseFloat(manualPrice) || 0
            }
          ]
        : cart.map((item) => ({
            name: item.variation_name,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            discountType: item.discountType,
            discountValue: item.discountValue
          })),
      payments: paymentPayload.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference_number
      })),
      customerEmail: isManual ? null : customerEmail.trim() || null,
      channel: saleChannel
    })

    setLastSaleTotal(total)
    setLastSaleId(saleId as string)
    clearCart()
    resetManualFields()
  }

  function handleVoid(): void {
    resetManualFields()
    clearCart()
  }

  function handleNewSale(): void {
    setLastSaleId(null)
    setLastSaleTotal(null)
    setLastSaleReceipt(null)
  }

  async function handlePrintReceipt(): Promise<void> {
    if (!lastSaleId || !lastSaleReceipt) return
    await printReceipt({
      saleId: lastSaleId,
      total: lastSaleTotal ?? 0,
      saleDate: new Date().toLocaleDateString('en-KE', { dateStyle: 'full' }),
      ...lastSaleReceipt
    })
  }

  // Settings > Printing > "Auto-print receipt after sale". lastSaleReceipt is
  // set synchronously alongside lastSaleId in handleConfirm, so by the time
  // this effect runs the receipt snapshot is already available.
  useEffect(() => {
    if (!lastSaleId) return
    window.electron.getPreference('settings.autoPrintReceipt').then((value) => {
      if (value) void handlePrintReceipt()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSaleId])

  if (lastSaleId) {
    return (
      <aside className="flex w-[278px] shrink-0 flex-col gap-3 overflow-y-auto bg-jokenia-cream p-3">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="font-heading text-lg font-semibold text-jokenia-dark">Sale confirmed</p>
          <p className="break-all text-xs text-jokenia-tan">{lastSaleId}</p>
          {lastSaleTotal !== null && (
            <p className="text-xl font-bold text-jokenia-dark">KES {formatKes(lastSaleTotal)}</p>
          )}
          <div className="mt-3 flex w-full gap-2">
            <button
              type="button"
              onClick={() => void handlePrintReceipt()}
              className="flex-1 rounded-md bg-jokenia-dark2 py-2.5 text-sm font-semibold text-jokenia-cream hover:brightness-110"
            >
              Print receipt
            </button>
            <button
              type="button"
              onClick={handleNewSale}
              className="flex-1 rounded-md bg-jokenia-gold py-2.5 text-sm font-semibold text-jokenia-dark hover:brightness-95"
            >
              New sale
            </button>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full w-[278px] shrink-0 flex-col overflow-hidden bg-jokenia-cream">
      {/* Fixed top: sale type / channel / platform / market / scan — always rigid, never scrolls */}
      <div className="flex shrink-0 flex-col gap-3 p-3 pb-2">
        <div className="flex gap-1 rounded-md bg-white/50 p-1">
          {SALE_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setSaleType(type.id)}
              className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                saleType === type.id
                  ? 'bg-jokenia-gold text-jokenia-dark'
                  : 'text-jokenia-dark2 hover:bg-white'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div
          className={
            saleChannel !== 'in_shop'
              ? 'rounded-md ring-2 ring-jokenia-gold ring-offset-1 ring-offset-jokenia-cream'
              : undefined
          }
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Channel
          </p>
          <div className="flex gap-1 rounded-md bg-white/50 p-1">
            {CHANNEL_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setSaleChannel(option.id)
                  if (option.id !== 'online') setOnlinePlatform(null)
                  if (option.id !== 'market') setMarketEventId(null)
                }}
                className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                  saleChannel === option.id
                    ? 'bg-jokenia-dark text-jokenia-cream'
                    : 'text-jokenia-dark2 hover:bg-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {saleChannel === 'online' && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
              Platform
            </p>
            <div className="flex gap-1 rounded-md bg-white/50 p-1">
              {PLATFORM_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setOnlinePlatform(onlinePlatform === option.id ? null : option.id)}
                  className={`flex-1 rounded px-1.5 py-1.5 text-[11px] font-medium transition-colors ${
                    onlinePlatform === option.id
                      ? 'bg-jokenia-dark text-jokenia-cream'
                      : 'text-jokenia-dark2 hover:bg-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {saleChannel === 'market' && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
              Market event
            </p>
            <select
              value={marketEventId ?? ''}
              onChange={(event) => setMarketEventId(event.target.value || null)}
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
            >
              <option value="">Select an event…</option>
              {(marketEvents ?? []).map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} — {new Date(`${event.start_date}T00:00:00`).toLocaleDateString('en-KE')}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isManual && <ScanInput isConfirming={isConfirming} />}
      </div>

      {/* Flexible middle: manual fields or cart list — owns all spare vertical space, scrolls internally */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {isManual ? (
          <div className="space-y-2 pb-1">
            <input
              type="text"
              value={manualDescription}
              onChange={(event) => setManualDescription(event.target.value)}
              placeholder="Description"
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark placeholder:text-jokenia-tan/60 focus:border-jokenia-gold focus:outline-none"
            />
            <input
              type="number"
              value={manualPrice}
              onChange={(event) => setManualPrice(event.target.value)}
              placeholder="Unit price (KES)"
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark placeholder:text-jokenia-tan/60 focus:border-jokenia-gold focus:outline-none"
            />
            <input
              type="number"
              value={manualQuantity}
              onChange={(event) => setManualQuantity(event.target.value)}
              placeholder="Quantity"
              min={1}
              className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark placeholder:text-jokenia-tan/60 focus:border-jokenia-gold focus:outline-none"
            />
            <label className="flex items-center justify-between rounded-md border border-jokenia-tan/20 bg-white px-3 py-2 text-xs text-jokenia-dark2">
              <span>Deduct from stock</span>
              <input
                type="checkbox"
                checked={manualAffectsInventory}
                onChange={(event) => setManualAffectsInventory(event.target.checked)}
              />
            </label>
          </div>
        ) : cart.length === 0 ? (
          <p className="pt-6 text-center text-xs text-jokenia-tan">Scan or search to add items</p>
        ) : (
          <div className="flex flex-col gap-1.5 pb-1">
            {cart.map((item) => (
              <CartItem key={item.variation_id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Fixed footer: payment / total / confirm — non-shrinking, pinned to the bottom, scrolls
          internally as a last resort if a very small screen can't fit it even with the cart at 0 */}
      <div className="flex max-h-[55%] shrink-0 flex-col gap-3 overflow-y-auto p-3 pt-2">
        {hasItems && (
          <div className="flex items-center justify-between text-xs text-jokenia-dark2">
            <span>{isManual ? 'Manual sale' : `${cart.length} item${cart.length === 1 ? '' : 's'}`}</span>
            <span className="font-medium text-jokenia-dark">KES {formatKes(total)}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">Payment</p>
          {payments.map((entry) => (
            <div key={entry.id} className="space-y-1 rounded-md border border-jokenia-tan/20 bg-white/60 p-2">
              <div className="flex gap-1">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => updatePaymentMethod(entry.id, method.id)}
                    className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                      entry.method === method.id
                        ? 'bg-jokenia-dark text-jokenia-cream'
                        : 'border border-jokenia-dark/30 bg-transparent text-jokenia-dark'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={entry.amount}
                  onChange={(event) => updatePaymentAmount(entry.id, event.target.value)}
                  placeholder="Amount"
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-2 py-1.5 text-xs text-jokenia-dark placeholder:text-jokenia-tan/60 focus:border-jokenia-gold focus:outline-none"
                />
                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePayment(entry.id)}
                    aria-label="Remove payment"
                    className="shrink-0 text-jokenia-tan hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              {(entry.method === 'mpesa' || entry.method === 'card') && (
                <input
                  type="text"
                  value={entry.reference_number}
                  onChange={(event) => updatePaymentReference(entry.id, event.target.value)}
                  placeholder={entry.method === 'mpesa' ? 'M-Pesa code' : 'Card approval code'}
                  className="w-full rounded-md border border-jokenia-tan/40 bg-white px-2 py-1.5 text-xs text-jokenia-dark placeholder:text-jokenia-tan/60 focus:border-jokenia-gold focus:outline-none"
                />
              )}
            </div>
          ))}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addPayment}
              className="rounded-md border border-jokenia-gold px-2 py-1 text-[11px] font-medium text-jokenia-dark2 hover:bg-white"
            >
              + Add payment
            </button>
            <span
              className={`text-xs font-semibold ${
                !paymentValid && hasItems ? 'text-red-500' : 'text-jokenia-dark2'
              }`}
            >
              KES {formatKes(paymentsTotal)} / {formatKes(total)}
            </span>
          </div>
        </div>

        {!isManual && (
          <input
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="Receipt email (optional)"
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark placeholder:text-jokenia-tan/60 focus:border-jokenia-gold focus:outline-none"
          />
        )}

        {saleChannel !== 'in_shop' && (
          <div className="rounded-md border-2 border-jokenia-gold bg-jokenia-gold/15 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-jokenia-dark">
            {saleChannel === 'market'
              ? `Market — ${marketEvents?.find((event) => event.id === marketEventId)?.name ?? 'Select event'}`
              : `Online — ${
                  onlinePlatform
                    ? (PLATFORM_OPTIONS.find((option) => option.id === onlinePlatform)?.label ?? onlinePlatform)
                    : 'Select platform'
                }`}
          </div>
        )}

        <div className="flex items-baseline justify-between font-heading">
          <span className="text-sm text-jokenia-dark2">Total</span>
          <span className="text-2xl font-bold text-jokenia-dark">KES {formatKes(total)}</span>
        </div>

        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={!hasItems || isConfirming || !paymentValid || marketEventRequired}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-jokenia-gold py-2.5 text-sm font-semibold text-jokenia-dark hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isConfirming && (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-jokenia-dark/30 border-t-jokenia-dark"
              aria-hidden="true"
            />
          )}
          {isConfirming ? 'Processing…' : `Confirm sale — KES ${formatKes(total)}`}
        </button>

        {!hasItems && (
          <p className="text-center text-xs text-jokenia-tan">
            {isManual ? 'Enter sale details to confirm' : 'Add items to confirm'}
          </p>
        )}
        {hasItems && marketEventRequired && (
          <p className="text-center text-xs text-red-500">Select a market event to continue</p>
        )}
        {confirmError && <p className="text-center text-xs text-red-500">{confirmError}</p>}

        {hasItems && (
          <button
            type="button"
            onClick={handleVoid}
            className="text-center text-xs text-jokenia-tan hover:text-red-600"
          >
            Void cart
          </button>
        )}
      </div>
    </aside>
  )
}

export default Register
