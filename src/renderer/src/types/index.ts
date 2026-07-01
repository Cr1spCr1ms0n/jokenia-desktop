export type SystemRole = 'staff' | 'admin' | 'super_admin'

export type TabId =
  | 'checkout'
  | 'inventory'
  | 'batches'
  | 'staff'
  | 'consignees'
  | 'partners'
  | 'services'
  | 'reconciliation'
  | 'expenses'
  | 'settings'

export type ItemStatus = 'in_stock' | 'sold' | 'returned' | 'damaged' | 'transferred'

export type SaleTypeOption = 'retail' | 'manual'

export type PaymentMethodOption = 'cash' | 'card' | 'mpesa'

export type SaleChannel = 'in_shop' | 'online'

export type OnlinePlatform = 'whatsapp' | 'instagram' | 'other'

export interface CartLineItem {
  variation_id: string
  product_type: string
  variation_name: string
  sku: string
  unit_price: number
  quantity: number
  stock_count: number
}

export interface PaymentEntry {
  id: string
  method: PaymentMethodOption | null
  amount: string
  reference_number: string
}

export interface TabDefinition {
  id: TabId
  label: string
}
