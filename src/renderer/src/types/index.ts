export type SystemRole = 'staff' | 'admin' | 'super_admin'

export type TabId =
  | 'checkout'
  | 'inventory'
  | 'batches'
  | 'staff'
  | 'consignees'
  | 'partners'
  | 'markets'
  | 'services'
  | 'reconciliation'
  | 'expenses'
  | 'settings'

export type ItemStatus = 'in_stock' | 'sold' | 'returned' | 'damaged' | 'transferred'

export type SaleTypeOption = 'retail' | 'manual'

export type PaymentMethodOption = 'cash' | 'card' | 'mpesa'

export type SaleChannel = 'in_shop' | 'online' | 'market'

export type OnlinePlatform = 'whatsapp' | 'instagram' | 'other'

export type DiscountType = 'percentage' | 'fixed'

export interface CartLineItem {
  variation_id: string
  product_type: string
  variation_name: string
  sku: string
  unit_price: number
  quantity: number
  stock_count: number
  discountType: DiscountType | null
  discountValue: number | null
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

export interface PrinterInfo {
  name: string
  displayName: string
}

// No 'idle' member: the Updates section represents "no check yet" as a null
// UpdaterStatus rather than a wire status — main never sends 'idle'.
export type UpdaterState =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterStatus {
  status: UpdaterState
  percent?: number
  version?: string
  message?: string
}

export interface MarketEvent {
  id: string
  name: string
  series_name: string | null
  location: string | null
  start_date: string
  end_date: string
  notes: string | null
  is_active: boolean
  created_at: string
  sale_count: number
  total_revenue: number
}
