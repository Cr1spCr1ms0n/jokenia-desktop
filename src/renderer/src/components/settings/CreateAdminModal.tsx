import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import PasswordField from '@/components/ui/PasswordField'

const inputClass =
  'w-full rounded-md border border-jokenia-tan/30 bg-white px-3 py-2 text-sm text-jokenia-dark focus:outline-none focus:ring-2 focus:ring-jokenia-gold'
const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-jokenia-tan'

interface CreateAdminModalProps {
  onClose: () => void
  onCreated: () => void
}

function CreateAdminModal({ onClose, onCreated }: CreateAdminModalProps): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const nameValid = fullName.trim().length > 0
  const passwordValid = password.length >= 8
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const canSubmit = emailValid && nameValid && passwordValid && passwordsMatch && !submitting

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('create_admin_account', {
      p_email: email.trim(),
      p_full_name: fullName.trim(),
      p_password: password
    })
    setSubmitting(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    onCreated()
  }

  return (
    <Modal title="New Admin Account" isOpen onClose={onClose} maxWidthClassName="max-w-md">
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Email *</label>
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@jokenia.co.ke"
          />
          {email && !emailValid && (
            <p className="mt-1 text-xs text-red-600">Enter a valid email address.</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Full name *</label>
          <input
            className={inputClass}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Full name"
          />
        </div>

        <PasswordField
          label="Password *"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggleVisible={() => setShowPassword((v) => !v)}
          placeholder="At least 8 characters"
        />
        {password && !passwordValid && (
          <p className="-mt-2 text-xs text-red-600">Password must be at least 8 characters.</p>
        )}

        <PasswordField
          label="Confirm password *"
          value={confirmPassword}
          onChange={setConfirmPassword}
          visible={showPassword}
          onToggleVisible={() => setShowPassword((v) => !v)}
          placeholder="Re-enter password"
        />
        {confirmPassword && !passwordsMatch && (
          <p className="-mt-2 text-xs text-red-600">Passwords do not match.</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {submitting ? 'Creating…' : 'Create Admin'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CreateAdminModal
