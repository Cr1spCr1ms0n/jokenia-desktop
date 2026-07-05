import type { ConsigneeReport } from '@/components/consignees/types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Filenames must not contain path separators or other characters the OS
// save dialog would reject.
export function sanitiseFileNamePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

// Brand-styled report layout — deliberately mirrors the admin app's own
// buildReportHtml (same sections, same JOKENIA_GLOBAL palette hex values)
// since this is real client-facing business content, not reinvented here.
// The euphemism rule (never "lost"/"missing") is already honoured by the
// section title "Compensated Items" and the "Settled?" column, matching the
// admin app's own PDF exactly.
export function generateConsigneeReportHtml(data: ConsigneeReport): string {
  const { client, report_period, stock, sales, lost_items, total_owed, settlements } = data

  const th =
    'border:1px solid #ddd2be;padding:6px 10px;text-align:left;background:#f2edd7;color:#3d3d2e;font-weight:600;font-size:11px'
  const td =
    'border:1px solid #ddd2be;padding:6px 10px;text-align:left;color:#3d3d2e;font-size:12px'
  const tbl = 'width:100%;border-collapse:collapse;margin-top:8px'
  const h2 =
    'font-size:12px;font-weight:700;color:#c9a96e;margin:24px 0 4px;text-transform:uppercase;letter-spacing:.8px'

  const stockSection =
    stock.length > 0
      ? `
    <h2 style="${h2}">Current Stock</h2>
    <table style="${tbl}">
      <thead><tr>
        <th style="${th}">Product Type</th><th style="${th}">Variation</th><th style="${th}">SKU</th><th style="${th}">Units</th>
      </tr></thead>
      <tbody>${stock
        .map(
          (r) => `
        <tr>
          <td style="${td}">${escapeHtml(r.product_type)}</td>
          <td style="${td}">${escapeHtml(r.variation)}</td>
          <td style="${td}">${r.sku ? escapeHtml(r.sku) : '—'}</td>
          <td style="${td}">${r.units_in_stock}</td>
        </tr>`
        )
        .join('')}
      </tbody>
    </table>`
      : ''

  const periodTotal = sales.length > 0 ? sales[sales.length - 1].running_total : null
  const salesSection =
    sales.length > 0
      ? `
    <h2 style="${h2}">Sales — Period</h2>
    <table style="${tbl}">
      <thead><tr>
        <th style="${th}">Date</th><th style="${th}">Variation</th><th style="${th}">Serial</th><th style="${th}">Price</th><th style="${th}">Running Total</th>
      </tr></thead>
      <tbody>${sales
        .map(
          (r) => `
        <tr>
          <td style="${td}">${escapeHtml(r.sale_date)}</td>
          <td style="${td}">${escapeHtml(r.product_type)} — ${escapeHtml(r.variation)}</td>
          <td style="${td}">${escapeHtml(r.serial_number)}</td>
          <td style="${td}">${fmt(r.consignee_price)}</td>
          <td style="${td}">${fmt(r.running_total)}</td>
        </tr>`
        )
        .join('')}
      </tbody>
    </table>
    <p style="font-size:12px;font-weight:700;margin-top:8px;color:#3d3d2e">Period Total: ${fmt(periodTotal ?? 0)}</p>`
      : ''

  const compensatedSection =
    lost_items.length > 0
      ? `
    <h2 style="${h2}">Compensated Items</h2>
    <table style="${tbl}">
      <thead><tr>
        <th style="${th}">Date</th><th style="${th}">Variation</th><th style="${th}">Serial</th><th style="${th}">Price</th><th style="${th}">Settled?</th>
      </tr></thead>
      <tbody>${lost_items
        .map(
          (r) => `
        <tr>
          <td style="${td}">${escapeHtml(r.loss_date)}</td>
          <td style="${td}">${escapeHtml(r.product_type)} — ${escapeHtml(r.variation)}</td>
          <td style="${td}">${escapeHtml(r.serial_number)}</td>
          <td style="${td}">${fmt(r.consignee_price)}</td>
          <td style="${td}">${r.settled ? 'Settled' : 'Pending'}</td>
        </tr>`
        )
        .join('')}
      </tbody>
    </table>`
      : ''

  const settlementSection =
    settlements.length > 0
      ? `
    <h2 style="${h2}">Settlement History</h2>
    <table style="${tbl}">
      <thead><tr>
        <th style="${th}">Date</th><th style="${th}">Amount</th><th style="${th}">Notes</th>
      </tr></thead>
      <tbody>${settlements
        .map(
          (r) => `
        <tr>
          <td style="${td}">${escapeHtml(r.settlement_date)}</td>
          <td style="${td}">${fmt(r.total_amount)}</td>
          <td style="${td}">${r.notes ? escapeHtml(r.notes) : '—'}</td>
        </tr>`
        )
        .join('')}
      </tbody>
    </table>`
      : ''

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#f5edd8;color:#3d3d2e}</style>
</head><body>
<div style="background:#3d3d2e;padding:28px 24px 24px">
  <div style="border-top:3px solid #c9a96e;padding-top:16px">
    <p style="font-size:10px;font-weight:700;color:#c9a96e;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">JOKENIA DESIGNS — Upcycled In Kenya</p>
    <h1 style="font-size:22px;font-weight:700;color:#f5edd8;margin-bottom:4px">${escapeHtml(client.name)}</h1>
    ${client.contact_person ? `<p style="font-size:13px;color:rgba(245,237,216,.72);margin-bottom:2px">${escapeHtml(client.contact_person)}</p>` : ''}
    ${client.phone ? `<p style="font-size:13px;color:rgba(245,237,216,.72);margin-bottom:2px">${escapeHtml(client.phone)}</p>` : ''}
    ${client.email ? `<p style="font-size:13px;color:rgba(245,237,216,.72);margin-bottom:2px">${escapeHtml(client.email)}</p>` : ''}
    <p style="font-size:12px;color:#c9a96e;margin-top:12px">Report Period: ${escapeHtml(report_period.from)} — ${escapeHtml(report_period.to)}</p>
  </div>
</div>
<div style="padding:24px">
  ${stockSection}
  ${salesSection}
  ${compensatedSection}
  ${settlementSection}
  <div style="margin-top:28px;padding:16px 20px;background:#3d3d2e;border-radius:8px">
    <p style="font-size:15px;font-weight:700;color:#c9a96e">Total Outstanding: ${fmt(total_owed)}</p>
  </div>
  <p style="font-size:10px;color:#9a8d7a;margin-top:24px;text-align:center">Generated ${new Date().toLocaleString()} · Selling prices and margins are excluded from this report.</p>
</div>
</body></html>`
}

export async function exportConsigneeReportPdf(
  data: ConsigneeReport,
  dateFrom: string,
  dateTo: string
): Promise<{ canceled: boolean; filePath?: string }> {
  const html = generateConsigneeReportHtml(data)
  const defaultFileName = `Jokenia_Designs_${sanitiseFileNamePart(data.client.name)}_Consignee_Report_${dateFrom}_to_${dateTo}.pdf`
  return window.electron.exportPdf({ html, defaultFileName })
}
