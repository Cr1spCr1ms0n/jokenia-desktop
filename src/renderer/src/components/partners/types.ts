export interface PartnerRow {
  id: string
  partner_code: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  is_active: boolean
}

export interface PartnerContact {
  id: string
  partner_seq: number
  partner_code: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

export interface PartnerBalance {
  partner_id: string
  outstanding: number
  stock_owed: number
  sales_owed: number
  lost_owed: number
}

export interface PartnerStockItem {
  variation_id: string
  product_type: string
  variation_name: string
  sku: string
  units_at_partner: number
  selling_price: number | null
}

export interface PartnerSerializedItem {
  item_id: string
  serial_number: string
  type_name: string
  variation_name: string
  sku: string | null
  selling_price: number
}

export interface PartnerSoldItem {
  item_id: string
  serial_number: string
  type_name: string
  variation_name: string
  sku: string | null
  selling_price: number
  amount_received: number
  sale_date: string
  is_settled: boolean
  settlement_id: string | null
  settlement_date: string | null
}

export interface PartnerReportSettlement {
  settlement_date: string
  total_amount: number
  notes: string | null
}

export interface PartnerReport {
  partner: {
    id: string
    partner_code: string
    name: string
    contact_person: string | null
    phone: string | null
    email: string | null
  }
  report_period: { from: string; to: string }
  stock: PartnerStockItem[]
  sales: Array<{
    sale_date: string
    product_type: string
    variation: string
    selling_price: number
    amount_received: number
    running_total: number
  }>
  total_owed: number
  settlements: PartnerReportSettlement[]
}

export interface PartnerVariationOption {
  id: string
  name: string
  sku: string
  product_type_name: string
}

export interface DispatchLine {
  variation: PartnerVariationOption | null
  quantity: string
  selling_price: string
}

export interface TransferredPartnerItem {
  id: string
  serial_number: string
  variation_id: string
}
