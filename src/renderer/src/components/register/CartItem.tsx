import type { CartLineItem } from '@/types'
import { useAppStore } from '@/store/appStore'

interface CartItemProps {
  item: CartLineItem
}

function CartItem({ item }: CartItemProps): React.JSX.Element {
  const incrementQuantity = useAppStore((state) => state.incrementQuantity)
  const decrementQuantity = useAppStore((state) => state.decrementQuantity)
  const removeItem = useAppStore((state) => state.removeItem)

  const lineTotal = item.unit_price * item.quantity

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-jokenia-cream2 px-2 py-1.5 text-sm">
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

      <span className="shrink-0 text-right font-medium text-jokenia-dark">
        KES {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>

      <button
        type="button"
        onClick={() => removeItem(item.variation_id)}
        aria-label={`Remove ${item.variation_name}`}
        className="shrink-0 text-jokenia-tan hover:text-red-600"
      >
        ✕
      </button>
    </div>
  )
}

export default CartItem
