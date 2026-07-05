export interface ProductTypeRow {
  id: string
  name: string
  type_code: string | null
  type_seq: number
  has_variations: boolean
}

export interface StyleOption {
  id: string
  name: string
  style_code: string
  style_seq: number
}

export interface TypeVariationRow {
  id: string
  name: string
  sku: string
  colour: string | null
  size: string | null
  waist_size: number | null
  inseam: number | null
  style_id: string | null
}

export interface BrandingClientOption {
  id: string
  name: string
  client_seq: number
}

export interface PriceListItem {
  variation_id: string
  product_type: string
  variation_name: string
  sku: string
  current_price: number | null
  last_changed_at: string | null
  last_reason: string | null
  days_since_change: number | null
}

export interface UnpricedItem {
  variation_id: string
  name: string
  sku: string
  product_type_id: string
  product_type_name: string
  style_name: string | null
  in_stock_count: number
}

export interface TypePricingRow {
  variation_id: string
  style_id: string | null
  style_name: string | null
  style_code: string | null
  variation_name: string
  colour: string | null
  size: string | null
  waist_size: number | null
  inseam: number | null
  length_label: string | null
  length_desc: string | null
  base_price: number
  override_price: number | null
  current_price: number | null
}

export interface PriceHistoryEntry {
  id: string
  old_price: number
  new_price: number
  changed_by: string
  reason: string | null
  notes: string | null
  reverted_from_id: string | null
  is_revert: boolean
  created_at: string
}

export interface VariationPriceHistory {
  variation_id: string
  variation_name: string
  product_type: string
  sku: string
  current_price: number
  history: PriceHistoryEntry[]
}

export type PriceReason = 'Clearance' | 'Restock' | 'Market Adjustment' | 'Other'
