import bwipjs from 'bwip-js/browser'
import { LABEL } from '@/constants/labels'

export interface LabelData {
  barcode: string // product_variations.barcode — the 13-digit variation barcode
  serialNumber: string // items.serial_number — printed as plain text only
  sku: string
  size: string // human-readable size string (e.g. "M", "W28/L32")
  price: number // KES price
}

const MM_TO_PX = 3.7795

export function generateLabelHtml(data: LabelData): string {
  const canvas = document.createElement('canvas')
  bwipjs.toCanvas(canvas, {
    bcid: 'code128',
    text: data.barcode,
    scale: 2,
    height: 8,
    includetext: false
  })
  const barcodeDataUrl = canvas.toDataURL('image/png')

  const widthPx = Math.round(LABEL.widthMm * MM_TO_PX)
  const heightPx = Math.round(LABEL.heightMm * MM_TO_PX)

  return `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${widthPx}px; height: ${heightPx}px; font-family: 'DM Sans', sans-serif; padding: 3px 4px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
    .barcode { display: block; width: 100%; height: 36px; object-fit: contain; }
    .serial { font-size: 6px; color: #555; letter-spacing: 0.3px; text-align: center; margin-top: 1px; font-family: monospace; }
    .row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; }
    .sku { font-size: 6px; color: #3D3D2E; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 65%; }
    .price { font-size: 8px; font-weight: 700; color: #3D3D2E; white-space: nowrap; }
    .size { font-size: 6px; color: #555; }
  </style></head><body>
    <img class="barcode" src="${barcodeDataUrl}" alt="barcode" />
    <div class="serial">${data.serialNumber}</div>
    <div class="row">
      <div>
        <div class="sku">${data.sku}</div>
        <div class="size">${data.size}</div>
      </div>
      <div class="price">KES ${data.price.toLocaleString('en-KE', { minimumFractionDigits: 0 })}</div>
    </div>
  </body></html>`
}

export async function printLabel(data: LabelData): Promise<void> {
  const html = generateLabelHtml(data)
  await window.electron.print(html)
}
