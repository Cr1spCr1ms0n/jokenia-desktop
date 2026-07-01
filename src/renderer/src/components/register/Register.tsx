import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { selectCartTotal, useAppStore } from '@/store/appStore'
import type { PaymentMethodOption, SaleTypeOption } from '@/types'
import ScanInput from './ScanInput'
import CartItem from './CartItem'

const SALE_TYPES: { id: SaleTypeOption; label: string }[] = [
  { id: 'retail', label: 'Retail' },
  { id: 'wholesale', label: 'Wholesale' }
]

const PAYMENT_METHODS: { id: PaymentMethodOption; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'mpesa', label: 'M-Pesa' },
  { id: 'card', label: 'Card' }
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
  const total = useAppStore(selectCartTotal)
  const saleType = useAppStore((state) => state.saleType)
  const setSaleType = useAppStore((state) => state.setSaleType)
  const paymentMethod = useAppStore((state) => state.paymentMethod)
  const setPaymentMethod = useAppStore((state) => state.setPaymentMethod)
  const referenceNumber = useAppStore((state) => state.referenceNumber)
  const setReferenceNumber = useAppStore((state) => state.setReferenceNumber)
  const customerEmail = useAppStore((state) => state.customerEmail)
  const setCustomerEmail = useAppStore((state) => state.setCustomerEmail)
  const isConfirming = useAppStore((state) => state.isConfirming)
  const setIsConfirming = useAppStore((state) => state.setIsConfirming)
  const lastSaleId = useAppStore((state) => state.lastSaleId)
  const setLastSaleId = useAppStore((state) => state.setLastSaleId)
  const clearCart = useAppStore((state) => state.clearCart)

  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null)

  async function handleConfirm(): Promise<void> {
    if (cart.length === 0 || isConfirming || saleType !== 'retail') return

    setConfirmError(null)
    setIsConfirming(true)

    const payload = {
      p_items: cart.map((item) => ({
        variation_id: item.variation_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      })),
      p_payments: [
        {
          method: paymentMethod,
          amount: parseFloat(total.toFixed(2)),
          reference_number: referenceNumber.trim() || null
        }
      ],
      p_customer_email: customerEmail.trim() || null,
      p_sale_channel: 'in_shop' as const
    }

    const { data: saleId, error } = await supabase.rpc('create_sale', payload)

    setIsConfirming(false)

    if (error) {
      setConfirmError(parseConfirmError(error.message))
      return
    }

    setLastSaleTotal(total)
    setLastSaleId(saleId as string)
    clearCart()
  }

  function handleNewSale(): void {
    setLastSaleId(null)
    setLastSaleTotal(null)
  }

  if (lastSaleId) {
    return (
      <aside className="flex w-[278px] shrink-0 flex-col gap-3 overflow-y-auto bg-jokenia-cream p-3">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="font-heading text-lg font-semibold text-jokenia-dark">Sale confirmed</p>
          <p className="break-all text-xs text-jokenia-tan">{lastSaleId}</p>
          {lastSaleTotal !== null && (
            <p className="text-xl font-bold text-jokenia-dark">KES {formatKes(lastSaleTotal)}</p>
          )}
          <button
            type="button"
            onClick={handleNewSale}
            className="mt-3 w-full rounded-md bg-jokenia-gold py-2.5 text-sm font-semibold text-jokenia-dark hover:brightness-95"
          >
            New sale
          </button>
        </div>
      </aside>
    )
  }

  const isWholesale = saleType === 'wholesale'

  return (
    <aside className="flex w-[278px] shrink-0 flex-col gap-3 overflow-y-auto bg-jokenia-cream p-3">
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

      <ScanInput isConfirming={isConfirming} />

      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {isWholesale ? (
          <p className="pt-6 text-center text-xs text-jokenia-tan">
            Wholesale checkout coming in a future update
          </p>
        ) : cart.length === 0 ? (
          <p className="pt-6 text-center text-xs text-jokenia-tan">Scan items to add</p>
        ) : (
          cart.map((item) => <CartItem key={item.variation_id} item={item} />)
        )}
      </div>

      {cart.length > 0 && (
        <div className="flex items-center justify-between text-xs text-jokenia-dark2">
          <span>
            {cart.length} item{cart.length === 1 ? '' : 's'}
          </span>
          <span className="font-medium text-jokenia-dark">KES {formatKes(total)}</span>
        </div>
      )}

      <div className="flex gap-1 rounded-md bg-white/50 p-1">
        {PAYMENT_METHODS.map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => {
              setPaymentMethod(method.id)
              if (method.id === 'cash') setReferenceNumber('')
            }}
            className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
              paymentMethod === method.id
                ? 'bg-jokenia-dark text-jokenia-cream'
                : 'border border-jokenia-dark bg-transparent text-jokenia-dark'
            }`}
          >
            {method.label}
          </button>
        ))}
      </div>

      {(paymentMethod === 'mpesa' || paymentMethod === 'card') && (
        <input
          type="text"
          value={referenceNumber}
          onChange={(event) => setReferenceNumber(event.target.value)}
          placeholder={paymentMethod === 'mpesa' ? 'M-Pesa code' : 'Receipt number'}
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark placeholder:text-jokenia-tan/60 focus:border-jokenia-gold focus:outline-none"
        />
      )}

      <input
        type="email"
        value={customerEmail}
        onChange={(event) => setCustomerEmail(event.target.value)}
        placeholder="Receipt email (optional)"
        className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark placeholder:text-jokenia-tan/60 focus:border-jokenia-gold focus:outline-none"
      />

      <div className="flex items-baseline justify-between font-heading">
        <span className="text-sm text-jokenia-dark2">Total</span>
        <span className="text-2xl font-bold text-jokenia-dark">KES {formatKes(total)}</span>
      </div>

      <button
        type="button"
        onClick={() => void handleConfirm()}
        disabled={cart.length === 0 || isWholesale || isConfirming || total === 0}
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

      {cart.length === 0 && (
        <p className="text-center text-xs text-jokenia-tan">Add items to confirm</p>
      )}
      {cart.length > 0 && isWholesale && (
        <p className="text-center text-xs text-jokenia-tan">Wholesale not yet available</p>
      )}
      {confirmError && <p className="text-center text-xs text-red-500">{confirmError}</p>}

      {cart.length > 0 && (
        <button
          type="button"
          onClick={clearCart}
          className="text-center text-xs text-jokenia-tan hover:text-red-600"
        >
          Void cart
        </button>
      )}
    </aside>
  )
}

export default Register
