import { create } from 'zustand'
import type { CartLineItem, PaymentMethodOption, SaleTypeOption, TabId } from '@/types'

interface AppState {
  activeTab: TabId
  isOnline: boolean
  setActiveTab: (tab: TabId) => void
  setOnline: (isOnline: boolean) => void

  // Checkout
  cart: CartLineItem[]
  saleType: SaleTypeOption
  paymentMethod: PaymentMethodOption
  referenceNumber: string
  customerEmail: string
  isConfirming: boolean
  lastSaleId: string | null
  addOrIncrementItem: (item: Omit<CartLineItem, 'quantity'>) => void
  removeItem: (variation_id: string) => void
  incrementQuantity: (variation_id: string) => void
  decrementQuantity: (variation_id: string) => void
  setSaleType: (type: SaleTypeOption) => void
  setPaymentMethod: (method: PaymentMethodOption) => void
  setReferenceNumber: (ref: string) => void
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
  paymentMethod: 'cash',
  referenceNumber: '',
  customerEmail: '',
  isConfirming: false,
  lastSaleId: null,

  addOrIncrementItem: (item) =>
    set((state) => {
      const existing = state.cart.find((line) => line.variation_id === item.variation_id)
      if (!existing) {
        return { cart: [...state.cart, { ...item, quantity: 1 }] }
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

  setSaleType: (saleType) => set({ saleType }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setReferenceNumber: (referenceNumber) => set({ referenceNumber }),
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
      referenceNumber: '',
      isConfirming: false
    })
}))

export const selectCartTotal = (state: AppState): number =>
  state.cart.reduce((sum, line) => sum + line.unit_price * line.quantity, 0)
