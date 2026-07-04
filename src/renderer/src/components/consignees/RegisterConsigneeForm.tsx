import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'

interface RegisterConsigneeFormProps {
  onCreated: (clientId: string) => void
  onCancel: () => void
}

interface FormState {
  name: string
  contact_person: string
  phone: string
  email: string
  address: string
}

const BLANK_FORM: FormState = { name: '', contact_person: '', phone: '', email: '', address: '' }

function RegisterConsigneeForm({ onCreated, onCancel }: RegisterConsigneeFormProps): React.JSX.Element {
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('create_business_client', {
        p_name: form.name.trim(),
        p_contact_person: form.contact_person.trim() || null,
        p_phone: form.phone.trim() || null,
        p_email: form.email.trim() || null,
        p_address: form.address.trim() || null
      })
      if (error) throw error
      const row = (data as Array<{ client_id: string; client_seq: number }>)[0]
      return row.client_id
    },
    onSuccess: (clientId) => onCreated(clientId)
  })

  function handleSubmit(): void {
    if (!form.name.trim()) {
      setFormError('Consignee name is required.')
      return
    }
    setFormError(null)
    createMutation.mutate()
  }

  return (
    <div className="flex h-full flex-col p-4">
      <button
        type="button"
        onClick={onCancel}
        className="mb-3 self-start text-xs text-jokenia-tan hover:text-jokenia-dark"
      >
        ← Back to consignees
      </button>

      <div className="max-w-md space-y-2 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
        <h2 className="font-heading text-lg font-semibold text-jokenia-dark">Register consignee</h2>

        {(formError || createMutation.error) && (
          <p className="text-xs text-red-500">
            {formError ?? (createMutation.error as Error).message}
          </p>
        )}

        <input
          type="text"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Consignee name"
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
        <input
          type="text"
          value={form.contact_person}
          onChange={(event) => setForm({ ...form, contact_person: event.target.value })}
          placeholder="Contact person (optional)"
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
        <input
          type="text"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          placeholder="Phone (optional)"
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
        <input
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Email (optional)"
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
        <input
          type="text"
          value={form.address}
          onChange={(event) => setForm({ ...form, address: event.target.value })}
          placeholder="Address (optional)"
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />

        <Button onClick={handleSubmit} disabled={createMutation.isPending} className="w-full">
          {createMutation.isPending ? 'Registering…' : 'Register consignee'}
        </Button>
      </div>
    </div>
  )
}

export default RegisterConsigneeForm
