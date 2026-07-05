export interface SaleListRow {
  id: string
  sale_type: string
  sale_channel: string | null
  net_amount: number
  created_at: string
  ad_hoc_client_name: string | null
}

export interface SaleDetailPayment {
  id: string
  payment_method: string
  amount: number
  reference_number: string | null
}

export interface SaleDetailItem {
  id: string
  unit_price: number
  discount_amount: number
  line_total: number
  items: {
    id: string
    serial_number: string
    status: string
    product_variations: {
      name: string
      sku: string | null
      product_types: { name: string } | null
    } | null
  } | null
}

export interface SaleDetail {
  id: string
  sale_type: string
  sale_channel: string | null
  gross_amount: number
  discount_amount: number
  net_amount: number
  is_invoiced: boolean
  is_manual: boolean
  manual_description: string | null
  ad_hoc_client_name: string | null
  customer_email: string | null
  created_at: string
  sold_by: { full_name: string | null } | null
  sale_items: SaleDetailItem[]
  sale_payments: SaleDetailPayment[]
  invoices: { id: string }[]
}

export interface ReceiptDataItem {
  serial_number: string
  product_type: string
  variation_name: string
  sku: string
  unit_price: number
  discount_amount: number
  line_total: number
}

export interface ReceiptDataPayment {
  method: string
  amount: number
  reference_number: string | null
}

export interface ReceiptDataResponse {
  sale_id: string
  created_at: string
  sale_type: string
  sold_by: string
  client_name: string | null
  customer_email: string | null
  gross_amount: number
  discount_amount: number
  net_amount: number
  items: ReceiptDataItem[]
  payments: ReceiptDataPayment[]
  cash_tendered: number | null
  change_due: number | null
}

export interface InvoiceListRow {
  id: string
  amount_due: number
  due_date: string
  status: string
  client_id: string | null
  ad_hoc_name: string | null
}

export interface InvoiceDetail extends InvoiceListRow {
  settled_at: string | null
  sale_id: string | null
}
