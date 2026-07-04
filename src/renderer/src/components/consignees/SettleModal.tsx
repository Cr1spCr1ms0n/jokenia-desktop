import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface SettleModalProps {
  clientId: string
  isOpen: boolean
  onClose: () => void
  onSettled: () => void
}

function SettleModal({ clientId, isOpen, onClose, onSettled }: SettleModalProps): React.JSX.Element {
  const isOnline = useAppStore((state) => state.isOnline)
  const [upToDate, setUpToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const settleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('settle_consignee_sales', {
        p_client_id: clientId,
        p_up_to_date: upToDate,
        p_notes: notes.trim() || null
      })
      if (error) throw error
    },
    onSuccess: () => {
      setNotes('')
      onSettled()
    }
  })

  function handleSubmit(): void {
    if (!isOnline) {
      setFormError('Settlement requires an internet connection.')
      return
    }
    if (!upToDate) {
      setFormError('Select a settle-up-to date.')
      return
    }
    setFormError(null)
    settleMutation.mutate()
  }

  return (
    <Modal title="Settle consignee" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-3">
        {!isOnline && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
            Settlement is a financial write and requires an internet connection — it cannot be
            queued offline.
          </p>
        )}
        {(formError || settleMutation.error) && (
          <p className="text-xs text-red-500">
            {formError ?? (settleMutation.error as Error).message}
          </p>
        )}

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Settle up to date
          </p>
          <input
            type="date"
            value={upToDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setUpToDate(event.target.value)}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-jokenia-tan">
            All sold items up to this date will be settled.
          </p>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-jokenia-tan">
            Notes (optional)
          </p>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Any notes for this settlement…"
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={settleMutation.isPending || !isOnline}
            className="flex-1"
          >
            {settleMutation.isPending ? 'Settling…' : 'Settle'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default SettleModal
