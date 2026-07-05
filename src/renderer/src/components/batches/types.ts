export type BatchStatus =
  'pending_verification' | 'pending_product_approval' | 'approved' | 'rejected'

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  pending_verification: 'Pending Verification',
  pending_product_approval: 'Pending Product Approval',
  approved: 'Approved',
  rejected: 'Rejected'
}

export interface BatchRow {
  id: string
  status: BatchStatus
  production_date: string
  staff_name: string
  item_count: number
}

export interface BatchLineRow {
  id: string
  batch_id: string
  variation_id: string | null
  suggestion_id: string | null
  quantity: number
  resolved_name: string
}

export interface SuggestionDetail {
  id: string
  product_type_name: string
  variation_name: string
  staff_name: string
  colour: string | null
  size: string | null
  style_hint: string | null
}

export interface ProductVariationOption {
  id: string
  variation_name: string
  sku: string
  product_type_name: string
}

export interface ProductTypeOption {
  id: string
  name: string
}

export interface ProductStyleOption {
  id: string
  name: string
  style_code: string
}

// Matches approve_product_suggestion's four mutually-exclusive parameter
// shapes — see admin app app/(drawer)/operations/suggestions/[id].tsx.
export type ApproveSuggestionParams =
  | {
      p_variation_name: string | null
      p_product_type_name: string | null
      p_price: number | null
      p_colour: string | null
      p_size: string | null
      p_external_barcode: string | null
    }
  | { p_variation_id: string }
  | {
      p_style_id: string
      p_colour: string | null
      p_size: string | null
      p_external_barcode: string | null
    }
  | {
      p_product_type_id: string
      p_style_name: string | null
      p_colour: string | null
      p_size: string | null
      p_external_barcode: string | null
    }

export interface ApproveSuggestionResult {
  batch_id: string
  batch_status: BatchStatus
  remaining_suggestions: number
}

export interface ProductionLine {
  variation: ProductVariationOption | null
  quantity: string
}
