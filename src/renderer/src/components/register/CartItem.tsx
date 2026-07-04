import { useState } from 'react'
import type { CartLineItem, DiscountType } from '@/types'
import { lineDiscountAmount, lineNet, useAppStore } from '@/store/appStore'

interface CartItemProps {
  item: CartLineItem
}

function formatKes(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function CartItem({ item }: CartItemProps): React.JSX.Element {
  const incrementQuantity = useAppStore((state) => state.incrementQuantity)
  const decrementQuantity = useAppStore((state) => state.decrementQuantity)
  const removeItem = useAppStore((state) => state.removeItem)
  const setItemDiscount = useAppStore((state) => state.setItemDiscount)

  const [discountOpen, setDiscountOpen] = useState(false)
  const [valueInput, setValueInput] = useState(item.discountValue?.toString() ?? '')

  const grossTotal = item.unit_price * item.quantity
  const discountAmount = lineDiscountAmount(item)
  const netTotal = lineNet(item)

  function handleTypeSelect(type: DiscountType): void {
    if (item.discountType === type) {
      setItemDiscount(item.variation_id, null, null)
      setValueInput('')
      return
    }
    setItemDiscount(item.variation_id, type, item.discountValue)
  }

  function handleValueChange(raw: string): void {
    setValueInput(raw)
    const parsed = parseFloat(raw)
    setItemDiscount(item.variation_id, item.discountType, Number.isFinite(parsed) ? parsed : null)
  }

  return (
    <div className="rounded-md bg-jokenia-cream2 px-2 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-jokenia-dark">
            {item.product_type} — {item.variation_name}
          </div>
          <div className="truncate font-mono text-[11px] text-jokenia-tan">{item.sku}</div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => decrementQuantity(item.variation_id)}
            aria-label={`Decrease quantity of ${item.variation_name}`}
            className="flex h-5 w-5 items-center justify-center rounded bg-jokenia-gold text-xs font-semibold text-jokenia-dark hover:brightness-95"
          >
            −
          </button>
          <span className="w-4 text-center text-xs font-medium text-jokenia-dark">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => incrementQuantity(item.variation_id)}
            disabled={item.quantity >= item.stock_count}
            aria-label={`Increase quantity of ${item.variation_name}`}
            className="flex h-5 w-5 items-center justify-center rounded bg-jokenia-gold text-xs font-semibold text-jokenia-dark hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>

        <div className="shrink-0 text-right leading-tight">
          {discountAmount > 0 && (
            <div className="text-[10px] text-jokenia-tan line-through">
              KES {formatKes(grossTotal)}
            </div>
          )}
          <span className="font-medium text-jokenia-dark">KES {formatKes(netTotal)}</span>
        </div>

        <button
          type="button"
          onClick={() => removeItem(item.variation_id)}
          aria-label={`Remove ${item.variation_name}`}
          className="shrink-0 text-jokenia-tan hover:text-red-600"
        >
          ✕
        </button>
      </div>

      <button
        type="button"
        onClick={() => setDiscountOpen((open) => !open)}
        className="mt-1 text-[11px] font-medium text-jokenia-tan hover:text-jokenia-dark"
      >
        {discountOpen
          ? '▾ Item discount (optional)'
          : discountAmount > 0
            ? `▸ Discount: −KES ${formatKes(discountAmount)}`
            : '▸ Item discount'}
      </button>

      {discountOpen && (
        <div className="mt-1 space-y-1">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handleTypeSelect('percentage')}
              className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                item.discountType === 'percentage'
                  ? 'bg-jokenia-dark text-jokenia-cream'
                  : 'border border-jokenia-dark/30 bg-transparent text-jokenia-dark'
              }`}
            >
              % Percentage
            </button>
            <button
              type="button"
              onClick={() => handleTypeSelect('fixed')}
              className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium transition-colors ${
                item.discountType === 'fixed'
                  ? 'bg-jokenia-dark text-jokenia-cream'
                  : 'border border-jokenia-dark/30 bg-transparent text-jokenia-dark'
              }`}
            >
              KES Fixed
            </button>
          </div>
          {item.discountType && (
            <>
              <input
                type="number"
                value={valueInput}
                onChange={(event) => handleValueChange(event.target.value)}
                placeholder={
                  item.discountType === 'percentage' ? 'e.g. 10 for 10%' : 'Amount in KES'
                }
                className="w-full rounded-md border border-jokenia-tan/40 bg-white px-2 py-1 text-xs text-jokenia-dark placeholder:text-jokenia-tan/60 focus:border-jokenia-gold focus:outline-none"
              />
              {discountAmount > 0 && (
                <p className="text-[11px] font-semibold text-green-700">
                  Saves KES {formatKes(discountAmount)}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default CartItem
