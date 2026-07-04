import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import type { NewMarketEventInput } from './types'

const BLANK_FORM: NewMarketEventInput = {
  name: '',
  series_name: '',
  location: '',
  start_date: '',
  end_date: '',
  notes: ''
}

interface NewMarketEventFormProps {
  onCreated: (eventId: string) => void
  onCancel: () => void
}

function NewMarketEventForm({ onCreated, onCancel }: NewMarketEventFormProps): React.JSX.Element {
  const [form, setForm] = useState<NewMarketEventInput>(BLANK_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('create_market_event', {
        p_name: form.name.trim(),
        p_start_date: form.start_date,
        p_end_date: form.end_date,
        p_location: form.location.trim() || null,
        p_series_name: form.series_name.trim() || null,
        p_notes: form.notes.trim() || null
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (eventId) => onCreated(eventId)
  })

  function handleSubmit(): void {
    if (!form.name.trim()) {
      setFormError('Event name is required.')
      return
    }
    if (!form.start_date || !form.end_date) {
      setFormError('Start and end dates are required.')
      return
    }
    if (form.end_date < form.start_date) {
      setFormError('End date must be on or after start date.')
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
        ← Back to markets
      </button>

      <div className="max-w-md space-y-2 rounded-md border border-jokenia-tan/20 bg-white/70 p-3">
        <h2 className="font-heading text-lg font-semibold text-jokenia-dark">New market event</h2>

        {(formError || createMutation.error) && (
          <p className="text-xs text-red-500">
            {formError ?? (createMutation.error as Error).message}
          </p>
        )}

        <input
          type="text"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Event name"
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
        <input
          type="text"
          value={form.series_name}
          onChange={(event) => setForm({ ...form, series_name: event.target.value })}
          placeholder="Series (optional)"
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
        <input
          type="text"
          value={form.location}
          onChange={(event) => setForm({ ...form, location: event.target.value })}
          placeholder="Location (optional)"
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={form.start_date}
            onChange={(event) => setForm({ ...form, start_date: event.target.value })}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
          <input
            type="date"
            value={form.end_date}
            onChange={(event) => setForm({ ...form, end_date: event.target.value })}
            className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
          />
        </div>
        <textarea
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          placeholder="Notes (optional)"
          rows={3}
          className="w-full rounded-md border border-jokenia-tan/40 bg-white px-3 py-2 text-sm text-jokenia-dark focus:border-jokenia-gold focus:outline-none"
        />

        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="w-full"
        >
          {createMutation.isPending ? 'Creating…' : 'Create event'}
        </Button>
      </div>
    </div>
  )
}

export default NewMarketEventForm
