import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { OpenServiceTicketResult, ServiceType } from './types'

const PHONE_PATTERN = /^\+254\d{9}$/
const inputClass =
  'w-full rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold'
const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-jokenia-tan'

interface NewTicketFormProps {
  onClose: () => void
  onCreated: (result: OpenServiceTicketResult) => void
}

function NewTicketForm({ onClose, onCreated }: NewTicketFormProps): React.JSX.Element {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType>('fix')
  const [description, setDescription] = useState('')
  const [quotedFee, setQuotedFee] = useState('0')
  const [openingNote, setOpeningNote] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const phoneValid = PHONE_PATTERN.test(phone.trim())
  const nameValid = name.trim().length >= 2
  const descriptionValid = description.trim().length >= 5
  const feeValid = quotedFee.trim() === '' || (!isNaN(parseFloat(quotedFee)) && parseFloat(quotedFee) >= 0)
  const emailValid = email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canSubmit = phoneValid && nameValid && descriptionValid && feeValid && emailValid && !submitting

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('open_service_ticket', {
      p_client_name: name.trim(),
      p_client_phone: phone.trim(),
      p_service_type: serviceType,
      p_item_description: description.trim(),
      p_client_email: email.trim() || undefined,
      p_quoted_fee: quotedFee.trim() ? parseFloat(quotedFee) : 0,
      p_opening_note: openingNote.trim() || undefined
    })
    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onCreated(data as OpenServiceTicketResult)
  }

  return (
    <Modal title="New Service Ticket" isOpen onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <p className="rounded-md border border-jokenia-tan/20 bg-white/40 p-3 text-xs italic text-jokenia-dark2">
          Enter the client&apos;s phone number first. If the number already exists in the system the client
          record will be updated with any new name or email provided.
        </p>

        <div>
          <label className={labelClass}>Client phone *</label>
          <input
            className={inputClass}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+254712345678"
          />
          {phone && !phoneValid && (
            <p className="mt-1 text-xs text-red-600">Phone must be in +254XXXXXXXXX format.</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Client name *</label>
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
          />
          {name && !nameValid && <p className="mt-1 text-xs text-red-600">Name is required.</p>}
        </div>

        <div>
          <label className={labelClass}>Email (optional)</label>
          <input
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="client@example.com"
          />
          {email && !emailValid && <p className="mt-1 text-xs text-red-600">Invalid email.</p>}
        </div>

        <div>
          <label className={labelClass}>Service type</label>
          <div className="flex gap-2">
            {(['fix', 'adjustment'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setServiceType(type)}
                className={`flex-1 rounded-md border py-1.5 text-xs font-medium ${
                  serviceType === type
                    ? 'border-jokenia-gold bg-jokenia-gold/20 text-jokenia-dark'
                    : 'border-jokenia-tan/30 bg-white text-jokenia-dark2'
                }`}
              >
                {type === 'fix' ? 'Fix' : 'Adjustment'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Item description *</label>
          <textarea
            className={inputClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the item and what needs to be done"
            rows={3}
          />
          {description && !descriptionValid && (
            <p className="mt-1 text-xs text-red-600">Please describe the item and work needed.</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Quoted fee (KES)</label>
          <input
            className={inputClass}
            type="number"
            value={quotedFee}
            onChange={(event) => setQuotedFee(event.target.value)}
            placeholder="0"
          />
          <p className="mt-1 text-xs text-jokenia-tan">Enter 0 if no charge.</p>
        </div>

        <div>
          <label className={labelClass}>Opening note (optional)</label>
          <input
            className={inputClass}
            value={openingNote}
            onChange={(event) => setOpeningNote(event.target.value)}
            placeholder="Any additional intake notes"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Submitting…' : 'Create Ticket'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default NewTicketForm
