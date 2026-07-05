import { useEffect, useState } from 'react'
import type { PrinterInfo } from '@/types'
import ToggleRow from './ToggleRow'

function PrintingSection(): React.JSX.Element {
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [receiptPrinter, setReceiptPrinter] = useState('')
  const [labelPrinter, setLabelPrinter] = useState('')
  const [silentPrint, setSilentPrint] = useState(false)
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false)
  const [copyCount, setCopyCount] = useState('1')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      window.electron.getPrinters(),
      window.electron.getPreference('settings.defaultReceiptPrinter'),
      window.electron.getPreference('settings.defaultLabelPrinter'),
      window.electron.getPreference('settings.silentPrint'),
      window.electron.getPreference('settings.autoPrintReceipt'),
      window.electron.getPreference('settings.receiptCopyCount')
    ]).then(([printerList, receipt, label, silent, autoPrint, copies]) => {
      setPrinters(printerList)
      setReceiptPrinter(typeof receipt === 'string' ? receipt : '')
      setLabelPrinter(typeof label === 'string' ? label : '')
      setSilentPrint(Boolean(silent))
      setAutoPrintReceipt(Boolean(autoPrint))
      setCopyCount(typeof copies === 'number' ? String(copies) : '1')
      setIsLoaded(true)
    })
  }, [])

  function handleCopyCountChange(value: string): void {
    setCopyCount(value)
    const parsed = Math.max(1, parseInt(value, 10) || 1)
    window.electron.setPreference('settings.receiptCopyCount', parsed)
  }

  if (!isLoaded) {
    return <p className="text-sm text-jokenia-tan">Loading…</p>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-jokenia-tan">
          Default receipt printer
        </label>
        <select
          value={receiptPrinter}
          onChange={(event) => {
            setReceiptPrinter(event.target.value)
            window.electron.setPreference('settings.defaultReceiptPrinter', event.target.value)
          }}
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        >
          <option value="">System default</option>
          {printers.map((printer) => (
            <option key={printer.name} value={printer.name}>
              {printer.displayName || printer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-jokenia-tan">
          Default label printer
        </label>
        <select
          value={labelPrinter}
          onChange={(event) => {
            setLabelPrinter(event.target.value)
            window.electron.setPreference('settings.defaultLabelPrinter', event.target.value)
          }}
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        >
          <option value="">System default</option>
          {printers.map((printer) => (
            <option key={printer.name} value={printer.name}>
              {printer.displayName || printer.name}
            </option>
          ))}
        </select>
        {printers.length === 0 && (
          <p className="text-xs text-jokenia-tan">No printers detected by Windows.</p>
        )}
      </div>

      <ToggleRow
        label="Silent printing"
        description="Print directly to the default printer above with no print dialog."
        checked={silentPrint}
        onChange={(value) => {
          setSilentPrint(value)
          window.electron.setPreference('settings.silentPrint', value)
        }}
      />

      <ToggleRow
        label="Auto-print receipt after sale"
        description="Print the receipt automatically once a sale is confirmed."
        checked={autoPrintReceipt}
        onChange={(value) => {
          setAutoPrintReceipt(value)
          window.electron.setPreference('settings.autoPrintReceipt', value)
        }}
      />

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-jokenia-tan">
          Receipt copies
        </label>
        <input
          type="number"
          min={1}
          value={copyCount}
          onChange={(event) => handleCopyCountChange(event.target.value)}
          className="w-24 rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
      </div>
    </div>
  )
}

export default PrintingSection
