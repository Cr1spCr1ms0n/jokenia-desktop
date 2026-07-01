import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'

interface ResolveBarcodeRow {
  variation_id: string
  product_type: string
  variation_name: string
  sku: string
  last_price: number
  stock_count: number
}

type ScanStatus = 'idle' | 'loading' | 'success' | 'error'

interface ScanInputProps {
  isConfirming: boolean
}

const BORDER_CLASSES: Record<ScanStatus, string> = {
  idle: 'border-jokenia-gold',
  loading: 'border-jokenia-gold',
  success: 'border-green-500',
  error: 'border-red-400'
}

function ScanInput({ isConfirming }: ScanInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const clearTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const addOrIncrementItem = useAppStore((state) => state.addOrIncrementItem)

  useEffect(() => {
    inputRef.current?.focus()

    // USB HID scanners type into whatever has focus. If nothing else is
    // focused (user clicked off, a modal closed, etc.) route keystrokes
    // back to the scan input so scans are never lost.
    function handleGlobalKeydown(): void {
      if (document.activeElement === document.body) {
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  }, [])

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
  }, [])

  function parseScanError(message: string): string {
    if (message === 'Barcode not recognised') return 'Item not found in system'
    if (message === 'No stock available for this product') return 'No stock available'
    return 'Scan error — try again'
  }

  async function handleScan(barcode: string): Promise<void> {
    setStatus('loading')

    const { data, error } = await supabase.rpc('resolve_barcode', { p_barcode: barcode })

    if (error) {
      setStatus('error')
      setErrorMessage(parseScanError(error.message))
      clearTimerRef.current = setTimeout(() => {
        setStatus('idle')
        setErrorMessage('')
        inputRef.current?.focus()
      }, 3000)
      return
    }

    const row = (data as ResolveBarcodeRow[])[0]
    addOrIncrementItem({
      variation_id: row.variation_id,
      product_type: row.product_type,
      variation_name: row.variation_name,
      sku: row.sku,
      unit_price: row.last_price,
      stock_count: row.stock_count
    })

    setStatus('success')
    clearTimerRef.current = setTimeout(() => {
      setStatus('idle')
      inputRef.current?.focus()
    }, 800)

    inputRef.current?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      const barcode = value.trim()
      setValue('')
      if (barcode && status !== 'loading') {
        void handleScan(barcode)
      }
    }
  }

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isConfirming}
          placeholder="Scan or enter barcode..."
          autoComplete="off"
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-jokenia-dark placeholder:text-jokenia-tan/60 focus:outline-none disabled:pointer-events-none disabled:opacity-50 ${BORDER_CLASSES[status]}`}
        />
        {status === 'loading' && (
          <span
            className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-jokenia-tan/40 border-t-jokenia-gold"
            aria-hidden="true"
          />
        )}
      </div>
      {status === 'error' && <p className="mt-1 text-xs text-red-500">{errorMessage}</p>}
    </div>
  )
}

export default ScanInput
