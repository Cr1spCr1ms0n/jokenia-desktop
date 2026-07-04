import bwipjs from 'bwip-js/browser'
import { LABEL } from '@/constants/labels'

export interface LabelData {
  serialNumber: string // items.serial_number — printed as the barcode value AND as text below
}

export function generateLabelHtml(data: LabelData): string {
  const canvas = document.createElement('canvas')
  bwipjs.toCanvas(canvas, {
    bcid: 'code128',
    text: data.serialNumber,
    scale: 2,
    height: 12,
    includetext: false
  })
  const barcodeDataUrl = canvas.toDataURL('image/png')

  return `<!DOCTYPE html><html><head><style>
    @page { size: ${LABEL.widthMm}mm ${LABEL.heightMm}mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${LABEL.widthMm}mm; height: ${LABEL.heightMm}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm; overflow: hidden; }
    img { width: 18mm; height: auto; display: block; }
    span { font-family: monospace; font-size: 5px; text-align: center; letter-spacing: 0.2px; }
  </style></head><body>
    <img src="${barcodeDataUrl}" alt="barcode" />
    <span>${data.serialNumber}</span>
  </body></html>`
}

export async function printLabel(data: LabelData): Promise<void> {
  const html = generateLabelHtml(data)
  await window.electron.print({ html, widthMm: LABEL.widthMm, heightMm: LABEL.heightMm })
}
