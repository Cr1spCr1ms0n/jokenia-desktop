import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { exportConsigneeReportPdf } from '@/utils/consigneeReport'
import type { ConsigneeReport } from './types'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

interface ConsigneeReportModalProps {
  clientId: string
  isOpen: boolean
  onClose: () => void
}

function ConsigneeReportModal({
  clientId,
  isOpen,
  onClose
}: ConsigneeReportModalProps): React.JSX.Element {
  const [dateFrom, setDateFrom] = useState(firstOfMonthIso)
  const [dateTo, setDateTo] = useState(todayIso)
  const [savedPath, setSavedPath] = useState<string | null>(null)

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('get_consignee_report', {
        p_client_id: clientId,
        p_date_from: dateFrom,
        p_date_to: dateTo
      })
      if (error) throw error
      const report = data as ConsigneeReport
      return exportConsigneeReportPdf(report, dateFrom, dateTo)
    },
    onSuccess: (result) => {
      if (!result.canceled && result.filePath) {
        setSavedPath(result.filePath)
      }
    }
  })

  function handleClose(): void {
    if (generateMutation.isPending) return
    setSavedPath(null)
    generateMutation.reset()
    onClose()
  }

  return (
    <Modal
      title="Consignee liability report"
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-md"
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Date from
          </p>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(event) => {
              setDateFrom(event.target.value)
              setSavedPath(null)
            }}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Date to
          </p>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={todayIso()}
            onChange={(event) => {
              setDateTo(event.target.value)
              setSavedPath(null)
            }}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>

        <p className="rounded-md bg-jokenia-cream2 p-3 text-[11px] leading-relaxed text-jokenia-dark2">
          Report includes: client details, current stock, sales in period, compensated items,
          settlement history, and total outstanding. Selling prices and margins are excluded.
        </p>

        {generateMutation.error && (
          <p className="text-xs text-red-500">{(generateMutation.error as Error).message}</p>
        )}

        {savedPath && (
          <p className="rounded-md bg-green-50 p-2 text-xs text-green-700">Saved to {savedPath}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={generateMutation.isPending}
            className="flex-1"
          >
            Close
          </Button>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="flex-1"
          >
            {generateMutation.isPending ? 'Generating…' : 'Generate PDF'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConsigneeReportModal
