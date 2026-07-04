import type { DiscountType } from '@/types'

export interface ReceiptData {
  saleId: string
  items: Array<{
    name: string
    sku: string
    quantity: number
    unitPrice: number
    discountType?: DiscountType | null
    discountValue?: number | null
  }>
  payments: Array<{ method: string | null; amount: number; reference?: string | null }>
  total: number
  customerEmail?: string | null
  saleDate: string
  channel: string
}

const RETURN_POLICY = `Returns & Exchanges: Items may be returned or exchanged within 14 days of purchase, provided they are in original, unworn, and undamaged condition.
Refund Options: Eligible returns may be exchanged for an item of equal value or processed as a full cash refund.
Custom Orders: A 50% non-refundable deposit is required for all custom orders. Custom orders are not eligible for returns or exchanges.
After-Sales Support: We offer comprehensive after-sales service on all our bags for up to 5 years from the date of purchase.`

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function lineDiscountAmount(item: ReceiptData['items'][number]): number {
  const gross = item.unitPrice * item.quantity
  if (!item.discountType || !item.discountValue || item.discountValue <= 0) return 0
  if (item.discountType === 'percentage') return gross * (item.discountValue / 100)
  return Math.min(item.discountValue, gross)
}

export function generateReceiptHtml(data: ReceiptData): string {
  const itemRows = data.items
    .map((item) => {
      const gross = item.quantity * item.unitPrice
      const discount = lineDiscountAmount(item)
      const net = gross - discount
      const discountLine = discount > 0 ? `<div class="disc">−KES ${discount.toLocaleString()}</div>` : ''
      return `<tr>
      <td>${escapeHtml(item.name)}${discountLine}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">KES ${item.unitPrice.toLocaleString()}</td>
      <td style="text-align:right">KES ${net.toLocaleString()}</td>
    </tr>`
    })
    .join('')

  const paymentRows = data.payments
    .map((p) => {
      const method = p.method ? p.method.charAt(0).toUpperCase() + p.method.slice(1) : 'Unknown'
      const reference = p.reference ? ` (${escapeHtml(p.reference)})` : ''
      return `<tr><td>${method}${reference}</td><td style="text-align:right">KES ${p.amount.toLocaleString()}</td></tr>`
    })
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 0 auto; padding: 4mm; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 2mm; letter-spacing: 2px; }
    .sub { text-align: center; font-size: 9px; color: #555; margin-bottom: 4mm; }
    hr { border: none; border-top: 1px dashed #aaa; margin: 3mm 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1mm 0; vertical-align: top; }
    .disc { font-size: 8px; color: #888; }
    .total-row td { font-weight: bold; border-top: 1px solid #333; padding-top: 2mm; }
    .policy { font-size: 8px; color: #444; line-height: 1.4; margin-top: 4mm; white-space: pre-line; }
    .footer { text-align: center; font-size: 9px; margin-top: 4mm; color: #666; }
  </style></head><body>
    <h1>JOKENIA</h1>
    <div class="sub">Upcycled In Kenya<br>${escapeHtml(data.saleDate)}<br>Sale: ${data.saleId.substring(0, 8).toUpperCase()}</div>
    <hr>
    <table>
      <thead><tr><td>Item</td><td style="text-align:center">Qty</td><td style="text-align:right">Unit</td><td style="text-align:right">Total</td></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr class="total-row"><td colspan="3">Total</td><td style="text-align:right">KES ${data.total.toLocaleString()}</td></tr>
      </tfoot>
    </table>
    <hr>
    <table>${paymentRows}</table>
    <hr>
    <div class="policy">${escapeHtml(RETURN_POLICY)}</div>
    <div class="footer">Thank you for shopping with Jokenia!</div>
  </body></html>`
}

export async function printReceipt(data: ReceiptData): Promise<void> {
  const html = generateReceiptHtml(data)
  await window.electron.printReceipt(html)
}
