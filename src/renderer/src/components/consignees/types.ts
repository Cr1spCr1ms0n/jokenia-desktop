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
