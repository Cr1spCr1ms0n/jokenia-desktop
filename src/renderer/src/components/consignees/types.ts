export interface ConsigneeRow {
  id: string
  name: string
  client_seq: number
  is_active: boolean
}

export interface ConsigneeContact {
  id: string
  name: string
  client_seq: number
  is_active: boolean
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
}

export interface ConsigneeStockSummary {
  batch_line_id: string
  variation_id: string
  product_type: string
  variation_name: string
  sku: string
  units_in_stock: number
  consignee_price: number | null
}

export interface ConsigneeSerializedItem {
  item_id: string
  serial_number: string
  variation_id: string
  product_type: string
  variation_name: string
  sku: string
  consignee_price: number
  received_date: string
}

export interface ConsigneeSoldItem {
  item_id: string
  serial_number: string
  type_name: string
  variation_name: string
  sku: string | null
  consignee_price: number
  sale_date: string
  sale_id: string
  is_settled: boolean
  settlement_id: string | null
  settlement_date: string | null
}

// Uses the JOKENIA_GLOBAL euphemism rule's terms in the type/field names
// where practical; the RPC-facing shape still matches consignee_lost_items.
export interface ConsigneeCareItem {
  id: string
  item_id: string
  loss_date: string
  product_type: string
  variation_name: string
  sku: string
  serial_number: string
  consignee_price: number
  settled: boolean
  settlement_id: string | null
  notes: string | null
}

export interface ConsigneeBalance {
  client_id: string
  outstanding: number
  sold_total: number
  lost_total: number
}

export interface ConsigneeVariationOption {
  id: string
  name: string
  sku: string
  product_type_name: string
}

export interface ReceiveStockLine {
  variation: ConsigneeVariationOption | null
  quantity: string
  consignee_price: string
}

// Business-wide register row from get_all_consignee_lost_items — extends the
// per-consignee ConsigneeCareItem shape with the consignee's own identity
// fields, matching the admin app's BusinessLostItem exactly.
export interface CareRegisterItem extends ConsigneeCareItem {
  client_id: string
  client_name: string
  client_seq: number
  recorded_at: string
}

// ─── Consignee liability report (get_consignee_report) ───────────────────────
// Field names (including `lost_items`) match the RPC's actual response shape;
// only display labels apply the JOKENIA_GLOBAL euphemism rule.

export interface ConsigneeReportStockRow {
  product_type: string
  variation: string
  sku: string | null
  units_in_stock: number
}

export interface ConsigneeReportSaleRow {
  sale_date: string
  product_type: string
  variation: string
  serial_number: string
  consignee_price: number
  running_total: number
}

export interface ConsigneeReportSettlement {
  settlement_date: string
  total_amount: number
  notes: string | null
}

export interface ConsigneeReportLostItem {
  loss_date: string
  product_type: string
  variation: string
  serial_number: string
  consignee_price: number
  settled: boolean
}

export interface ConsigneeReport {
  client: {
    name: string
    contact_person: string | null
    phone: string | null
    email: string | null
  }
  report_period: { from: string; to: string }
  stock: ConsigneeReportStockRow[]
  sales: ConsigneeReportSaleRow[]
  total_owed: number
  settlements: ConsigneeReportSettlement[]
  lost_items: ConsigneeReportLostItem[]
}
