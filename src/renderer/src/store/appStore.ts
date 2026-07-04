import { create } from 'zustand'
import type {
  CartLineItem,
  DiscountType,
  OnlinePlatform,
  PaymentEntry,
  SaleChannel,
  SaleTypeOption,
  TabId
} from '@/types'

export function lineDiscountAmount(item: CartLineItem): number {
  const gross = item.unit_price * item.quantity
  if (!item.discountType || !item.discountValue || item.discountValue <= 0) return 0
  if (item.discountType === 'percentage') return gross * (item.discountValue / 100)
  return Math.min(item.discountValue, gross)
}

export function lineNet(item: CartLineItem): number {
  return item.unit_price * item.quantity - lineDiscountAmount(item)
}

function blankPayment(): PaymentEntry {
  return { id: crypto.randomUUID(), method: null, amount: '', reference_number: '' }
}

interface AppState {
  activeTab: TabId
  isOnline: boolean
  setActiveTab: (tab: TabId) => void
  setOnline: (isOnline: boolean) => void

  // Checkout
  cart: CartLineItem[]
  saleType: SaleTypeOption
  saleChannel: SaleChannel
  onlinePlatform: OnlinePlatform | null
  marketEventId: string | null
  payments: PaymentEntry[]
  customerEmail: string
  isConfirming: boolean
  lastSaleId: string | null
  addOrIncrementItem: (
    item: Omit<CartLineItem, 'quantity' | 'discountType' | 'discountValue'>
  ) => void
  removeItem: (variation_id: string) => void
  incrementQuantity: (variation_id: string) => void
  decrementQuantity: (variation_id: string) => void
  setItemDiscount: (variation_id: string, type: DiscountType | null, value: number | null) => void
  setSaleType: (type: SaleTypeOption) => void
  setSaleChannel: (channel: SaleChannel) => void
  setOnlinePlatform: (platform: OnlinePlatform | null) => void
  setMarketEventId: (id: string | null) => void
  addPayment: () => void
  removePayment: (id: string) => void
  updatePaymentMethod: (id: string, method: PaymentEntry['method']) => void
  updatePaymentAmount: (id: string, amount: string) => void
  updatePaymentReference: (id: string, reference_number: string) => void
  setCustomerEmail: (email: string) => void
  setIsConfirming: (val: boolean) => void
  setLastSaleId: (id: string | null) => void
  clearCart: () => void
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'checkout',
  isOnline: true,
  setActiveTab: (activeTab) => set({ activeTab }),
  setOnline: (isOnline) => set({ isOnline }),

  cart: [],
  saleType: 'retail',
  saleChannel: 'in_shop',
  onlinePlatform: null,
  marketEventId: null,
  payments: [blankPayment()],
  customerEmail: '',
  isConfirming: false,
  lastSaleId: null,

  addOrIncrementItem: (item) =>
    set((state) => {
      const existing = state.cart.find((line) => line.variation_id === item.variation_id)
      if (!existing) {
        return {
          cart: [...state.cart, { ...item, quantity: 1, discountType: null, discountValue: null }]
        }
      }
      return {
        cart: state.cart.map((line) =>
          line.variation_id === item.variation_id
            ? {
                ...line,
                stock_count: item.stock_count,
                quantity: Math.min(line.quantity + 1, item.stock_count)
              }
            : line
        )
      }
    }),

  removeItem: (variation_id) =>
    set((state) => ({ cart: state.cart.filter((line) => line.variation_id !== variation_id) })),

  incrementQuantity: (variation_id) =>
    set((state) => ({
      cart: state.cart.map((line) =>
        line.variation_id === variation_id
          ? { ...line, quantity: Math.min(line.quantity + 1, line.stock_count) }
          : line
      )
    })),

  decrementQuantity: (variation_id) =>
    set((state) => {
      const line = state.cart.find((l) => l.variation_id === variation_id)
      if (!line) return state
      if (line.quantity <= 1) {
        return { cart: state.cart.filter((l) => l.variation_id !== variation_id) }
      }
      return {
        cart: state.cart.map((l) =>
          l.variation_id === variation_id ? { ...l, quantity: l.quantity - 1 } : l
        )
      }
    }),

  setItemDiscount: (variation_id, discountType, discountValue) =>
    set((state) => ({
      cart: state.cart.map((line) =>
        line.variation_id === variation_id ? { ...line, discountType, discountValue } : line
      )
    })),

  setSaleType: (saleType) => set({ saleType }),
  setSaleChannel: (saleChannel) => set({ saleChannel }),
  setOnlinePlatform: (onlinePlatform) => set({ onlinePlatform }),
  setMarketEventId: (marketEventId) => set({ marketEventId }),

  addPayment: () => set((state) => ({ payments: [...state.payments, blankPayment()] })),

  removePayment: (id) =>
    set((state) => ({
      payments: state.payments.length > 1 ? state.payments.filter((p) => p.id !== id) : state.payments
    })),

  updatePaymentMethod: (id, method) =>
    set((state) => ({
      payments: state.payments.map((p) => (p.id === id ? { ...p, method } : p))
    })),

  updatePaymentAmount: (id, amount) =>
    set((state) => ({
      payments: state.payments.map((p) => (p.id === id ? { ...p, amount } : p))
    })),

  updatePaymentReference: (id, reference_number) =>
    set((state) => ({
      payments: state.payments.map((p) => (p.id === id ? { ...p, reference_number } : p))
    })),

  setCustomerEmail: (customerEmail) => set({ customerEmail }),
  setIsConfirming: (isConfirming) => set({ isConfirming }),
  setLastSaleId: (lastSaleId) => set({ lastSaleId }),

  // Deliberately does not reset lastSaleId: handleConfirm calls
  // setLastSaleId(id) then clearCart() in sequence, and the success
  // banner is driven by lastSaleId staying set until "New sale" is
  // clicked (setLastSaleId(null)).
  clearCart: () =>
    set({
      cart: [],
      customerEmail: '',
      isConfirming: false,
      saleChannel: 'in_shop',
      onlinePlatform: null,
      marketEventId: null,
      payments: [blankPayment()]
    })
}))

export const selectCartTotal = (state: AppState): number =>
  state.cart.reduce((sum, line) => sum + lineNet(line), 0)
